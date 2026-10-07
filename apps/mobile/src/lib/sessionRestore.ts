import type { Session, SupabaseClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';

/**
 * Launch-time session restore with a bounded wait and an explicit outcome, so the app never sits on a blank screen.
 *
 *   ok           → session (or null = guest) is known, open the app
 *   unavailable  → we could not reach TechApp; show a recoverable screen with "Tekrar dene"
 *                  (the stored session is kept, nothing is wiped)
 * An invalid or revoked refresh token is not an outage: the local session is dropped and the user continues as a guest.
 */
export type UnavailableReason = 'offline' | 'unreachable' | 'server_error';
export type RestoreOutcome = { kind: 'ok'; session: Session | null } | { kind: 'unavailable'; reason: UnavailableReason };

export const RESTORE_TIMEOUT_MS = 12_000;
/**
 * A user-initiated retry waits longer: after a failed refresh supabase-js keeps retrying internally with backoff
 * (about 30 s) under its auth lock, and a new restore queues behind that loop. The longer deadline lets the retry
 * succeed on the loop's next attempt once the backend is back, instead of timing out again.
 */
export const RETRY_RESTORE_TIMEOUT_MS = 35_000;

interface ErrorLike { name?: unknown; status?: unknown; code?: unknown; message?: unknown }

/** Refresh-token problems that mean "this stored session is dead", not "the server is down". */
const DEAD_SESSION_CODES = new Set(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'invalid_grant', 'bad_jwt', 'user_not_found']);

export type RestoreErrorClass = 'dead_session' | 'server_error' | 'network';

export function classifyRestoreError(error: unknown): RestoreErrorClass {
  const e = (error ?? {}) as ErrorLike;
  const status = typeof e.status === 'number' ? e.status : 0;
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  if (DEAD_SESSION_CODES.has(code) || /invalid refresh token|refresh token not found|already used/i.test(message)) return 'dead_session';
  if (status >= 500) return 'server_error';
  // A 4xx from Auth on restore means the stored credentials are no longer accepted.
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'dead_session';
  return 'network'; // timeouts, DNS failures, "Network request failed", AuthRetryableFetchError, 408/429
}

async function isDeviceOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Session restore timeout'), { name: 'RestoreTimeout' })), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function restoreSessionOnLaunch(client: Pick<SupabaseClient, 'auth'>, opts: { timeoutMs?: number; offlineCheck?: () => Promise<boolean> } = {}): Promise<RestoreOutcome> {
  const offlineCheck = opts.offlineCheck ?? isDeviceOffline;
  try {
    const { data, error } = await withTimeout(client.auth.getSession(), opts.timeoutMs ?? RESTORE_TIMEOUT_MS);
    if (!error) return { kind: 'ok', session: data.session };
    const kind = classifyRestoreError(error);
    if (kind === 'dead_session') {
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      return { kind: 'ok', session: null };
    }
    if (kind === 'server_error') return { kind: 'unavailable', reason: 'server_error' };
    return { kind: 'unavailable', reason: (await offlineCheck()) ? 'offline' : 'unreachable' };
  } catch (error) {
    const kind = classifyRestoreError(error);
    if (kind === 'dead_session') {
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      return { kind: 'ok', session: null };
    }
    if (kind === 'server_error') return { kind: 'unavailable', reason: 'server_error' };
    return { kind: 'unavailable', reason: (await offlineCheck()) ? 'offline' : 'unreachable' };
  }
}
