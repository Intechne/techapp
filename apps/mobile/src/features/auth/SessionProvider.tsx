import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { env } from '../../lib/env';
import { getSupabase } from '../../lib/supabase';
import { parsePayload, toAppError } from '../../lib/errors';
import { accountStateSchema, type AccountState } from '../../lib/database.types';
import { track } from '../../lib/analytics';
import { RESTORE_TIMEOUT_MS, RETRY_RESTORE_TIMEOUT_MS, restoreSessionOnLaunch, type UnavailableReason } from '../../lib/sessionRestore';
import { queryClient } from '../../lib/queryClient';
import { otpFlow } from './otpFlow';
import { clearCards, keepOnlyCardsOf } from '../events/offlineCard';

/**
 * A signed-in identity ended (sign-out, expiry, or a different account signed in): everything rendered or cached for it
 * must go — open screens in every tab stack included, or the next person on a shared device sees the previous
 * person's ticket. Guest → signed in is NOT a change: the pending "join this event" flow continues across sign-in.
 */
export const identityEnded = (previous: string | null, next: string | null) => previous !== null && previous !== next;

export type RestoreStatus = 'restoring' | 'retrying' | 'ready' | 'unavailable';
interface SessionValue {
  session: Session | null;
  userId: string | null;
  /** True once the launch-time restore succeeded (signed in or guest). See `status` for the unavailable case. */
  ready: boolean;
  status: RestoreStatus;
  unavailableReason: UnavailableReason | null;
  retry: () => void;
  /** Bumped whenever a signed-in identity ends; the navigation tree is keyed on it so all stacks start over. */
  identityEpoch: number;
}
const SessionContext = createContext<SessionValue>({ session: null, userId: null, ready: false, status: 'restoring', unavailableReason: null, retry: () => {}, identityEpoch: 0 });

/** Mirrors the Supabase session (issued and verified by the server). It carries identity, never permissions. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<RestoreStatus>(env.isConfigured ? 'restoring' : 'ready');
  const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [identityEpoch, setIdentityEpoch] = useState(0);
  const userId = session?.user.id ?? null;
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    if (identityEnded(previousUserId.current, userId)) {
      queryClient.clear();
      otpFlow.clear();
      void clearCards().catch(() => {}); // offline participation cards belong to the identity that ended; never block sign-out
      setIdentityEpoch((n) => n + 1);
    }
    previousUserId.current = userId;
  }, [userId]);
  const retry = useCallback(() => { setStatus('retrying'); setAttempt((n) => n + 1); }, []);

  // Launch restore: bounded wait, explicit outcome (see lib/sessionRestore). Re-runs on "Tekrar dene".
  useEffect(() => {
    if (!env.isConfigured) return;
    let cancelled = false;
    void restoreSessionOnLaunch(getSupabase(), { timeoutMs: attempt === 0 ? RESTORE_TIMEOUT_MS : RETRY_RESTORE_TIMEOUT_MS }).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === 'ok') {
        setSession(outcome.session); setStatus('ready');
        // Keychain outlives an uninstall: with no session at launch no saved card can belong to anyone; with one, only that
        // user's cards may stay (the startup offline screen scoped by the stored session can never leave another's). Never blocks.
        if (!outcome.session) void clearCards().catch(() => {});
        else void keepOnlyCardsOf(outcome.session.user.id).catch(() => {});
      }
      else { setUnavailableReason(outcome.reason); setStatus('unavailable'); track('startup_unavailable', { reason: outcome.reason }); }
    });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (!env.isConfigured) return;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ session, userId, ready: status === 'ready', status, unavailableReason, retry, identityEpoch }),
    [session, userId, status, unavailableReason, retry, identityEpoch]);
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
