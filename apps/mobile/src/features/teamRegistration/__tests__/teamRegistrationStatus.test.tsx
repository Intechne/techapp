import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TeamRegistrationStatusScreen } from '../TeamRegistrationStatusScreen';
import { ToastProvider } from '../../../design-system';

const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));

let mockRequiresReview = false;
let mockManages = true;
jest.mock('../../events/api', () => ({
  fetchEvent: async () => ({ id: 'e1', title: 'Robot Turnuvası', requires_review: mockRequiresReview }),
  fetchEligibility: async () => ({ manageable_teams: mockManages ? [{ team_id: 't1', name: 'Dişli Kafalar', role: 'captain', active_member_count: 4, registration_id: 'tr1', registration_status: 'pending_members' }] : [] }),
  eventKeys: { detail: (id: string) => ['events', 'detail', id], eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u] },
}));

const base = {
  id: 'tr1', status: 'pending_members', hold_expires_at: '2099-11-10T07:00:00Z', roster_version: 3, can_edit: true,
  event: { id: 'e1', title: 'Robot Turnuvası', starts_at: '2099-12-01T07:00:00Z' }, team: { id: 't1', name: 'Dişli Kafalar' },
  members: [
    { member_id: 'x1', user_id: 'bbbbbbbb-0000-4000-8000-000000000001', display_name: 'Ada Yılmaz', role_at_submit: 'captain', state: 'accepted', step: 'ready' },
    { member_id: 'x2', user_id: 'bbbbbbbb-0000-4000-8000-000000000002', display_name: 'Barış Kaya', role_at_submit: 'member', state: 'invited', step: 'invited' },
    { member_id: 'x3', user_id: 'bbbbbbbb-0000-4000-8000-000000000003', display_name: 'Cem Demir', role_at_submit: 'member', state: 'accepted', step: 'guardian' },
    { member_id: 'x4', user_id: 'bbbbbbbb-0000-4000-8000-000000000004', display_name: 'Elif Şahin', role_at_submit: 'member', state: 'declined', step: 'declined' },
  ],
};
let mockDetail: Record<string, unknown> = base;
let mockCancel: () => unknown = () => ({ data: { id: 'tr1', status: 'cancelled' }, error: null });
beforeEach(() => {
  mockRequiresReview = false; mockManages = true; mockDetail = base;
  mockCancel = () => ({ data: { id: 'tr1', status: 'cancelled' }, error: null });
  mockRpc.mockReset();
  mockRpc.mockImplementation(async (name: string) => (name === 'team_registration_detail' ? { data: mockDetail, error: null } : name === 'cancel_team_registration' ? mockCancel() : { data: null, error: null }));
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const nav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
async function renderStatus() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: Infinity } } });
  const props = { navigation: nav, route: { key: 'k', name: 'TeamRegistrationStatus', params: { teamRegistrationId: 'tr1' } } } as unknown as React.ComponentProps<typeof TeamRegistrationStatusScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ToastProvider><TeamRegistrationStatusScreen {...props} /></ToastProvider></QueryClientProvider></SafeAreaProvider>);
  await screen.findByText('Ada Yılmaz');
}
beforeEach(() => nav.navigate.mockClear());
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

