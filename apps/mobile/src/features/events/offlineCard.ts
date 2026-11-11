import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { participationCardSchema, type ParticipationCard } from '../../lib/database.types';
import { toAppError } from '../../lib/errors';
import { fetchParticipationCard } from './api';

/**
 * Offline copy of the participation card so it opens at a venue with poor reception. Lives in Keychain / Keystore only
 * (the holder's own name + an opaque signed QR token), is wiped when the signed-in identity ends, and is never logged
 * or sent to analytics. Web has no SecureStore: every function is a no-op there.
 */
const INDEX_KEY = 'card.index';
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const enabled = () => Platform.OS !== 'web';
const safe = (part: string) => part.replace(/[^A-Za-z0-9._-]/g, '_');
const keyOf = (userId: string, registrationId: string) => `card.${safe(userId)}.${safe(registrationId)}`;

async function readIndex(): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await SecureStore.getItemAsync(INDEX_KEY, options)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch { return []; }
}
const writeIndex = (keys: string[]) => keys.length
  ? SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(keys), options)
  : SecureStore.deleteItemAsync(INDEX_KEY, options);

export async function saveCard(userId: string, card: ParticipationCard): Promise<void> {
  if (!enabled()) return;
  const key = keyOf(userId, card.registration_id);
  await SecureStore.setItemAsync(key, JSON.stringify({ card, savedAt: new Date().toISOString() }), options);
  const index = await readIndex();
  if (!index.includes(key)) await writeIndex([...index, key]);
}

export async function loadCard(userId: string, registrationId: string): Promise<{ card: ParticipationCard; savedAt: string } | null> {
  if (!enabled()) return null;
  const key = keyOf(userId, registrationId);
  try {
    const raw = await SecureStore.getItemAsync(key, options);
    if (raw === null) return null;
    const value = JSON.parse(raw) as { card?: unknown; savedAt?: unknown };
    const card = participationCardSchema.safeParse(value.card);
    if (card.success && typeof value.savedAt === 'string' && card.data.registration_id === registrationId) return { card: card.data, savedAt: value.savedAt };
  } catch { /* corrupt entry: dropped below */ }
  await dropCard(userId, registrationId).catch(() => {});
  return null;
}

export async function dropCard(userId: string, registrationId: string): Promise<void> {
  if (!enabled()) return;
  const key = keyOf(userId, registrationId);
  await SecureStore.deleteItemAsync(key, options);
  const index = await readIndex();
  if (index.includes(key)) await writeIndex(index.filter((k) => k !== key));
}

export async function clearCards(): Promise<void> {
  if (!enabled()) return;
  const index = await readIndex();
  await Promise.all(index.map((k) => SecureStore.deleteItemAsync(k, options).catch(() => {})));
  await SecureStore.deleteItemAsync(INDEX_KEY, options);
}

export interface CardResult { card: ParticipationCard; /** ISO time of the cached copy; null when the card is fresh from the server. */ cachedAt: string | null }

/**
 * Fresh card when the server answers (and saved for offline use). Only an unreachable server / 5xx / timeout falls back to
 * the saved copy. A server verdict (not found, not confirmed, signed out) never shows a cached card; 404/409 also drop it.
 */
export async function fetchCardWithOfflineFallback(userId: string | null, registrationId: string): Promise<CardResult> {
  try {
    const card = await fetchParticipationCard(registrationId);
    if (userId) await saveCard(userId, card).catch(() => {});
    return { card, cachedAt: null };
  } catch (e) {
    const error = toAppError(e);
    if (userId && (error.status === 404 || (error.status === 409 && error.code === 'registration_not_confirmed'))) {
      await dropCard(userId, registrationId).catch(() => {});
      throw e;
    }
    if (userId && (error.retryable || error.status === 0)) {
      const cached = await loadCard(userId, registrationId);
      if (cached) return { card: cached.card, cachedAt: cached.savedAt };
    }
    throw e;
  }
}
