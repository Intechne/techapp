import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createClient } from '@supabase/supabase-js';
import { StartupUnavailableScreen } from '../StartupUnavailableScreen';
import { keepOnlyCardsOf, listCards, saveCard } from '../../events/offlineCard';
import { secureSessionStorage } from '../../../lib/secureSessionStorage';
import { readStoredSessionUserId, sessionStorageKey } from '../../../lib/storedSession';
import type { ParticipationCard } from '../../../lib/database.types';

// One SecureStore for both the chunked session storage and the card store, as on a device.
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));
const URL_ = 'https://abcdefghijklmnopqrst.supabase.co';
jest.mock('../../../lib/env', () => ({ env: { isConfigured: true, supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co' } }));
jest.mock('../../events/api', () => ({ fetchParticipationCard: jest.fn() }));
jest.mock('react-native-qrcode-svg', () => () => null);

const UA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REG = '11111111-1111-4111-8111-111111111111';
const card: ParticipationCard = {
  registration_id: REG, status: 'confirmed',
  event: { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' },
  holder_name: 'Ada Yılmaz', qr_payload: 'tok.sig', short_code: 'ABC123', valid_from: '2099-12-01T04:00:00Z', valid_until: '2099-12-01T12:00:00Z', checked_in_at: null,
};
const KEY = sessionStorageKey(URL_);
/** What supabase-js leaves behind: an access token long expired (refresh would need the network), the user object inside. */
const storeSession = (userId: string) =>
  secureSessionStorage.setItem(KEY, JSON.stringify({ access_token: 'expired.jwt', refresh_token: 'r', expires_at: 1_700_000_000, user: { id: userId, email: 'x@example.com' } }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () => {
  const onRetry = jest.fn();
  await render(<SafeAreaProvider initialMetrics={metrics}><StartupUnavailableScreen reason="offline" onRetry={onRetry} /></SafeAreaProvider>);
  return onRetry;
};
/** Let the mount-time load settle, then assert the section is absent. */
const expectNoSavedSection = async () => {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeTruthy());
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByText('Çevrimdışı · kayıtlı kartların')).toBeNull();
  expect(screen.queryByText('Robotik Günü')).toBeNull();
};

beforeEach(() => mockStore.clear());

describe('stored session user id (no network)', () => {
  it('uses the same storage key supabase-js derives', () => {
    const client = createClient(URL_, 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false } });
    expect((client.auth as unknown as { storageKey: string }).storageKey).toBe(KEY);
    expect(sessionStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  });
  it('reads only a well-formed user.id and never throws', async () => {
    await storeSession(UA);
    expect(await readStoredSessionUserId(KEY)).toBe(UA);
    await secureSessionStorage.setItem(KEY, JSON.stringify({ user: { id: '../card.index' } }));
    expect(await readStoredSessionUserId(KEY)).toBeNull();
    await secureSessionStorage.setItem(KEY, '{not json');
    expect(await readStoredSessionUserId(KEY)).toBeNull();
    await secureSessionStorage.removeItem(KEY);
    expect(await readStoredSessionUserId(KEY)).toBeNull();
  });
});

describe('StartupUnavailableScreen saved cards (restore unavailable, token expired)', () => {
  it('lists the stored user’s saved cards and opens one read-only, then goes back', async () => {
    await storeSession(UA);
    await saveCard(UA, card);
    const onRetry = await renderScreen();
    expect(await screen.findByText('Çevrimdışı · kayıtlı kartların')).toBeTruthy();
    expect(screen.getByText(/^Son güncelleme: bugün \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeTruthy();
    await fireEvent.press(screen.getByText('Robotik Günü'));
    expect(await screen.findByText('Ada Yılmaz')).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByText(/^Son güncelleme: bugün \d{2}:\d{2} · çevrimdışı$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Geri' }));
    expect(await screen.findByText('Çevrimdışı · kayıtlı kartların')).toBeTruthy();
    expect(onRetry).not.toHaveBeenCalled();
  });
  it('without a stored session the screen is unchanged, even if cards exist', async () => {
    await saveCard(UA, card);
    await renderScreen();
    await expectNoSavedSection();
    expect(screen.getByText('İnternet bağlantın yok gibi görünüyor.')).toBeTruthy();
  });
  it('a stored session for user A never shows user B’s cards', async () => {
    await storeSession(UA);
    await saveCard(UB, card);
    await renderScreen();
    await expectNoSavedSection();
  });
  it('does not show an expired card (and deletes it)', async () => {
    await storeSession(UA);
    await saveCard(UA, { ...card, valid_until: '2020-01-01T00:00:00Z' }, () => Date.parse('2019-12-31T00:00:00Z'));
    await renderScreen();
    await expectNoSavedSection();
    expect([...mockStore.keys()].some((k) => k.startsWith(`card.${UA}.`))).toBe(false);
  });
});

describe('keepOnlyCardsOf (restore settled signed in)', () => {
  it('drops other users’ cards and keeps the restored user’s', async () => {
    await saveCard(UA, card);
    await saveCard(UB, { ...card, registration_id: 'r2' });
    await keepOnlyCardsOf(UB);
    expect(await listCards(UA)).toEqual([]);
    expect((await listCards(UB)).map((c) => c.registrationId)).toEqual(['r2']);
  });
});
