import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TeamInviteScreen } from '../TeamInviteScreen';
import { ToastProvider } from '../../../design-system';

let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));
const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));

const invite = (over: Record<string, unknown> = {}) => ({
  member_id: 'm1', team_registration_id: 'tr1', state: 'invited', team_status: 'pending_members', hold_expires_at: '2099-11-20T07:00:00Z',
  event: { id: 'e1', title: 'Robot Turnuvası', starts_at: '2099-12-01T07:00:00Z' }, team: { id: 't1', name: 'Dişli Kafalar' }, ...over,
});
let mockInvites: unknown[] = [invite()];
let mockRespond: (args: Record<string, unknown>) => unknown;
const ok = (data: unknown) => ({ data, error: null });
const fail = (code: string, status: number) => ({ data: null, error: { code: `PT${status}`, message: code, details: null, hint: null } });
const accepted = (status: string) => ok({ member_state: 'accepted', registration_id: 'r1', registration_status: status, team_status: 'pending_members' });

beforeEach(() => {
  mockInvites = [invite()];
  mockRespond = () => accepted('confirmed');
  mockRpc.mockReset();
  mockRpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'my_team_registration_invites') return ok(mockInvites);
    if (name === 'respond_team_registration') return mockRespond(args);
    return ok(null);
  });
  nav.replace.mockClear(); nav.goBack.mockClear(); nav.navigate.mockClear(); bootstrap.mockClear();
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const bootstrap = jest.fn();
const nav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), getParent: () => ({ getParent: () => ({ navigate: bootstrap }) }) };
async function renderInvite(params: Record<string, unknown> = { memberId: 'm1' }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: Infinity } } });
  const props = { navigation: nav, route: { key: 'k', name: 'TeamInvite', params } } as unknown as React.ComponentProps<typeof TeamInviteScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ToastProvider><TeamInviteScreen {...props} /></ToastProvider></QueryClientProvider></SafeAreaProvider>);
}
/** After an answer the screen refetches the invites in the background: let that finish inside the test. */
const settle = async () => {
  await waitFor(() => expect(mockRpc.mock.calls.filter((c) => c[0] === 'my_team_registration_invites').length).toBeGreaterThan(1));
  await new Promise((r) => setTimeout(r, 30));
};
const respondCalls = () => mockRpc.mock.calls.filter((c) => c[0] === 'respond_team_registration');
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

