import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { env } from '../../lib/env';
import { getSupabase } from '../../lib/supabase';
import { parsePayload, toAppError } from '../../lib/errors';
import { accountStateSchema, type AccountState } from '../../lib/database.types';
import { completeSignInFromUrl } from './authService';
import { track } from '../../lib/analytics';
import { RESTORE_TIMEOUT_MS, RETRY_RESTORE_TIMEOUT_MS, restoreSessionOnLaunch, type UnavailableReason } from '../../lib/sessionRestore';

export type RestoreStatus = 'restoring' | 'retrying' | 'ready' | 'unavailable';
interface SessionValue {
  session: Session | null;
  userId: string | null;
  /** True once the launch-time restore succeeded (signed in or guest). See `status` for the unavailable case. */
  ready: boolean;
  status: RestoreStatus;
  unavailableReason: UnavailableReason | null;
  retry: () => void;
}
const SessionContext = createContext<SessionValue>({ session: null, userId: null, ready: false, status: 'restoring', unavailableReason: null, retry: () => {} });

/** Mirrors the Supabase session (issued and verified by the server). It carries identity, never permissions. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<RestoreStatus>(env.isConfigured ? 'restoring' : 'ready');
  const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setStatus('retrying'); setAttempt((n) => n + 1); }, []);

  // Launch restore: bounded wait, explicit outcome (see lib/sessionRestore). Re-runs on "Tekrar dene".
  useEffect(() => {
    if (!env.isConfigured) return;
    let cancelled = false;
    void restoreSessionOnLaunch(getSupabase(), { timeoutMs: attempt === 0 ? RESTORE_TIMEOUT_MS : RETRY_RESTORE_TIMEOUT_MS }).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === 'ok') { setSession(outcome.session); setStatus('ready'); }
      else { setUnavailableReason(outcome.reason); setStatus('unavailable'); track('startup_unavailable', { reason: outcome.reason }); }
    });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (!env.isConfigured) return;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    // Sign-in links on devices arrive as a deep link (the web target is handled by supabase-js itself).
    const onUrl = (url: string | null) => { if (Platform.OS !== 'web') void completeSignInFromUrl(url).catch(() => {}); };
    void Linking.getInitialURL().then(onUrl);
    const linkSub = Linking.addEventListener('url', (e) => onUrl(e.url));
    return () => { data.subscription.unsubscribe(); linkSub.remove(); };
  }, []);

  const value = useMemo(() => ({ session, userId: session?.user.id ?? null, ready: status === 'ready', status, unavailableReason, retry }), [session, status, unavailableReason, retry]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

export const accountStateKey = (userId: string | null) => ['account-state', userId] as const;

/** Roles, minor status and profile completeness are always read from the server. */
export function useAccountState() {
  const { userId } = useSession();
  return useQuery({
    queryKey: accountStateKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<AccountState | null> => {
      const { data, error } = await getSupabase().rpc('my_account_state');
      if (error) throw toAppError(error);
      return data === null ? null : parsePayload(accountStateSchema, data);
    },
  });
}
