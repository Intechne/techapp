import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { env } from '../../lib/env';
import { getSupabase } from '../../lib/supabase';
import { parsePayload, toAppError } from '../../lib/errors';
import { accountStateSchema, type AccountState } from '../../lib/database.types';
import { completeSignInFromUrl } from './authService';

interface SessionValue { session: Session | null; userId: string | null; ready: boolean }
const SessionContext = createContext<SessionValue>({ session: null, userId: null, ready: false });

/** Mirrors the Supabase session (issued and verified by the server). It carries identity, never permissions. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!env.isConfigured);

  useEffect(() => {
    if (!env.isConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => setSession(null)).finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    // Sign-in links on devices arrive as a deep link (the web target is handled by supabase-js itself).
    const onUrl = (url: string | null) => { if (Platform.OS !== 'web') void completeSignInFromUrl(url).catch(() => {}); };
    void Linking.getInitialURL().then(onUrl);
    const linkSub = Linking.addEventListener('url', (e) => onUrl(e.url));
    return () => { data.subscription.unsubscribe(); linkSub.remove(); };
  }, []);

  const value = useMemo(() => ({ session, userId: session?.user.id ?? null, ready }), [session, ready]);
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