describe('Takım daveti', () => {
  it('shows the event, the team name as written and the consent sentence exactly', async () => {
    await renderInvite();
    expect(await screen.findByText('Robot Turnuvası')).toBeTruthy();
    expect(screen.getByText('Dişli Kafalar')).toBeTruthy();
    expect(screen.getByText('Kabul edersen katılımın senin adına kaydedilir; 18 yaşından küçüksen velinden onay isteyeceğiz.')).toBeTruthy();
    expect(screen.getByText(/tarihine kadar tamamlanmalı/)).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
  });

  it('opens by team registration id too (a notification carries that id, not the member id)', async () => {
    await renderInvite({ teamRegistrationId: 'tr1' });
    expect(await screen.findByText('Robot Turnuvası')).toBeTruthy();
  });

  it('accept, registration pending_guardian → GuardianRequest (replace)', async () => {
    mockRespond = () => accepted('pending_guardian');
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılıyorum'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('GuardianRequest', { registrationId: 'r1' }));
    expect(respondCalls()[0][1]).toMatchObject({ p_member_id: 'm1', p_accept: true });
    expect(respondCalls()[0][1].p_idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
    await settle();
  });

  it('accept, registration confirmed → RegistrationStatus (replace)', async () => {
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılıyorum'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('RegistrationStatus', { registrationId: 'r1', fresh: true }));
    await settle();
  });

  it('a double tap is one call', async () => {
    let release: (v: unknown) => void = () => {};
    mockRespond = () => new Promise((r) => { release = r; });
    await renderInvite();
    const accept = await screen.findByText('Katılıyorum');
    await fireEvent.press(accept); await fireEvent.press(accept);
    await waitFor(() => expect(respondCalls()).toHaveLength(1));
    release(accepted('confirmed'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1));
    expect(respondCalls()).toHaveLength(1);
    await settle();
  });

  it('a retry after a failure reuses the key; accept and decline never share one', async () => {
    let n = 0;
    mockRespond = () => (++n === 1 ? { data: null, error: { code: '', message: 'Network request failed', details: null, hint: null } } : accepted('confirmed'));
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılıyorum'));
    await waitFor(() => expect(respondCalls()).toHaveLength(1));
    await screen.findByText(/Bağlantı|bağlantı|internet/);
    await fireEvent.press(screen.getByText('Katılıyorum'));
    await waitFor(() => expect(respondCalls()).toHaveLength(2));
    expect(respondCalls()[1][1].p_idempotency_key).toBe(respondCalls()[0][1].p_idempotency_key);
    await settle();
  });

  it('profile_incomplete is said plainly and points at profile completion', async () => {
    mockRespond = () => fail('profile_incomplete', 409);
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılıyorum'));
    expect(await screen.findByText(/profilini tamamlaman gerekiyor/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Profilimi tamamla'));
    expect(bootstrap).toHaveBeenCalledWith('ProfileBootstrap');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('declining asks first (a modal), nothing is sent until confirmed', async () => {
    mockRespond = () => ok({ member_state: 'declined', registration_id: null, registration_status: null, team_status: 'pending_members' });
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılmıyorum'));
    expect(await screen.findByText('Davete katılmayacak mısın?')).toBeTruthy();
    expect(respondCalls()).toHaveLength(0);
    await fireEvent.press(screen.getByText('Vazgeç'));
    expect(respondCalls()).toHaveLength(0);
    await fireEvent.press(screen.getByText('Katılmıyorum'));
    await fireEvent.press(await screen.findByText('Evet, katılmıyorum'));
    await waitFor(() => expect(respondCalls()).toHaveLength(1));
    expect(respondCalls()[0][1]).toMatchObject({ p_member_id: 'm1', p_accept: false });
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
    await settle();
  });

  it('a waitlisted team says so; the server answer to accept is the plain COPY, the button stays active', async () => {
    mockInvites = [invite({ team_status: 'waitlisted', hold_expires_at: null })];
    mockRespond = () => fail('team_registration_waitlisted', 409);
    await renderInvite();
    expect(await screen.findByText(/bekleme listesinde/)).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
    await fireEvent.press(screen.getByText('Katılıyorum'));
    expect(await screen.findAllByText(/Yer açılınca davetini kabul edebilirsin/)).toBeTruthy();
  });

  it('an invite that is no longer pending says so and leads to Katılımlarım', async () => {
    mockInvites = [];
    await renderInvite();
    expect(await screen.findByText('Bu davet artık yanıt beklemiyor.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Katılımlarım'));
    expect(nav.navigate).toHaveBeenCalledWith('MyRegistrations');
  });

  it('an accept that returns no registration is an honest error, not a success', async () => {
    mockRespond = () => ok({ member_state: 'accepted', registration_id: null, registration_status: null, team_status: 'pending_members' });
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılıyorum'));
    expect(await screen.findByText(/Beklenmedik bir sorun/)).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
    expect(nav.goBack).not.toHaveBeenCalled();
    await settle();
  });

  it('a failed decline shows its error once (in the modal, not behind it)', async () => {
    mockRespond = () => fail('invite_not_pending', 409);
    await renderInvite();
    await fireEvent.press(await screen.findByText('Katılmıyorum'));
    await fireEvent.press(await screen.findByText('Evet, katılmıyorum'));
    await waitFor(() => expect(screen.getAllByText(/artık yanıt beklemiyor/)).toHaveLength(1));
  });
});
