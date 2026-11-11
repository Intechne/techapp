import { env } from '../../lib/env';
import { readStoredSessionUserId, sessionStorageKey } from '../../lib/storedSession';
import { listCards, type SavedCard } from './offlineCard';

/**
 * Saved participation cards for the startup screen when the session cannot be restored (no network, expired access token).
 * The owner is the user id in the session stored on this device, read without network; it only scopes what was already
 * cached for that user here. No stored session, an unreadable one, or no cards → empty list.
 */
export async function loadStartupOfflineCards(): Promise<SavedCard[]> {
  if (!env.isConfigured) return [];
  const userId = await readStoredSessionUserId(sessionStorageKey(env.supabaseUrl));
  return userId ? listCards(userId) : [];
}
