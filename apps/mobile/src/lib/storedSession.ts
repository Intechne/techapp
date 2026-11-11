import { secureSessionStorage } from './secureSessionStorage';

/**
 * The key supabase-js stores the session under (its own default, `sb-<first host label>-auth-token`). lib/supabase passes it
 * explicitly so this module and the client can never disagree; the value is unchanged, so existing sessions stay signed in.
 */
export function sessionStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl.trim()).hostname.split('.')[0]}-auth-token`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The user id of the session saved on this device, read locally with no network and no token refresh.
 * Only `user.id` is looked at; tokens are neither decoded nor checked. This is NOT proof of a signed-in user: use it only to
 * scope data that was already cached for that user on this device (offline participation cards), never for access.
 */
export async function readStoredSessionUserId(key: string, storage: { getItem(key: string): Promise<string | null> } = secureSessionStorage): Promise<string | null> {
  try {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const id = (JSON.parse(raw) as { user?: { id?: unknown } } | null)?.user?.id;
    return typeof id === 'string' && UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}
