import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegistrationStatusScreen } from '../RegistrationStatusScreen';
import { makeError } from '../../../lib/errors';

let mockRefresh: (() => void) | undefined;
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => ({ __esModule: true, default: (p: { onRefresh?: () => void }) => { mockRefresh = p.onRefresh; return null; } }));
const mockFetchReg = jest.fn();
const mockFetchElig = jest.fn();
const mockFetchGuardian = jest.fn();
jest.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1, getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} }));
jest.mock('../api', () => ({
  fetchRegistration: (...a: unknown[]) => mockFetchReg(...a),
  fetchEligibility: (...a: unknown[]) => mockFetchElig(...a),
  fetchGuardianRequest: (...a: unknown[]) => mockFetchGuardian(...a),
  cancelRegistration: jest.fn(),
  eventKeys: {
    registration: (id: string) => ['registrations', id], guardian: (id: string) => ['registrations', id, 'guardian'],
    eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u],
  },
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));

const REG = '11111111-1111-4111-8111-111111111111';
const event = { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person', type: 'workshop', organization: { id: 'o', name: 'Org', verification: 'verified' } };
const reg = (status: string) => ({ id: REG, user_id: 'u1', event_id: 'e1', status, created_at: '2026-11-01T10:00:00Z', event });
const elig = (guardian_required: boolean) => ({ event_id: 'e1', authenticated: true, eligible: true, reasons: [], guardian_required });
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const clients: QueryClient[] = [];
const renderScreen = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const props = { navigation: { navigate: jest.fn(), goBack: jest.fn() }, route: { params: { registrationId: REG } } } as unknown as React.ComponentProps<typeof RegistrationStatusScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><RegistrationStatusScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};

beforeEach(() => { mockFetchReg.mockReset(); mockFetchElig.mockReset(); mockFetchGuardian.mockReset(); mockFetchGuardian.mockResolvedValue(null); });
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); });

describe('guardian query follows the server', () => {
  it('an adult (guardian_required false) never triggers the guardian request and gets the 3-step line', async () => {
    mockFetchReg.mockResolvedValue(reg('confirmed')); mockFetchElig.mockResolvedValue(elig(false));
    await renderScreen();
    expect(await screen.findByText('Katılım kartı')).toBeTruthy();
    expect(screen.queryByText('Veli onayı')).toBeNull();
    expect(mockFetchGuardian).not.toHaveBeenCalled();
  });
  it('a confirmed minor (guardian_required true) queries the guardian request and keeps the guardian step', async () => {
    mockFetchReg.mockResolvedValue(reg('confirmed')); mockFetchElig.mockResolvedValue(elig(true));
    await renderScreen();
    expect(await screen.findByText('Veli onayı')).toBeTruthy();
    await waitFor(() => expect(mockFetchGuardian).toHaveBeenCalledTimes(1));
  });
  it('while eligibility is pending the line is a 4-step skeleton (no 3 to 4 layout shift)', async () => {
    mockFetchReg.mockResolvedValue(reg('confirmed')); mockFetchElig.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(await screen.findByTestId('timeline-skeleton')).toBeTruthy();
    expect(screen.getAllByTestId('timeline-skeleton-step')).toHaveLength(4);
  });
  it('a failed guardian query keeps the step and shows an inline retry that refetches', async () => {
    mockFetchReg.mockResolvedValue(reg('confirmed')); mockFetchElig.mockResolvedValue(elig(true));
    mockFetchGuardian.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    expect(await screen.findByText('Veli onayı')).toBeTruthy();
    const retry = await screen.findByText('Veli durumu alınamadı · Tekrar dene');
    mockFetchGuardian.mockResolvedValue({ status: 'approved' });
    const before = mockFetchGuardian.mock.calls.length;
    await act(async () => { fireEvent.press(retry); });
    await waitFor(() => expect(mockFetchGuardian.mock.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.queryByText('Veli durumu alınamadı · Tekrar dene')).toBeNull());
  });
  it('pull-to-refresh refetches the guardian request unconditionally (guardian required)', async () => {
    mockFetchReg.mockResolvedValue(reg('confirmed')); mockFetchElig.mockResolvedValue(elig(true));
    await renderScreen();
    await waitFor(() => expect(mockFetchGuardian).toHaveBeenCalledTimes(1));
    await act(async () => { mockRefresh?.(); });
    await waitFor(() => expect(mockFetchGuardian).toHaveBeenCalledTimes(2));
  });
});