describe('Takım kaydı durumu', () => {
  it('pending_members: timeline, hold sentence from the server date, members with step badges, names as written', async () => {
    await renderStatus();
    for (const l of ['Gönderildi', 'Üyeler hazır', 'Onaylandı']) expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    expect(screen.queryByText('İnceleme')).toBeNull();
    expect(screen.getByText(/tarihine kadar tamamlanmalı/)).toBeTruthy();
    expect(within(screen.getByTestId('member-x1')).getByText('HAZIR')).toBeTruthy();
    expect(within(screen.getByTestId('member-x2')).getByText('DAVET BEKLİYOR')).toBeTruthy();
    expect(within(screen.getByTestId('member-x3')).getByText('VELİ ONAYI BEKLENİYOR')).toBeTruthy();
    expect(within(screen.getByTestId('member-x4')).getByText('KATILMIYOR')).toBeTruthy();
    expect(screen.getByText('Cem Demir')).toBeTruthy();
    expect(screen.getByText('Dişli Kafalar')).toBeTruthy();
  });

  it('a review event shows the İnceleme step; pending_review is waiting for the organiser, no hold sentence', async () => {
    mockRequiresReview = true; mockDetail = { ...base, status: 'pending_review', hold_expires_at: null };
    await renderStatus();
    expect(await screen.findByText('İnceleme')).toBeTruthy();
    expect(screen.getByText('DEĞERLENDİRMEDE')).toBeTruthy();
    expect(screen.queryByText(/tarihine kadar tamamlanmalı/)).toBeNull();
  });

  it('confirmed team', async () => {
    mockDetail = { ...base, status: 'confirmed', hold_expires_at: null, can_edit: false };
    await renderStatus();
    expect(screen.getByText('TAKIMIN ONAYLANDI')).toBeTruthy();
  });

  it('manager: Kadroyu düzenle opens the roster screen on this registration; no disabled primary', async () => {
    await renderStatus();
    await screen.findByRole('button', { name: /Kadroyu düzenle/ });
    await fireEvent.press(screen.getByRole('button', { name: /Kadroyu düzenle/ }));
    expect(nav.navigate).toHaveBeenCalledWith('TeamRegistration', { eventId: 'e1', teamRegistrationId: 'tr1' });
    expect(disabledButtons()).toHaveLength(0);
  });

  it('can_edit false (registration closed): no edit button, the manager can still cancel', async () => {
    mockDetail = { ...base, can_edit: false };
    await renderStatus();
    await screen.findByRole('button', { name: /Takım kaydını iptal et/ });
    expect(screen.queryByRole('button', { name: /Kadroyu düzenle/ })).toBeNull();
  });

  it('not a manager of the team: read-only, no edit and no cancel', async () => {
    mockManages = false; mockDetail = { ...base, can_edit: false };
    await renderStatus();
    await waitFor(() => expect(screen.queryByTestId('timeline-skeleton')).toBeNull());
    expect(screen.queryByRole('button', { name: /iptal et/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Kadroyu düzenle/ })).toBeNull();
  });

  it('cancel asks first (Modal), then calls cancel_team_registration once', async () => {
    await renderStatus();
    await fireEvent.press(await screen.findByRole('button', { name: /Takım kaydını iptal et/ }));
    expect(await screen.findByText('Takım kaydını iptal edelim mi?')).toBeTruthy();
    expect(mockRpc.mock.calls.filter((c) => c[0] === 'cancel_team_registration')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: /Evet, iptal et/ }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('cancel_team_registration', { p_team_registration_id: 'tr1' }));
    expect(await screen.findByText('Takım kaydı iptal edildi.')).toBeTruthy();
    await waitFor(() => expect(mockRpc.mock.calls.filter((c) => c[0] === 'team_registration_detail').length).toBeGreaterThan(1));
  });

  it('a cancel error shows the COPY inside the modal', async () => {
    mockCancel = () => ({ data: null, error: { code: 'PT409', message: 'event_already_started', details: null, hint: null } });
    await renderStatus();
    await fireEvent.press(await screen.findByRole('button', { name: /Takım kaydını iptal et/ }));
    await fireEvent.press(await screen.findByRole('button', { name: /Evet, iptal et/ }));
    expect(await screen.findByText(/Etkinlik başladığı için/)).toBeTruthy();
  });

  it('a cancelled registration has no timeline and no actions', async () => {
    mockDetail = { ...base, status: 'cancelled', hold_expires_at: null, can_edit: false };
    await renderStatus();
    expect(screen.getByText('İPTAL EDİLDİ')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /iptal et/ })).toBeNull();
  });
});
