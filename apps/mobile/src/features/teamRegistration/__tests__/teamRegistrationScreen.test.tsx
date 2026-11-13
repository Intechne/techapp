import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TeamRegistrationScreen } from '../TeamRegistrationScreen';
import { toAppError } from '../../../lib/errors';

const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));

const baseEvent = {
  id: 'e1', title: 'Robot Turnuvası', starts_at: '2099-12-01T07:00:00Z', ends_at: '2099-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person',
  registration_mode: 'team', team_min_size: 2, team_max_size: 4, team_capacity: 8, teams_taken: 3, requires_review: false,
  registration_closes_at: '2099-11-20T07:00:00Z', organization: { id: 'o', name: 'Org', verification: 'verified' }, sessions: [],
};
const teamRow = (id: string, registration_id: string | null = null) => ({ team_id: id, name: id === 't1' ? 'Dişli Kafalar' : 'Vida Takımı', role: 'captain', active_member_count: 4, registration_id, registration_status: registration_id ? 'pending_members' : null });
let mockTeams = [teamRow('t1')];
let mockEvent = { ...baseEvent };
jest.mock('../../events/api', () => ({
  fetchEvent: async () => mockEvent,
  fetchEligibility: async () => ({ event_id: 'e1', authenticated: true, eligible: true, reasons: [], guardian_required: false, is_full: false, waitlist_enabled: false, seats_left: null, registration_id: null, registration_status: null, registration_mode: 'team', team_seats_left: 5, manageable_teams: mockTeams }),
  eventKeys: { detail: (id: string) => ['events', 'detail', id], eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u] },
}));

const rosterRow = (user_id: string, display_name: string, role = 'member', status = 'active') => ({ membership_id: `ms-${user_id}`, user_id, display_name, role, status, message: null, title: null });
const ROSTER = [rosterRow('aaaaaaaa-0000-4000-8000-000000000001', 'Ada Yılmaz', 'captain'), rosterRow('aaaaaaaa-0000-4000-8000-000000000002', 'Barış Kaya'), rosterRow('aaaaaaaa-0000-4000-8000-000000000003', 'Cem Demir', 'mentor'), rosterRow('aaaaaaaa-0000-4000-8000-000000000004', 'Elif Şahin'), rosterRow('aaaaaaaa-0000-4000-8000-000000000005', 'Bekleyen İstek', 'member', 'pending')];
const row = (id: string) => ({ id, event_id: 'e1', team_id: 't1', status: 'pending_members', roster_version: 1, hold_expires_at: '2099-11-10T07:00:00Z' });
const detail = (version: number) => ({
  id: 'tr1', status: 'pending_members', hold_expires_at: '2099-11-10T07:00:00Z', roster_version: version, can_edit: true,
  event: { id: 'e1', title: 'Robot Turnuvası', starts_at: '2099-12-01T07:00:00Z' }, team: { id: 't1', name: 'Dişli Kafalar' },
  members: [
    { member_id: 'x1', user_id: 'aaaaaaaa-0000-4000-8000-000000000001', display_name: 'Ada Yılmaz', role_at_submit: 'captain', state: 'accepted', step: 'ready' },
    { member_id: 'x2', user_id: 'aaaaaaaa-0000-4000-8000-000000000002', display_name: 'Barış Kaya', role_at_submit: 'member', state: 'invited', step: 'invited' },
    { member_id: 'x3', user_id: 'aaaaaaaa-0000-4000-8000-000000000003', display_name: 'Cem Demir', role_at_submit: 'mentor', state: 'declined', step: 'declined' },
  ],
});
const ok = (data: unknown) => ({ data, error: null });
const fail = (code: string, status: number, details: string | null = null) => ({ data: null, error: { code: `PT${status}`, message: code, details, hint: null } });
const calls = (name: string) => mockRpc.mock.calls.filter((c) => c[0] === name);

let rpcHandlers: Record<string, (args: Record<string, unknown>) => unknown> = {};
beforeEach(() => {
  mockUuid = 0; mockRpc.mockReset(); mockTeams = [teamRow('t1')]; mockEvent = { ...baseEvent };
  rpcHandlers = {
    team_roster: () => ok(ROSTER),
    submit_team_registration: () => ok(row('tr1')),
    team_registration_detail: () => ok(detail(3)),
    update_team_roster: () => ok(row('tr1')),
  };
  mockRpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (rpcHandlers[name] ?? (() => ok(null)))(args));
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const nav = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
async function renderScreen(params: { eventId: string; teamRegistrationId?: string } = { eventId: 'e1' }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: Infinity } } });
  const props = { navigation: nav, route: { key: 'k', name: 'TeamRegistration', params } } as unknown as React.ComponentProps<typeof TeamRegistrationScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><TeamRegistrationScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
  await screen.findByText('Ada Yılmaz');
}
beforeEach(() => { nav.replace.mockClear(); nav.navigate.mockClear(); nav.goBack.mockClear(); });
const checkbox = (name: string) => screen.getByRole('checkbox', { name: new RegExp(name) });
const submitButton = () => screen.getByRole('button', { name: /Takımı kaydet/ });
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

