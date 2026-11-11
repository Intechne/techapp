import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MyRegistrationsScreen } from '../MyRegistrationsScreen';
import { saveCard } from '../offlineCard';
import { makeError } from '../../../lib/errors';
import type { ParticipationCard } from '../../../lib/database.types';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));
const mockFetchMine = jest.fn();
jest.mock('../api', () => ({
  fetchMyRegistrations: (...a: unknown[]) => mockFetchMine(...a),
  fetchParticipationCard: jest.fn(),
  eventKeys: { myRegistrations: (u: string | null) => ['registrations', 'mine', u], card: (id: string) => ['registrations', id, 'card'] },
}));
let mockUser = 'u1';
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));

const REG = '11111111-1111-4111-8111-111111111111';
const card: ParticipationCard = {
  registration_id: REG, status: 'confirmed',
  event: { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' },
  holder_name: 'Ada Yılmaz', qr_payload: 'tok.sig', short_code: 'ABC123', valid_from: '2099-12-01T04:00:00Z', valid_until: '2099-12-01T12:00:00Z', checked_in_at: null,
};
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const navigate = jest.fn();
const renderScreen = async (seed?: () => unknown[], client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })) => {
  if (seed) client.setQueryData(['registrations', 'mine', 'u1'], seed());
  const props = { navigation: { navigate, goBack: jest.fn() }, route: { key: 'k', name: 'MyRegistrations' } } as unknown as React.ComponentProps<typeof MyRegistrationsScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><MyRegistrationsScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};

beforeEach(() => { mockStore.clear(); mockFetchMine.mockReset(); navigate.mockReset(); mockUser = 'u1'; });

