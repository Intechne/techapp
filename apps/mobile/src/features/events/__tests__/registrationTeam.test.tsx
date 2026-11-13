import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegistrationStatusScreen } from '../RegistrationStatusScreen';
import { MyRegistrationsScreen } from '../MyRegistrationsScreen';

let mockFlag = true;
jest.mock('../../../lib/features', () => ({ features: { get teamRegistration() { return mockFlag; } } }));
const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));

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

const event = { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person', type: 'workshop', organization: { id: 'o', name: 'Org', verification: 'verified' } };
const row = (status: string, team: string | null = null) => ({ id: 'r1', user_id: 'u1', event_id: 'e1', status, team_registration_id: team, created_at: '2026-11-01T10:00:00Z', event });
const detail = (status: string) => ({
  id: 'tr1', status, hold_expires_at: '2099-11-10T07:00:00Z', roster_version: 1, can_edit: false, event: { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z' },
  team: { id: 't1', name: 'Dişli Kafalar' }, members: [],
});
const invite = { member_id: 'm1', team_registration_id: 'tr1', state: 'invited', team_status: 'pending_members', hold_expires_at: null, event: { id: 'e1', title: 'Robotik Günü', starts_at: '2099-12-01T07:00:00Z' }, team: { id: 't1', name: 'Dişli Kafalar' } };
let mockTeamStatus = 'pending_members';
let mockInvites: unknown[] = [];

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const nav = { navigate: jest.fn(), goBack: jest.fn() };
const clients: QueryClient[] = [];
async function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>);
}
const statusProps = { navigation: nav, route: { key: 'k', name: 'RegistrationStatus', params: { registrationId: 'r1' } } } as unknown as React.ComponentProps<typeof RegistrationStatusScreen>;
const listProps = { navigation: nav, route: { key: 'k', name: 'MyRegistrations' } } as unknown as React.ComponentProps<typeof MyRegistrationsScreen>;
/** Structure of a rendered tree: element types, roles, labels and texts (props hold React contexts, which cannot be serialised). */
type Node = { type: string; props?: Record<string, unknown>; children?: (Node | string)[] | null };
const shape = (n: Node | string | (Node | string)[] | null): unknown => {
  if (n === null) return null;
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(shape);
  const { accessibilityRole, accessibilityLabel, testID } = (n.props ?? {}) as Record<string, unknown>;
  return [n.type, accessibilityRole, accessibilityLabel, testID, (n.children ?? []).map(shape)];
};
const settled = () => waitFor(() => expect(screen.queryByTestId('timeline-skeleton')).toBeNull());
const rpcNames = () => mockRpc.mock.calls.map((c) => c[0]);

beforeEach(() => {
  mockFlag = true; mockTeamStatus = 'pending_members'; mockInvites = [];
  mockFetchReg.mockReset(); mockCancel.mockReset(); mockFetchMine.mockReset(); mockRpc.mockReset(); nav.navigate.mockClear();
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'team_registration_detail') return { data: detail(mockTeamStatus), error: null };
    if (name === 'my_team_registration_invites') return { data: mockInvites, error: null };
    return { data: null, error: null };
  });
});
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); });

describe('Katılımlarım · Takım davetleri', () => {
  it('shows the section only when there is an invite; a row opens the invite screen', async () => {
    mockFetchMine.mockResolvedValue([row('confirmed')]);
    mockInvites = [invite];
    await renderUi(<MyRegistrationsScreen {...listProps} />);
    expect(await screen.findByText('Takım davetleri')).toBeTruthy();
    expect(screen.getByText(/Dişli Kafalar/)).toBeTruthy();
    await fireEvent.press(screen.getByText(/Dişli Kafalar/));
    expect(nav.navigate).toHaveBeenCalledWith('TeamInvite', { memberId: 'm1' });
  });

  it('no invite → no section', async () => {
    mockFetchMine.mockResolvedValue([row('confirmed')]);
    await renderUi(<MyRegistrationsScreen {...listProps} />);
    await screen.findByText(/KATILIMIN.ONAYLANDI/);
    await waitFor(() => expect(rpcNames()).toContain('my_team_registration_invites'));
    expect(screen.queryByText('Takım davetleri')).toBeNull();
  });

  it('flag off → the invite RPC is never called and no section shows', async () => {
    mockFlag = false; mockInvites = [invite];
    mockFetchMine.mockResolvedValue([row('confirmed')]);
    await renderUi(<MyRegistrationsScreen {...listProps} />);
    await screen.findByText(/KATILIMIN.ONAYLANDI/);
    expect(rpcNames()).not.toContain('my_team_registration_invites');
    expect(screen.queryByText('Takım davetleri')).toBeNull();
  });
});

