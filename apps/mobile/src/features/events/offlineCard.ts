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

/** Index mutations run one at a time so overlapping saves/drops cannot lose an entry. */
let queue: Promise<unknown> = Promise.resolve();
const serialised = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

const EXPIRY_GRACE_MS = 12 * 60 * 60 * 1000;
/** A card is useless after `valid_until`; if that is unusable, 12 h after the event ends. */
export function isExpired(card: ParticipationCard, now: number): boolean {
  const validUntil = Date.parse(card.valid_until);
  if (Number.isFinite(validUntil)) return now > validUntil;
  const ends = Date.parse(card.event.ends_at);
  return !Number.isFinite(ends) || now > ends + EXPIRY_GRACE_MS;
}

function parseEntry(raw: string | null): { card: ParticipationCard; savedAt: string } | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as { card?: unknown; savedAt?: unknown };
    const card = participationCardSchema.safeParse(value.card);
    return card.success && typeof value.savedAt === 'string' ? { card: card.data, savedAt: value.savedAt } : null;
  } catch { return null; }
}

export function saveCard(userId: string, card: ParticipationCard, now: () => number = Date.now): Promise<void> {
  if (!enabled()) return Promise.resolve();
  return serialised(async () => {
    const key = keyOf(userId, card.registration_id);
    let index = await readIndex();
    // Opportunistic prune of expired / unreadable entries.
    const kept: string[] = [];
    for (const k of index) {
      if (k === key) { kept.push(k); continue; }
      const entry = parseEntry(await SecureStore.getItemAsync(k, options).catch(() => null));
      if (entry && !isExpired(entry.card, now())) kept.push(k);
      else await SecureStore.deleteItemAsync(k, options).catch(() => {});
    }
    index = kept.includes(key) ? kept : [...kept, key];
    await writeIndex(index); // index first: a crash leaves at worst an entry pointing at nothing
    await SecureStore.setItemAsync(key, JSON.stringify({ card, savedAt: new Date(now()).toISOString() }), options);
  });
}

export async function loadCard(userId: string, registrationId: string, now: () => number = Date.now): Promise<{ card: ParticipationCard; savedAt: string } | null> {
  if (!enabled()) return null;
  const key = keyOf(userId, registrationId);
  let raw: string | null;
  try { raw = await SecureStore.getItemAsync(key, options); } catch { return null; }
  if (raw === null) return null;
  const entry = parseEntry(raw);
  if (entry && entry.card.registration_id === registrationId && !isExpired(entry.card, now())) return entry;
  await dropCard(userId, registrationId).catch(() => {});
  return null;
}

/**
 * Every saved card of this user that is still valid, for a cold start without network. Expired and unreadable entries are
 * deleted on the way; other users' entries are never read or returned. Soonest event first.
 */
export interface SavedCard { registrationId: string; card: ParticipationCard; savedAt: string }

export function listCards(userId: string, now: Date = new Date()): Promise<SavedCard[]> {
  if (!enabled()) return Promise.resolve([]);
  return serialised(async () => {
    const prefix = `card.${safe(userId)}.`;
    const index = await readIndex();
    const kept: string[] = [];
    const found: SavedCard[] = [];
    for (const key of index) {
      if (!key.startsWith(prefix)) { kept.push(key); continue; }
      let raw: string | null = null;
      try { raw = await SecureStore.getItemAsync(key, options); } catch { kept.push(key); continue; } // unreadable now: keep, skip
      const entry = parseEntry(raw);
      if (entry && key === keyOf(userId, entry.card.registration_id) && !isExpired(entry.card, now.getTime())) {
        kept.push(key);
        found.push({ registrationId: entry.card.registration_id, card: entry.card, savedAt: entry.savedAt });
      } else await SecureStore.deleteItemAsync(key, options).catch(() => {});
    }
    if (kept.length !== index.length) await writeIndex(kept).catch(() => {});
    return found.sort((a, b) => a.card.event.starts_at.localeCompare(b.card.event.starts_at));
  });
}

export function dropCard(userId: string, registrationId: string): Promise<void> {
  if (!enabled()) return Promise.resolve();
  return serialised(async () => {
    const key = keyOf(userId, registrationId);
    await SecureStore.deleteItemAsync(key, options);
    const index = await readIndex();
    if (index.includes(key)) await writeIndex(index.filter((k) => k !== key));
  });
}

/**
 * Drops the saved cards of these registrations if any are stored: the client learned they are no longer confirmed (cancelled,
 * rejected, expired …), so an offline copy would show a QR that the gate will refuse. Only indexed entries are touched.
 */
export function dropCards(userId: string, registrationIds: string[]): Promise<void> {
  if (!enabled() || registrationIds.length === 0) return Promise.resolve();
  return serialised(async () => {
    const doomed = new Set(registrationIds.map((id) => keyOf(userId, id)));
    const index = await readIndex();
    const kept = index.filter((k) => !doomed.has(k));
    if (kept.length === index.length) return;
    await Promise.all(index.filter((k) => doomed.has(k)).map((k) => SecureStore.deleteItemAsync(k, options).catch(() => {})));
    await writeIndex(kept);
  });
}

/**
 * Keeps only this user's saved cards. Run when a launch restore settles signed in: any other identity's entry on this device
 * (left from before an uninstall, or from a startup where a different session was stored) goes, so the store never holds
 * more than the current holder's tickets.
 */
export function keepOnlyCardsOf(userId: string): Promise<void> {
  if (!enabled()) return Promise.resolve();
  return serialised(async () => {
    const prefix = `card.${safe(userId)}.`;
    const index = await readIndex();
    const kept = index.filter((k) => k.startsWith(prefix));
    if (kept.length === index.length) return;
    await Promise.all(index.filter((k) => !k.startsWith(prefix)).map((k) => SecureStore.deleteItemAsync(k, options).catch(() => {})));
    await writeIndex(kept);
  });
}

export function clearCards(): Promise<void> {
  if (!enabled()) return Promise.resolve();
  return serialised(async () => {
    const index = await readIndex();
    await Promise.all(index.map((k) => SecureStore.deleteItemAsync(k, options).catch(() => {})));
    await SecureStore.deleteItemAsync(INDEX_KEY, options);
  });
}

export interface CardResult { card: ParticipationCard; /** ISO time of the cached copy; null when the card is fresh from the server. */ cachedAt: string | null }

/** Same rule everywhere an offline copy may stand in: unreachable server / timeout / 429 / 5xx, never a contract mismatch. */
export function isNetworkClassError(e: unknown): boolean {
  const error = toAppError(e);
  return (error.code === 'network_unreachable' || error.status === 429 || error.status >= 500) && error.code !== 'contract_mismatch';
}

/**
 * Fresh card when the server answers (and saved for offline use). Only an unreachable server / timeout / 429 / 5xx falls back to
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
    if (userId && isNetworkClassError(error)) {
      const cached = await loadCard(userId, registrationId);
      if (cached) return { card: cached.card, cachedAt: cached.savedAt };
    }
    throw e;
  }
}
