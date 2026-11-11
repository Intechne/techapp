import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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
jest.mock('../api', () => ({ fetchParticipationCard: (...a: unknown[]) => mockFetch(...a), eventKeys: { card: (id: string) => ['registrations', id, 'card'] } }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
jest.mock('react-native-qrcode-svg', () => () => null);

const REG = '11111111-1111-4111-8111-111111111111';
const card: ParticipationCard = {
  registration_id: REG, status: 'confirmed',
  event: { id: 'e1', title: 'Robotik Günü', starts_at: '2026-12-01T07:00:00Z', ends_at: '2026-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person' },
  holder_name: 'Ada Yılmaz', qr_payload: 'tok.sig', short_code: 'ABC123', valid_from: '2026-12-01T04:00:00Z', valid_until: '2026-12-01T12:00:00Z', checked_in_at: null,
};
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const props = { navigation: { goBack: jest.fn() }, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof ParticipationCardScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ParticipationCardScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};

beforeEach(() => { mockStore.clear(); mockFetch.mockReset(); });

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
});
