import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';
import { makeError, toAppError } from '../../lib/errors';
import { clearLocalData } from '../../lib/localPrefs';
import { queryClient } from '../../lib/queryClient';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => EMAIL.test(normaliseEmail(email));

/** Real e-mail OTP through Supabase Auth. There is no client-side "logged in" flag anywhere in the app. */
export async function signInWithEmailOtp(email: string): Promise<void> {
  if (!isValidEmail(email)) throw makeError('email_invalid', 422, { fieldErrors: { email: 'Geçerli bir e-posta adresi yaz.' } });
  const { error } = await getSupabase().auth.signInWithOtp({ email: normaliseEmail(email), options: { shouldCreateUser: true } });
  if (error) throw toAppError(error);
}

export async function verifyOtp(email: string, token: string): Promise<Session> {
  const { data, error } = await getSupabase().auth.verifyOtp({ email: normaliseEmail(email), token: token.trim(), type: 'email' });
  if (error) throw toAppError(error);
  if (!data.session) throw makeError('otp_invalid', 422);
  return data.session;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw toAppError(error);
  return data.session;
}
/** supabase-js restores and refreshes the persisted session itself; exposed for explicit "pull to retry" flows. */
export const restoreSession = getSession;

export async function refreshSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.refreshSession();
  if (error) throw toAppError(error);
  return data.session;
}

async function wipeLocalState() {
  queryClient.clear();
  await clearLocalData();
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  // Even when the network call fails the local session is removed by supabase-js; never keep cached user data around.
  await wipeLocalState();
  if (error && toAppError(error).code !== 'network_unreachable') throw toAppError(error);
}

/** Server-side deletion (Edge Function with the user's JWT). Local wipe happens only after the server confirms. */
export async function deleteAccount(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw toAppError(error);
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  await wipeLocalState();
}