describe('Katılımlarım after an offline cold start', () => {
  it('lists the user’s saved cards and opens the participation card on tap', async () => {
    await saveCard('u1', card);
    mockFetchMine.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    expect(await screen.findByText('Çevrimdışı · kayıtlı kartların')).toBeTruthy();
    expect(screen.getByText('Robotik Günü')).toBeTruthy();
    expect(screen.getByText(/^Son güncelleme: bugün \d{2}:\d{2}$/)).toBeTruthy();
    fireEvent.press(screen.getByText('Robotik Günü'));
    expect(navigate).toHaveBeenCalledWith('ParticipationCard', { registrationId: REG });
  });
  it('dates a card saved on an earlier day instead of showing only the time', async () => {
    await saveCard('u1', card, () => Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockFetchMine.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    expect(await screen.findByText(/^Son güncelleme: \d{1,2} \p{L}+( \d{4})?, \d{2}:\d{2}$/u)).toBeTruthy();
    expect(screen.queryByText(/bugün/)).toBeNull();
  });
  it('shows the honest error state when there are no saved cards', async () => {
    mockFetchMine.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    expect(await screen.findByText(/Bağlantı yok gibi/)).toBeTruthy();
    expect(screen.queryByText('Çevrimdışı · kayıtlı kartların')).toBeNull();
  });
  it('never shows another user’s saved cards', async () => {
    await saveCard('u2', card);
    mockFetchMine.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    expect(await screen.findByText(/Bağlantı yok gibi/)).toBeTruthy();
    expect(screen.queryByText('Robotik Günü')).toBeNull();
  });
  it('does not fall back to cached cards for a server verdict (contract mismatch / 4xx)', async () => {
    await saveCard('u1', card);
    mockFetchMine.mockRejectedValue(makeError('contract_mismatch', 500));
    await renderScreen();
    expect(await screen.findByText(/Uygulama ile sunucu uyumsuz/)).toBeTruthy();
    expect(screen.queryByText('Robotik Günü')).toBeNull();
  });
  it('with stale list data and no network: keeps the list and shows a small notice, not the saved-cards view', async () => {
    await saveCard('u1', card);
    mockFetchMine.mockRejectedValue(makeError('network_unreachable', 0));
    const item = { id: REG, status: 'confirmed', event: { id: 'e1', title: 'Eski Liste Etkinliği', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' } };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); // keeps the seeded list; no GC timer
    await renderScreen(() => [item], client);
    expect(await screen.findByText(/Liste en son yüklendiği hâliyle duruyor/)).toBeTruthy();
    expect(screen.getByText('Eski Liste Etkinliği')).toBeTruthy();
    expect(screen.queryByText('Çevrimdışı · kayıtlı kartların')).toBeNull();
    expect(screen.queryByText('Robotik Günü')).toBeNull();
    client.clear();
  });
});

describe('Katılımlarım · slow load shows saved cards without waiting for failure (M2)', () => {
  afterEach(async () => { await cleanup(); jest.useRealTimers(); }); // unmount under fake timers so nothing leaks into the next test
  const item = { id: REG, status: 'confirmed', event: { id: 'e1', title: 'Canlı Liste Etkinliği', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' } };
  const tick = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

  it('after ~3 s of loading, shows saved cards above the still-pending skeleton', async () => {
    await saveCard('u1', card);
    jest.useFakeTimers();
    mockFetchMine.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await tick(1000);
    expect(screen.queryByText('Kayıtlı kartların')).toBeNull();
    await tick(2500);
    expect(await screen.findByText('Kayıtlı kartların')).toBeTruthy();
    fireEvent.press(screen.getByText('Robotik Günü'));
    expect(navigate).toHaveBeenCalledWith('ParticipationCard', { registrationId: REG });
  });
  it('does not flash the saved section when the list arrives in under 3 s', async () => {
    await saveCard('u1', card);
    jest.useFakeTimers();
    let resolve!: (v: unknown[]) => void;
    mockFetchMine.mockReturnValue(new Promise((r) => { resolve = r; }));
    await renderScreen();
    await tick(1500);
    await act(async () => { resolve([item]); });
    await tick(3500);
    expect(screen.getByText('Canlı Liste Etkinliği')).toBeTruthy();
    expect(screen.queryByText('Kayıtlı kartların')).toBeNull();
    expect(screen.queryByText('Robotik Günü')).toBeNull();
  });
  it('replaces the saved section with the live list once it arrives', async () => {
    await saveCard('u1', card);
    jest.useFakeTimers();
    let resolve!: (v: unknown[]) => void;
    mockFetchMine.mockReturnValue(new Promise((r) => { resolve = r; }));
    await renderScreen();
    await tick(3500);
    expect(await screen.findByText('Kayıtlı kartların')).toBeTruthy();
    await act(async () => { resolve([item]); });
    await tick(10);
    expect(screen.getByText('Canlı Liste Etkinliği')).toBeTruthy();
    expect(screen.queryByText('Kayıtlı kartların')).toBeNull();
    expect(screen.queryByText('Robotik Günü')).toBeNull();
  });
  it('never shows another user’s cards while loading slowly', async () => {
    await saveCard('u2', card);
    jest.useFakeTimers();
    mockFetchMine.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    await tick(3500);
    expect(screen.queryByText('Robotik Günü')).toBeNull();
    expect(screen.queryByText('Kayıtlı kartların')).toBeNull();
  });

  it('hides the saved section and shows the error state for a non-network error after the 3 s window', async () => {
    await saveCard('u1', card);
    jest.useFakeTimers();
    let reject!: (e: unknown) => void;
    mockFetchMine.mockReturnValue(new Promise((_, r) => { reject = r; }));
    await renderScreen();
    await tick(3500);
    expect(await screen.findByText('Kayıtlı kartların')).toBeTruthy();
    await act(async () => { reject(makeError('contract_mismatch', 500)); });
    await tick(10);
    expect(screen.getByText(/Uygulama ile sunucu uyumsuz/)).toBeTruthy();
    expect(screen.queryByText('Kayıtlı kartların')).toBeNull();
    expect(screen.queryByText('Robotik Günü')).toBeNull();
  });
  it('after slow load then a non-network error, a retry does not make the saved section reappear instantly', async () => {
    await saveCard('u1', card);
    jest.useFakeTimers();
    let reject!: (e: unknown) => void;
    mockFetchMine.mockReturnValue(new Promise((_, r) => { reject = r; }));
    await renderScreen();
    await tick(3500);
    expect(await screen.findByText('Kayıtlı kartların')).toBeTruthy();
    await act(async () => { reject(makeError('contract_mismatch', 500)); });
    await tick(10);
    expect(screen.getByText(/Uygulama ile sunucu uyumsuz/)).toBeTruthy();
    mockFetchMine.mockReturnValue(new Promise(() => {}));
    await fireEvent.press(screen.getByText('Tekrar dene'));
    await tick(1000);
    expect(screen.queryByText('Robotik Günü')).toBeNull();
  });
  it('keeps saved cards visible while retrying after a network error', async () => {
    await saveCard('u1', card);
    jest.useFakeTimers();
    mockFetchMine.mockRejectedValueOnce(makeError('network_unreachable', 0));
    await renderScreen();
    await tick(10);
    expect(await screen.findByText('Çevrimdışı · kayıtlı kartların')).toBeTruthy();
    mockFetchMine.mockReturnValue(new Promise(() => {}));
    await fireEvent.press(screen.getByText('Tekrar dene'));
    await tick(10);
    expect(screen.getByText('Robotik Günü')).toBeTruthy();
    await tick(4000);
    expect(screen.getByText('Robotik Günü')).toBeTruthy();
  });
});
