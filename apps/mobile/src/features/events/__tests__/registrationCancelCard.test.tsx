import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegistrationStatusScreen } from '../RegistrationStatusScreen';
import { MyRegistrationsScreen } from '../MyRegistrationsScreen';
import { listCards, saveCard } from '../offlineCard';
import type { ParticipationCard } from '../../../lib/database.types';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
}));
const mockFetchReg = jest.fn();
const mockCancel = jest.fn();
const mockFetchMine = jest.fn();
jest.mock('../api', () => ({
  fetchRegistration: (...a: unknown[]) => mockFetchReg(...a),
  cancelRegistration: (...a: unknown[]) => mockCancel(...a),
  fetchGuardianRequest: async () => null,
  fetchEligibility: async () => ({ event_id: 'e1', authenticated: true, eligible: true, reasons: [], guardian_required: false }),
  fetchMyRegistrations: (...a: unknown[]) => mockFetchMine(...a),
  fetchParticipationCard: jest.fn(),
  eventKeys: {
    registration: (id: string) => ['registrations', id], guardian: (id: string) => ['registrations', id, 'guardian'],
    eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u],
    myRegistrations: (u: string | null) => ['registrations', 'mine', u], card: (u: string | null, id: string) => ['registrations', id, 'card', u],
  },
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));

const REG = '11111111-1111-4111-8111-111111111111';
const REG2 = '22222222-2222-4222-8222-222222222222';
const event = { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person', type: 'workshop', organization: { id: 'o', name: 'Org', verification: 'verified' } };
const card = (id: string): ParticipationCard => ({
  registration_id: id, status: 'confirmed', event,
  holder_name: 'Ada Yılmaz', qr_payload: 'tok.sig', short_code: 'ABC123', valid_from: '2099-12-01T04:00:00Z', valid_until: '2099-12-01T12:00:00Z', checked_in_at: null,
} as ParticipationCard);
const row = (id: string, status: string) => ({ id, user_id: 'u1', event_id: 'e1', status, created_at: '2026-11-01T10:00:00Z', event });
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>;
};
const clients: QueryClient[] = [];
const nav = { navigate: jest.fn(), goBack: jest.fn() };
const ids = async () => (await listCards('u1')).map((c) => c.registrationId);

beforeEach(() => { mockStore.clear(); mockFetchReg.mockReset(); mockCancel.mockReset(); mockFetchMine.mockReset(); });
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); });

describe('a registration that is no longer confirmed loses its offline card', () => {
  it('cancelling drops the saved card (others stay)', async () => {
    await saveCard('u1', card(REG));
    await saveCard('u1', card(REG2));
    mockFetchReg.mockResolvedValue(row(REG, 'confirmed'));
    mockCancel.mockResolvedValue(row(REG, 'cancelled'));
    const props = { navigation: nav, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof RegistrationStatusScreen>;
    await render(wrap(<RegistrationStatusScreen {...props} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Kaydımı iptal et' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Evet, iptal et' }));
    await waitFor(() => expect(mockCancel).toHaveBeenCalled());
    await waitFor(async () => expect(await ids()).toEqual([REG2]));
  });
  it('a failed cancel keeps the card', async () => {
    await saveCard('u1', card(REG));
    mockFetchReg.mockResolvedValue(row(REG, 'confirmed'));
    mockCancel.mockRejectedValue(Object.assign(new Error('x'), { code: 'network_unreachable', status: 0 }));
    const props = { navigation: nav, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof RegistrationStatusScreen>;
    await render(wrap(<RegistrationStatusScreen {...props} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Kaydımı iptal et' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Evet, iptal et' }));
    await waitFor(() => expect(mockCancel).toHaveBeenCalled());
    expect(await ids()).toEqual([REG]);
  });
  it('opening a registration the server reports as cancelled drops its card', async () => {
    await saveCard('u1', card(REG));
    mockFetchReg.mockResolvedValue(row(REG, 'cancelled'));
    const props = { navigation: nav, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof RegistrationStatusScreen>;
    await render(wrap(<RegistrationStatusScreen {...props} />));
    expect(await screen.findByText('Bu kayıt iptal edildi.')).toBeTruthy();
    await waitFor(async () => expect(await ids()).toEqual([]));
  });
  it('Katılımlarım drops cards whose registration the server lists as not confirmed', async () => {
    await saveCard('u1', card(REG));
    await saveCard('u1', card(REG2));
    mockFetchMine.mockResolvedValue([row(REG, 'rejected'), row(REG2, 'confirmed')]);
    const props = { navigation: nav, route: { key: 'k', name: 'MyRegistrations' } } as unknown as React.ComponentProps<typeof MyRegistrationsScreen>;
    await render(wrap(<MyRegistrationsScreen {...props} />));
    expect((await screen.findAllByText('Robotik Günü')).length).toBe(2);
    await waitFor(async () => expect(await ids()).toEqual([REG2]));
  });
});