describe('Takım kaydı — kadro seçimi', () => {
  it('lists the active members from team_roster (a pending join request is not a roster candidate), names as written', async () => {
    await renderScreen();
    expect(calls('team_roster')[0]).toEqual(['team_roster', { p_team_id: 't1' }]);
    for (const n of ['Ada Yılmaz', 'Barış Kaya', 'Cem Demir', 'Elif Şahin']) expect(screen.getByText(n)).toBeTruthy();
    expect(screen.queryByText('Bekleyen İstek')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('size window not met: the reason is inline, the button stays enabled, pressing it shows the reason and makes no call', async () => {
    await renderScreen();
    await fireEvent.press(checkbox('Barış Kaya')); await fireEvent.press(checkbox('Cem Demir')); await fireEvent.press(checkbox('Elif Şahin'));
    expect(await screen.findByText(/En az 2 kişi seçmelisin/)).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
    expect(submitButton().props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(submitButton());
    expect(await screen.findByText('Kadro etkinliğin istediği büyüklükte değil')).toBeTruthy();
    expect(calls('submit_team_registration')).toHaveLength(0);
  });

  it('too many names the maximum; a bigger roster than the maximum starts with nobody selected', async () => {
    mockEvent = { ...baseEvent, team_max_size: 2 };
    await renderScreen();
    expect(screen.getAllByRole('checkbox').every((c) => !c.props.accessibilityState.checked)).toBe(true);
    await fireEvent.press(checkbox('Ada Yılmaz')); await fireEvent.press(checkbox('Barış Kaya')); await fireEvent.press(checkbox('Cem Demir'));
    expect(await screen.findByText(/En fazla 2 kişi seçebilirsin/)).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
  });

  it('a double tap makes ONE submit_team_registration call; a retry after a dropped connection reuses the SAME key', async () => {
    let release: (v: unknown) => void = () => {};
    let n = 0;
    rpcHandlers.submit_team_registration = () => (++n === 1 ? new Promise((r) => { release = r; }) : ok(row('tr1')));
    await renderScreen();
    await fireEvent.press(submitButton()); await fireEvent.press(submitButton());
    await waitFor(() => expect(calls('submit_team_registration')).toHaveLength(1));
    const key = (calls('submit_team_registration')[0]![1] as { p_idempotency_key: string }).p_idempotency_key;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls('submit_team_registration')[0]![1]).toMatchObject({ p_event_id: 'e1', p_team_id: 't1', p_member_ids: ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000004'] });
    await act(async () => { release({ data: null, error: { code: '', message: 'Network request failed', details: null, hint: null } }); });
    expect(await screen.findByText(/İnternet bağlantını/)).toBeTruthy();
    await screen.findByRole('button', { name: /Takımı kaydet/ }); // the button is busy until the mutation has settled
    await fireEvent.press(submitButton());
    await waitFor(() => expect(calls('submit_team_registration')).toHaveLength(2));
    expect((calls('submit_team_registration')[1]![1] as { p_idempotency_key: string }).p_idempotency_key).toBe(key);
    expect(mockUuid).toBe(1); // generated once, at the first press
  });

  it('changing the selection starts a new idempotency key; retrying the same selection keeps it', async () => {
    rpcHandlers.submit_team_registration = () => fail('team_size_out_of_range', 422);
    await renderScreen();
    await fireEvent.press(submitButton());
    await waitFor(() => expect(calls('submit_team_registration')).toHaveLength(1));
    await fireEvent.press(submitButton());
    await waitFor(() => expect(calls('submit_team_registration')).toHaveLength(2));
    await fireEvent.press(checkbox('Elif Şahin'));
    await fireEvent.press(submitButton());
    await waitFor(() => expect(calls('submit_team_registration')).toHaveLength(3));
    const key = (i: number) => (calls('submit_team_registration')[i]![1] as { p_idempotency_key: string }).p_idempotency_key;
    expect(key(1)).toBe(key(0));
    expect(key(2)).not.toBe(key(0));
  });

  it('member_already_registered: the COPY sits under the offending rows (ids from the error detail), never a server name or age', async () => {
    rpcHandlers.submit_team_registration = () => fail('member_already_registered', 409, '["aaaaaaaa-0000-4000-8000-000000000002","aaaaaaaa-0000-4000-8000-000000000004"]');
    await renderScreen();
    await fireEvent.press(submitButton());
    const copy = toAppError({ code: 'PT409', message: 'member_already_registered' }).message;
    await waitFor(() => expect(within(screen.getByTestId('member-row-aaaaaaaa-0000-4000-8000-000000000002')).getByText(copy)).toBeTruthy());
    expect(within(screen.getByTestId('member-row-aaaaaaaa-0000-4000-8000-000000000004')).getByText(copy)).toBeTruthy();
    expect(within(screen.getByTestId('member-row-aaaaaaaa-0000-4000-8000-000000000001')).queryByText(copy)).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('member_not_active and member_age_not_eligible map to their own COPY under their rows', async () => {
    rpcHandlers.submit_team_registration = () => fail('member_age_not_eligible', 403, '["aaaaaaaa-0000-4000-8000-000000000003"]');
    await renderScreen();
    await fireEvent.press(submitButton());
    const copy = toAppError({ code: 'PT403', message: 'member_age_not_eligible' }).message;
    await waitFor(() => expect(within(screen.getByTestId('member-row-aaaaaaaa-0000-4000-8000-000000000003')).getByText(copy)).toBeTruthy());
  });

  it('success replaces the screen with the status screen', async () => {
    await renderScreen();
    await fireEvent.press(submitButton());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('TeamRegistrationStatus', { teamRegistrationId: 'tr1' }));
  });

  it('two manageable teams: the manager picks which team to register', async () => {
    mockTeams = [teamRow('t1'), teamRow('t2')];
    await renderScreen();
    await fireEvent.press(screen.getByRole('radio', { name: /Vida Takımı/ }));
    await waitFor(() => expect(calls('team_roster').some((c) => (c[1] as { p_team_id: string }).p_team_id === 't2')).toBe(true));
  });
});

describe('Takım kaydı — kadroyu düzenle', () => {
  it('uses the detail roster_version and preselects the members still in the roster (declined holes are not selected)', async () => {
    await renderScreen({ eventId: 'e1', teamRegistrationId: 'tr1' });
    expect(checkbox('Ada Yılmaz').props.accessibilityState.checked).toBe(true);
    expect(checkbox('Barış Kaya').props.accessibilityState.checked).toBe(true);
    expect(checkbox('Cem Demir').props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: /Kadroyu kaydet/ }));
    await waitFor(() => expect(calls('update_team_roster')).toHaveLength(1));
    expect(calls('update_team_roster')[0]![1]).toEqual({ p_team_registration_id: 'tr1', p_member_ids: ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'], p_expected_roster_version: 3 });
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('TeamRegistrationStatus', { teamRegistrationId: 'tr1' }));
    expect(calls('submit_team_registration')).toHaveLength(0);
  });

  it('maps the current members by user id: two people with the same display name are told apart', async () => {
    const U = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
    rpcHandlers.team_roster = () => ok([rosterRow(U(1), 'Ada Yılmaz', 'captain'), rosterRow(U(2), 'Barış Kaya'), rosterRow(U(6), 'Barış Kaya')]);
    rpcHandlers.team_registration_detail = () => ok({ ...detail(3), members: [
      { member_id: 'x1', user_id: U(1), display_name: 'Ada Yılmaz', role_at_submit: 'captain', state: 'accepted', step: 'ready' },
      { member_id: 'x6', user_id: U(6), display_name: 'Barış Kaya', role_at_submit: 'member', state: 'invited', step: 'invited' },
    ] });
    await renderScreen({ eventId: 'e1', teamRegistrationId: 'tr1' });
    const [first, second] = screen.getAllByRole('checkbox', { name: /Barış Kaya/ });
    expect(first!.props.accessibilityState.checked).toBe(false);
    expect(second!.props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: /Kadroyu kaydet/ }));
    await waitFor(() => expect(calls('update_team_roster')).toHaveLength(1));
    expect((calls('update_team_roster')[0]![1] as { p_member_ids: string[] }).p_member_ids).toEqual([U(1), U(6)]);
  });

  it('a member without a user id (not a manager view) is never matched by name', async () => {
    rpcHandlers.team_registration_detail = () => ok({ ...detail(3), members: detail(3).members.map((m) => ({ ...m, user_id: null })) });
    await renderScreen({ eventId: 'e1', teamRegistrationId: 'tr1' });
    expect(screen.getAllByRole('checkbox').every((c) => !c.props.accessibilityState.checked)).toBe(true);
  });

  it('roster_changed: the COPY, no silent overwrite, and "Güncel kadroyu yükle" re-reads the detail', async () => {
    rpcHandlers.update_team_roster = () => fail('roster_changed', 409);
    await renderScreen({ eventId: 'e1', teamRegistrationId: 'tr1' });
    await fireEvent.press(screen.getByRole('button', { name: /Kadroyu kaydet/ }));
    expect(await screen.findByText(toAppError({ code: 'PT409', message: 'roster_changed' }).message)).toBeTruthy();
    expect(nav.navigate).not.toHaveBeenCalled();
    const before = calls('team_registration_detail').length;
    rpcHandlers.team_registration_detail = () => ok(detail(4));
    await fireEvent.press(screen.getByRole('button', { name: /Güncel kadroyu yükle/ }));
    await waitFor(() => expect(calls('team_registration_detail').length).toBeGreaterThan(before));
  });
});
