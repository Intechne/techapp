import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '../../../design-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ParticipationCardScreen } from '../ParticipationCardScreen';
import { saveCard, loadCard } from '../offlineCard';
import { makeError } from '../../../lib/errors';
import type { ParticipationCard } from '../../../lib/database.types';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));
const mockFetch = jest.fn();
jest.mock('../api', () => ({ fetchParticipationCard: (...a: unknown[]) => mockFetch(...a), eventKeys: { card: (u: string | null, id: string) => ['registrations', id, 'card', u] } }));
let mockUser: string | null = 'u1';
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
jest.mock('react-native-qrcode-svg', () => () => null);

const REG = '11111111-1111-4111-8111-111111111111';
const card: ParticipationCard = {
  registration_id: REG, status: 'confirmed',
  event: { id: 'e1', title: 'Robotik Günü', starts_at: '2026-12-01T07:00:00Z', ends_at: '2026-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' },
  holder_name: 'Ada Yılmaz', qr_payload: 'tok.sig', short_code: 'ABC123', valid_from: '2026-12-01T04:00:00Z', valid_until: '2026-12-01T12:00:00Z', checked_in_at: null,
};
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () => {
  return renderWith();
};
const renderWith = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const props = { navigation: { goBack: jest.fn() }, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof ParticipationCardScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ParticipationCardScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};

beforeEach(() => { mockStore.clear(); mockFetch.mockReset(); mockUser = 'u1'; });

describe('ParticipationCardScreen offline behaviour', () => {
  it('shows the fresh card with the brightness hint and no offline label', async () => {
    mockFetch.mockResolvedValue(card);
    await renderScreen();
    expect(await screen.findByText('Robotik Günü')).toBeTruthy();
    expect(screen.getByText('Ekran parlaklığını artırırsan kod daha hızlı okunur.')).toBeTruthy();
    expect(screen.queryByText(/çevrimdışı/)).toBeNull();
  });
  it('shows the saved card with an offline label when the network fails', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    expect(await screen.findByText('Robotik Günü')).toBeTruthy();
    expect(screen.getByText(/^Son güncelleme: bugün \d{2}:\d{2} · çevrimdışı$/)).toBeTruthy();
  });
  it('drops the saved card and shows none when the server says it is no longer valid', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('registration_not_confirmed', 409));
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Katılım kartı, kaydın onaylandığında hazır olacak.')).toBeTruthy());
    expect(screen.queryByText('Robotik Günü')).toBeNull();
    expect(await loadCard('u1', REG)).toBeNull();
  });
  it('finds the saved card on first load even when the session arrives late', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('network_unreachable', 0));
    mockUser = null;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const props = { navigation: { goBack: jest.fn() }, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof ParticipationCardScreen>;
    const ui = () => <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ParticipationCardScreen {...props} /></QueryClientProvider></SafeAreaProvider>;
    const view = await render(ui());
    await waitFor(() => expect(screen.queryByText('Robotik Günü')).toBeNull());
    mockUser = 'u1';
    await view.rerender(ui());
    expect(await screen.findByText('Robotik Günü')).toBeTruthy();
    expect(screen.getByText(/çevrimdışı$/)).toBeTruthy();
  });
});

describe('ParticipationCardView visual contract', () => {
  it('the short code uses tabular numbers and the title size', async () => {
    mockFetch.mockResolvedValue(card);
    await renderScreen();
    await screen.findByText('Robotik Günü');
    const code = StyleSheet.flatten(screen.getByTestId('short-code').props.style);
    expect(screen.getByTestId('short-code').props.children).toBe('ABC123');
    expect(code.fontVariant).toEqual(['tabular-nums']);
    expect(code.fontSize).toBe(24);
  });
  it('the offline label is neutral (ink, white text, offline icon) — apricot stays for deadlines (Q1)', async () => {
    await saveCard('u1', card);
    mockFetch.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    const label = await screen.findByTestId('offline-label');
    expect(StyleSheet.flatten(label.props.style).backgroundColor).toBe(colors.ink);
    expect(screen.getByTestId('offline-label-icon-offline')).toBeTruthy();
    const text = screen.getByText(/^Son güncelleme: bugün \d{2}:\d{2} · çevrimdışı$/);
    expect(StyleSheet.flatten(text.props.style).color).toBe(colors.white);
  });
});
