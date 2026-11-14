import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegistrationStatusScreen } from '../RegistrationStatusScreen';

const mockFetchReg = jest.fn();
jest.mock('../api', () => ({
  fetchRegistration: (...a: unknown[]) => mockFetchReg(...a),
  cancelRegistration: jest.fn(),
  fetchGuardianRequest: async () => null,
  fetchEligibility: async () => ({ event_id: 'e1', authenticated: true, eligible: true, reasons: [], guardian_required: false }),
  eventKeys: {
    registration: (id: string) => ['registrations', id], guardian: (id: string) => ['registrations', id, 'guardian'],
    eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u],
  },
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
jest.mock('../offlineCard', () => ({ dropCard: async () => {}, dropCards: async () => {} }));
jest.mock('../../../lib/haptics', () => ({ haptics: { success: jest.fn(), warning: jest.fn(), error: jest.fn(), selection: jest.fn() } }));
const H = jest.requireMock('../../../lib/haptics').haptics as Record<'success' | 'warning' | 'error' | 'selection', jest.Mock>;

const event = { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person', type: 'workshop', organization: { id: 'o', name: 'Org', verification: 'verified' } };
const row = (status: string) => ({ id: 'r1', user_id: 'u1', event_id: 'e1', status, created_at: '2026-11-01T10:00:00Z', event });
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const nav = { navigate: jest.fn(), goBack: jest.fn() };
const clients: QueryClient[] = [];
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); });
const el = (fresh: boolean | undefined, client: QueryClient) => (
  <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>
    <RegistrationStatusScreen {...({ navigation: nav, route: { params: { registrationId: 'r1', fresh } } } as unknown as React.ComponentProps<typeof RegistrationStatusScreen>)} />
  </QueryClientProvider></SafeAreaProvider>
);
const mount = async (fresh: boolean | undefined) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const r = await render(el(fresh, client));
  await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
  return { ...r, client };
};
beforeEach(() => { jest.clearAllMocks(); mockFetchReg.mockReset(); });

describe('registration status: the first confirmed view celebrates once', () => {
  it('fresh + confirmed: SuccessMark and one success haptic; a refetch or re-render does not repeat it', async () => {
    mockFetchReg.mockResolvedValue(row('confirmed'));
    const { rerender, client } = await mount(true);
    expect(await screen.findByText('Yerini ayırdık.')).toBeTruthy();
    expect(screen.getByTestId('success-mark')).toBeTruthy();
    expect(H.success).toHaveBeenCalledTimes(1);
    await act(async () => { await client.invalidateQueries({ queryKey: ['registrations'] }); });
    await rerender(el(true, client));
    expect(H.success).toHaveBeenCalledTimes(1);
  });
  it('not fresh (opened from a list): no mark, no haptic', async () => {
    mockFetchReg.mockResolvedValue(row('confirmed'));
    await mount(undefined);
    expect(await screen.findByText('Yerini ayırdık.')).toBeTruthy();
    expect(screen.queryByTestId('success-mark')).toBeNull();
    expect(H.success).not.toHaveBeenCalled();
  });
  it('fresh + waitlisted: a warning, never success, no success mark', async () => {
    mockFetchReg.mockResolvedValue(row('waitlisted'));
    await mount(true);
    expect(await screen.findByText('Bekleme listesindesin.')).toBeTruthy();
    expect(H.warning).toHaveBeenCalledTimes(1);
    expect(H.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('success-mark')).toBeNull();
  });
  it('fresh + pending guardian: no haptic at all', async () => {
    mockFetchReg.mockResolvedValue(row('pending_guardian'));
    await mount(true);
    expect(await screen.findByText('Veli onayı bekleniyor.')).toBeTruthy();
    expect(H.success).not.toHaveBeenCalled();
    expect(H.warning).not.toHaveBeenCalled();
  });
});
