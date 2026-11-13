import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommunityScreen } from '../../community/CommunityScreen';
import { fetchMyTeams } from '../api';

// A captain's RLS view of team_memberships: own rows AND every row of the teams they manage (incl. join notes).
const MOCK_CAPTAIN = 'cap-1';
const team = (id: string, name: string) => ({ id, name, kind: 'team', tagline: null, category: null, city: null, member_count: 3, is_demo: false });
const ORBIT = team('t-orbit', 'Orbit Robotik'); const NOVA = team('t-nova', 'Nova Robotik');
const row = (id: string, userId: string, t: typeof ORBIT, role: string, status: string, message: string | null = null) =>
  ({ id, team_id: t.id, user_id: userId, role, status, message, title: null, created_at: '2026-11-01T10:00:00Z', team: t });
const MOCK_RLS_ROWS = [
  row('m1', MOCK_CAPTAIN, ORBIT, 'captain', 'active'),
  row('m2', MOCK_CAPTAIN, NOVA, 'captain', 'active'),
  row('m3', 'minor-1', ORBIT, 'member', 'active', 'Okulum Test Lisesi'),
  row('m4', 'adult-1', ORBIT, 'member', 'active'),
  row('m5', 'applicant-1', NOVA, 'member', 'pending', 'Beni de alın'),
];

const mockCalls: { table: string; method: string; args: unknown[] }[] = [];
function mockBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'order', 'limit', 'overrideTypes']) {
    b[method] = (...args: unknown[]) => { mockCalls.push({ table, method, args }); return b; };
  }
  b.eq = (col: string, val: unknown) => { mockCalls.push({ table, method: 'eq', args: [col, val] }); filters[col] = val; return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    const data = table === 'team_memberships'
      ? MOCK_RLS_ROWS.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
      : [];
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: MOCK_CAPTAIN }) }));

beforeEach(() => { mockCalls.length = 0; });

describe('Takımlarım only fetches the signed-in user’s own memberships', () => {
  it('fetchMyTeams filters team_memberships by user_id', async () => {
    const mine = await fetchMyTeams(MOCK_CAPTAIN);
    expect(mockCalls).toContainEqual({ table: 'team_memberships', method: 'eq', args: ['user_id', MOCK_CAPTAIN] });
    expect(mine.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(mine.every((m) => m.user_id === MOCK_CAPTAIN)).toBe(true);
    // the embedded team carries category_key (icon source for Profil > Takımlar)
    expect(mockCalls.find((c) => c.table === 'team_memberships' && c.method === 'select')?.args[0]).toMatch(/category_key/);
  });

  it('a captain gets one "Takımım" shortcut, never a card per teammate or applicant', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
    const props = { navigation: { navigate: jest.fn(), getParent: jest.fn() }, route: { key: 'k', name: 'CommunityHome' } } as unknown as React.ComponentProps<typeof CommunityScreen>;
    await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><CommunityScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
    expect(await screen.findByText(/Takımım · Kaptan/)).toBeTruthy();
    expect(screen.getAllByText('Orbit Robotik')).toHaveLength(1);
    expect(screen.getByText(/\+1 takım daha/)).toBeTruthy(); // the second own team is counted, not listed
    expect(screen.queryByText('Nova Robotik')).toBeNull();
    expect(screen.queryByText(/Kaptanın isteğini değerlendirmesi bekleniyor/)).toBeNull(); // the applicant's pending row
  });
});
