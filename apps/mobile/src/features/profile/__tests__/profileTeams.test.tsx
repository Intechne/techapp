import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProfileScreen } from '../ProfileScreen';

// The CV lists ACTIVE teams only (server rule). Pending requests come from fetchMyTeams, which is filtered by user_id.
const ME = 'u1';
const team = (id: string, name: string) => ({ id, name, kind: 'team', category: null, is_demo: false });
const row = (id: string, userId: string, t: ReturnType<typeof team>, role: string, status: string) =>
  ({ id, team_id: t.id, user_id: userId, role, status, message: null, title: null, created_at: '2026-11-01T10:00:00Z', team: t });
const NOVA = team('t-nova', 'Nova Robotik'); const ORBIT = team('t-orbit', 'Orbit Robotik');
let rows: ReturnType<typeof row>[] = [];
const calls: { table: string; method: string; args: unknown[] }[] = [];
function mockBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'order', 'limit', 'overrideTypes']) b[m] = (...args: unknown[]) => { calls.push({ table, method: m, args }); return b; };
  b.eq = (col: string, val: unknown) => { calls.push({ table, method: 'eq', args: [col, val] }); filters[col] = val; return b; };
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'team_memberships' ? rows.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) : [], error: null }).then(resolve);
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: ME, session: { user: { email: 'a@b.c' } } }), useAccountState: () => ({ data: { organization_roles: [], profile_complete: true }, refetch: jest.fn() }) }));
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => ({ clear: jest.fn() }) }));
jest.mock('../../onboarding/PrefsProvider', () => ({ usePrefs: () => ({ update: jest.fn() }) }));
jest.mock('../../events/api', () => ({ ...jest.requireActual('../../events/api'), fetchMyRegistrations: async () => [] }));
let mockCvTeams: unknown[] = [];
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  useMyCv: () => ({ isPending: false, isError: false, isRefetching: false, refetch: jest.fn(), data: {
    profile: { id: ME, display_name: 'Ayşe Kaya', headline: null, bio: null, city: null, education_stage: null, discoverable: false, skills: [] },
    interests: [], experiences: [], participations: [], volunteering: [], teams: mockCvTeams, share_token: null } }),
}));

const navigate = jest.fn(); const parentNavigate = jest.fn(); const setParams = jest.fn();
beforeEach(() => { rows = []; calls.length = 0; mockCvTeams = []; navigate.mockClear(); parentNavigate.mockClear(); });
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const props = { navigation: { navigate, setParams, getParent: () => ({ navigate: parentNavigate, getParent: () => ({ navigate: jest.fn() }) }) }, route: { key: 'k', name: 'ProfileHome', params: { segment: 'Takımlar' } } } as unknown as React.ComponentProps<typeof ProfileScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ProfileScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};

describe('Profil > Takımlar: bekleyen istekler (Q15)', () => {
  it('a pending membership is listed with the pending label and opens the team profile', async () => {
    rows = [row('m1', ME, NOVA, 'member', 'pending')];
    await open();
    expect(await screen.findByText('Bekleyen istekler')).toBeTruthy();
    expect(screen.getByText('İSTEĞİN BEKLİYOR')).toBeTruthy();
    expect(screen.queryByText('Henüz bir takımda değilsin')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /Nova Robotik/ }));
    expect(parentNavigate).toHaveBeenCalledWith('CommunityTab', { screen: 'TeamDetail', params: { teamId: 't-nova' } });
  });

  it('active-only users see no pending group; active teams still list from the CV', async () => {
    rows = [row('m2', ME, ORBIT, 'captain', 'active')];
    mockCvTeams = [{ team_id: 't-orbit', name: 'Orbit Robotik', kind: 'team', role: 'captain', title: null, since: null }];
    await open();
    expect(await screen.findByText('Orbit Robotik')).toBeTruthy();
    expect(screen.queryByText('Bekleyen istekler')).toBeNull();
    expect(screen.queryByText('İSTEĞİN BEKLİYOR')).toBeNull();
  });

  it('only the viewer’s own rows are requested (user_id filter), never a teammate’s pending request', async () => {
    rows = [row('m1', ME, NOVA, 'member', 'pending'), row('m9', 'someone-else', ORBIT, 'member', 'pending')];
    await open();
    await screen.findByText('Bekleyen istekler');
    expect(calls).toContainEqual({ table: 'team_memberships', method: 'eq', args: ['user_id', ME] });
    expect(screen.queryByText('Orbit Robotik')).toBeNull();
  });
});
