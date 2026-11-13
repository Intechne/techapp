import { BOOKMARK_COLUMNS, addBookmark, fetchBookmarks, fetchSaved, removeBookmark } from '../api';

// What org staff / anyone sees under RLS is still only their own bookmark rows; the client filters by user_id anyway.
type Call = { table: string; method: string; args: unknown[] };
const mockCalls: Call[] = [];
const mockBookmarks = [
  { id: 'b1', user_id: 'me', target_type: 'event', target_id: 'e1', created_at: '2026-11-03T00:00:00Z' },
  { id: 'b2', user_id: 'me', target_type: 'opportunity', target_id: 'o1', created_at: '2026-11-02T00:00:00Z' },
  { id: 'b3', user_id: 'me', target_type: 'team', target_id: 't1', created_at: '2026-11-01T00:00:00Z' },
  { id: 'b4', user_id: 'me', target_type: 'course', target_id: 'c1', created_at: '2026-10-31T00:00:00Z' },
  { id: 'b5', user_id: 'me', target_type: 'organization', target_id: 'g1', created_at: '2026-10-30T00:00:00Z' },
  { id: 'b6', user_id: 'other', target_type: 'event', target_id: 'e9', created_at: '2026-10-30T00:00:00Z' },
];
// RLS hides unpublished targets: o1 and c1 are not readable.
const mockReadable: Record<string, { id: string; title?: string; name?: string }[]> = {
  events: [{ id: 'e1', title: 'Hackathon' }], opportunities: [], teams: [{ id: 't1', name: 'Orbit Robotik' }], courses: [],
};
function mockBuilder(table: string) {
  const filters: Record<string, unknown> = {}; let inIds: string[] | null = null; let inTypes: string[] | null = null;
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'upsert', 'delete', 'overrideTypes']) b[m] = (...args: unknown[]) => { mockCalls.push({ table, method: m, args }); return b; };
  b.eq = (c: string, v: unknown) => { mockCalls.push({ table, method: 'eq', args: [c, v] }); filters[c] = v; return b; };
  b.in = (c: string, v: string[]) => { mockCalls.push({ table, method: 'in', args: [c, v] }); if (c === 'id') inIds = v; if (c === 'target_type') inTypes = v; return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    const data = table === 'bookmarks'
      ? mockBookmarks.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v) && (!inTypes || inTypes.includes(r.target_type))).map(({ user_id: _u, ...r }) => r)
      : (mockReadable[table] ?? []).filter((r) => !inIds || inIds.includes(r.id));
    return Promise.resolve({ data, error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));
beforeEach(() => { mockCalls.length = 0; });

describe('bookmarks api', () => {
  it('reads explicit columns, filtered by user_id (never RLS alone)', async () => {
    const rows = await fetchBookmarks('me');
    expect(BOOKMARK_COLUMNS).toBe('id, target_type, target_id, created_at');
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'select', args: [BOOKMARK_COLUMNS] });
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'eq', args: ['user_id', 'me'] });
    expect(rows.map((r) => r.id)).toEqual(['b1', 'b2', 'b3', 'b4']);
  });

  it('insert asks for the id back; delete is scoped to the caller', async () => {
    await addBookmark('me', 'event', 'e1');
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'select', args: ['id'] });
    mockCalls.length = 0;
    await removeBookmark('me', 'event', 'e1');
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'eq', args: ['user_id', 'me'] });
    expect(mockCalls).toContainEqual({ table: 'bookmarks', method: 'eq', args: ['target_type', 'event'] });
  });

  it('fetchSaved: readable targets get a title; unreadable ones are unavailable with no title; organisations are left out', async () => {
    const items = await fetchSaved('me');
    expect(items).toEqual([
      { type: 'event', id: 'e1', title: 'Hackathon', available: true },
      { type: 'opportunity', id: 'o1', title: null, available: false },
      { type: 'team', id: 't1', title: 'Orbit Robotik', available: true },
      { type: 'course', id: 'c1', title: null, available: false },
    ]);
  });
});
