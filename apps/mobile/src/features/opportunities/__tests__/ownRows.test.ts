import { fetchFollowedOpportunityIds, fetchMyApplicationFor, fetchMyApplications, setFollowed } from '../api';

// What org staff see under RLS: their own rows AND every applicant's / follower's rows.
const STAFF = 'staff-1';
const opp = { id: 'o1', title: 'Staj', type: 'internship', closes_at: '2026-12-01T00:00:00Z', organization: { name: 'Org' } };
const app = (id: string, userId: string, opportunityId = 'o1', status = 'submitted') => ({ id, user_id: userId, opportunity_id: opportunityId, status, created_at: '2026-11-01T10:00:00Z', opportunity: opp });
const APPLICATIONS = [app('a1', STAFF), app('a2', 'minor-1'), app('a3', 'adult-1'), app('a4', 'adult-1', 'o1', 'withdrawn')];
const BOOKMARKS = [
  { user_id: STAFF, target_type: 'opportunity', target_id: 'o1' },
  { user_id: 'minor-1', target_type: 'opportunity', target_id: 'o2' },
];

const mockCalls: { table: string; method: string; args: unknown[] }[] = [];
function mockBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'limit', 'neq', 'overrideTypes', 'delete', 'upsert']) {
    b[method] = (...args: unknown[]) => { mockCalls.push({ table, method, args }); return b; };
  }
  b.eq = (col: string, val: unknown) => { mockCalls.push({ table, method: 'eq', args: [col, val] }); filters[col] = val; return b; };
  const rows = () => (table === 'applications' ? APPLICATIONS : table === 'bookmarks' ? BOOKMARKS : [])
    .filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v));
  b.maybeSingle = () => Promise.resolve({ data: rows().filter((r) => (r as { status?: string }).status !== 'withdrawn')[0] ?? null, error: null });
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve);
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));

beforeEach(() => { mockCalls.length = 0; });

describe('"my" opportunity queries never rely on RLS alone', () => {
  it('fetchMyApplications filters by user_id and returns only own rows', async () => {
    const mine = await fetchMyApplications(STAFF);
    expect(mockCalls).toContainEqual({ table: 'applications', method: 'eq', args: ['user_id', STAFF] });
    expect(mine.map((a) => a.id)).toEqual(['a1']);
  });
  it('fetchMyApplicationFor filters by user_id: staff never see an applicant’s application as their own', async () => {
    const mine = await fetchMyApplicationFor(STAFF, 'o1');
    expect(mockCalls).toContainEqual({ table: 'applications', method: 'eq', args: ['user_id', STAFF] });
    expect(mine?.id).toBe('a1');
    expect(await fetchMyApplicationFor('someone-new', 'o1')).toBeNull();
  });
  it('fetchFollowedOpportunityIds filters bookmarks by user_id', async () => {
    const ids = await fetchFollowedOpportunityIds(STAFF);
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'eq', args: ['user_id', STAFF] });
    expect(ids).toEqual(['o1']);
  });
  it('unfollow deletes only the caller’s bookmark', async () => {
    await setFollowed(STAFF, 'o1', false);
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'eq', args: ['user_id', STAFF] });
  });
});
