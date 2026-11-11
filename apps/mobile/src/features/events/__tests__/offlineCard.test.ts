import { clearCards, dropCard, fetchCardWithOfflineFallback, loadCard, saveCard } from '../offlineCard';
import { makeError } from '../../../lib/errors';
import type { ParticipationCard } from '../../../lib/database.types';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('bad key'); mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));
const mockFetch = jest.fn();
jest.mock('../api', () => ({ fetchParticipationCard: (...a: unknown[]) => mockFetch(...a) }));

const REG = '11111111-1111-4111-8111-111111111111';
const card: ParticipationCard = {
  registration_id: REG, status: 'confirmed',
  event: { id: 'e1', title: 'Robotik Günü', starts_at: '2026-12-01T07:00:00Z', ends_at: '2026-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' },
  holder_name: 'Ada Yılmaz', qr_payload: 'tok.sig', short_code: 'ABC123', valid_from: '2026-12-01T04:00:00Z', valid_until: '2026-12-01T12:00:00Z', checked_in_at: null,
};

beforeEach(() => { mockStore.clear(); mockFetch.mockReset(); });

describe('offline participation card store', () => {
  it('returns a saved card for the same user only', async () => {
    await saveCard('u1', card);
    expect((await loadCard('u1', REG))?.card).toEqual(card);
    expect(await loadCard('u2', REG)).toBeNull();
  });
  it('clearCards removes every saved card and the index', async () => {
    await saveCard('u1', card);
    await saveCard('u2', { ...card, registration_id: 'r2' });
    await clearCards();
    expect(await loadCard('u1', REG)).toBeNull();
    expect(await loadCard('u2', 'r2')).toBeNull();
    expect(mockStore.size).toBe(0);
  });
  it('dropCard removes one entry and keeps the others', async () => {
    await saveCard('u1', card);
    await saveCard('u1', { ...card, registration_id: 'r2' });
    await dropCard('u1', REG);
    expect(await loadCard('u1', REG)).toBeNull();
    expect(await loadCard('u1', 'r2')).not.toBeNull();
  });
  it('treats a corrupt or old-shape entry as missing and deletes it', async () => {
    await saveCard('u1', card);
    const key = [...mockStore.keys()].find((k) => k.startsWith('card.u1.'))!;
    mockStore.set(key, JSON.stringify({ card: { registration_id: REG }, savedAt: 'x' }));
    expect(await loadCard('u1', REG)).toBeNull();
    expect(mockStore.has(key)).toBe(false);
    mockStore.set(key, '{not json');
    expect(await loadCard('u1', REG)).toBeNull();
  });
});

describe('fetchCardWithOfflineFallback', () => {
  it('saves the fresh card after a successful fetch', async () => {
    mockFetch.mockResolvedValue(card);
    expect(await fetchCardWithOfflineFallback('u1', REG)).toEqual({ card, cachedAt: null });
    expect((await loadCard('u1', REG))?.card).toEqual(card);
  });
  it('falls back to the saved card with its time on a network error', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('network_unreachable', 0));
    const r = await fetchCardWithOfflineFallback('u1', REG);
    expect(r.card).toEqual(card);
    expect(r.cachedAt).toEqual(expect.any(String));
  });
  it('falls back on a 5xx', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('server_error', 503));
    expect((await fetchCardWithOfflineFallback('u1', REG)).cachedAt).not.toBeNull();
  });
  it('rethrows the network error when nothing is saved', async () => {
    mockFetch.mockRejectedValue(makeError('network_unreachable', 0));
    await expect(fetchCardWithOfflineFallback('u1', REG)).rejects.toMatchObject({ code: 'network_unreachable' });
  });
  it.each([[404, 'registration_not_found'], [409, 'registration_not_confirmed']])('drops the saved card and shows none on %s', async (status, code) => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError(code, status));
    await expect(fetchCardWithOfflineFallback('u1', REG)).rejects.toMatchObject({ code });
    expect(await loadCard('u1', REG)).toBeNull();
  });
  it('never shows a cached card on 401', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('auth_required', 401));
    await expect(fetchCardWithOfflineFallback('u1', REG)).rejects.toBeTruthy();
  });
});