describe('Kayıt durumu · takıma bağlı kayıt', () => {
  it('shows "Takımın: <ad> · <durum>" and, until the team is confirmed, the waiting sentence instead of the card button', async () => {
    mockFetchReg.mockResolvedValue(row('confirmed', 'tr1'));
    await renderUi(<RegistrationStatusScreen {...statusProps} />);
    expect(await screen.findByText('Takımın: Dişli Kafalar · üyeler bekleniyor')).toBeTruthy();
    expect(screen.getByText('Takımın tamamlanınca kartın açılır')).toBeTruthy();
    expect(screen.queryByText('Katılım kartını göster')).toBeNull();
    expect(screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled)).toHaveLength(0);
  });

  it('team confirmed → the card button is back', async () => {
    mockTeamStatus = 'confirmed';
    mockFetchReg.mockResolvedValue(row('confirmed', 'tr1'));
    await renderUi(<RegistrationStatusScreen {...statusProps} />);
    expect(await screen.findByText('Takımın: Dişli Kafalar · onaylandı')).toBeTruthy();
    expect(screen.getByText('Katılım kartını göster')).toBeTruthy();
    expect(screen.queryByText('Takımın tamamlanınca kartın açılır')).toBeNull();
  });

  it('the cancel action is "Takımdan çekil" and its confirm explains the team effect, no names', async () => {
    mockFetchReg.mockResolvedValue(row('confirmed', 'tr1'));
    await renderUi(<RegistrationStatusScreen {...statusProps} />);
    await fireEvent.press(await screen.findByText('Takımdan çekil'));
    expect(await screen.findByText('Takımdan çekilelim mi?')).toBeTruthy();
    expect(screen.getByText(/Takımın yeniden üye bekler duruma döner/)).toBeTruthy();
    expect(mockCancel).not.toHaveBeenCalled();
    mockCancel.mockResolvedValue({});
    await fireEvent.press(screen.getByText('Evet, çekil'));
    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(screen.queryByText('Takımdan çekilelim mi?')).toBeNull());
  });

  it('flag off: a team-linked row reads like an individual one and no team RPC is called', async () => {
    mockFlag = false;
    mockFetchReg.mockResolvedValue(row('confirmed', 'tr1'));
    await renderUi(<RegistrationStatusScreen {...statusProps} />);
    expect(await screen.findByText('Katılım kartını göster')).toBeTruthy();
    expect(screen.getByText('Kaydımı iptal et')).toBeTruthy();
    expect(screen.queryByText(/Takımın:/)).toBeNull();
    expect(rpcNames()).not.toContain('team_registration_detail');
  });
});

describe('Kayıt durumu · bireysel kayıt bayrakla değişmez (pilot ekranı)', () => {
  const STATUSES = ['confirmed', 'pending_guardian', 'waitlisted', 'cancelled'];
  const shapes: Record<string, string> = {};
  const capture = async (status: string, flag: boolean) => {
    mockFlag = flag;
    mockFetchReg.mockResolvedValue(row(status));
    const view = await renderUi(<RegistrationStatusScreen {...statusProps} />);
    await screen.findByText('Kayıt durumu'); await settled();
    shapes[`${status}:${flag}`] = JSON.stringify(shape(view.toJSON() as never));
    expect(rpcNames()).not.toContain('team_registration_detail');
  };
  it.each(STATUSES)('%s: tree with the flag off', (status) => capture(status, false));
  it.each(STATUSES)('%s: tree with the flag on', (status) => capture(status, true));
  it.each(STATUSES)('%s: identical with the flag on and off', (status) => {
    expect(shapes[`${status}:true`]).toBeTruthy();
    expect(shapes[`${status}:true`]).toBe(shapes[`${status}:false`]);
  });
});
