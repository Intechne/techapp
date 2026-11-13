import { EVENT_SEARCH_COLUMNS, SEARCH, searchGroup } from '../api';
import { COURSE_COLUMNS } from '../../learning/api';
import { OPPORTUNITY_CARD_COLUMNS } from '../../opportunities/api';
import { TEAM_PUBLIC_COLUMNS } from '../../teams/api';
import { EVENT_PUBLIC_FIELDS } from '../../events/api';

type Call = { table: string; method: string; args: unknown[] };
const mockCalls: Call[] = [];
/** Rows each pattern returns, per table: `${table}|${pattern}` → rows. Unlisted → no rows. */
let mockRows: Record<string, { id: string; [k: string]: unknown }[]> = {};
let mockFail: string | null = null;
function mockBuilder(table: string) {
  let pattern = '';
  const b: Record<string, unknown> = {};
  // `or`, `filter`, `ilikeAnyOf`, `textSearch` are recorded so a test can prove user text never reaches them.
  for (const m of ['select', 'eq', 'gt', 'gte', 'in', 'order', 'limit', 'or', 'filter', 'ilikeAnyOf', 'textSearch', 'match', 'not']) {
    b[m] = (...args: unknown[]) => { mockCalls.push({ table, method: m, args }); return b; };
  }
  b.ilike = (...args: unknown[]) => { mockCalls.push({ table, method: 'ilike', args }); pattern = String(args[1]); return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    if (mockFail === `${table}|${pattern}` || mockFail === table) return Promise.resolve({ data: null, error: { message: 'Failed to fetch', code: '' } }).then(resolve);
    return Promise.resolve({ data: mockRows[`${table}|${pattern}`] ?? [], error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));
beforeEach(() => { mockCalls.length = 0; mockRows = {}; mockFail = null; });

const of = (table: string, method: string) => mockCalls.filter((c) => c.table === table && c.method === method).map((c) => c.args);

describe('search api — one ilike filter per request, never an or() string', () => {
  it.each(['a,b', '(x)', '"q"', "'; drop", '100%_robot', '\\'])('%s reaches the server only as the value of .ilike(column, pattern)', async (input) => {
    for (const g of ['events', 'opportunities', 'teams', 'courses'] as const) await searchGroup(g, input, 5);
    for (const m of ['or', 'filter', 'ilikeAnyOf', 'textSearch', 'match']) expect(mockCalls.filter((c) => c.method === m)).toEqual([]);
    const ilikes = mockCalls.filter((c) => c.method === 'ilike');
    expect(ilikes.length).toBeGreaterThanOrEqual(4);
    for (const c of ilikes) expect(c.args).toHaveLength(2);
    // Whatever the input, nothing else carries it: every other argument is a constant of ours.
    const encoded = JSON.stringify(input).slice(1, -1);
    for (const c of mockCalls.filter((x) => x.method !== 'ilike')) expect(JSON.stringify(c.args)).not.toContain(encoded);
  });

  it('escapes % and _ in the filter value', async () => {
    await searchGroup('events', '100%_robot', 5);
    expect(of('events', 'ilike')).toEqual([['title', '%100\\%\\_robot%']]);
  });

  it('reads explicit column lists (never *) and the same visibility rule as each list screen', async () => {
    for (const g of ['events', 'opportunities', 'teams', 'courses'] as const) await searchGroup(g, 'robot', 5);
    expect(of('events', 'select')).toEqual([[EVENT_SEARCH_COLUMNS]]);
    expect(of('opportunities', 'select')).toEqual([[OPPORTUNITY_CARD_COLUMNS]]);
    expect(of('teams', 'select')).toEqual([[TEAM_PUBLIC_COLUMNS]]);
    expect(of('courses', 'select')).toEqual([[COURSE_COLUMNS]]);
    // Etkinlikler: published and not ended. Fırsatlar: published, deadline not passed. Gelişim: published with lessons. Topluluk: active.
    expect(of('events', 'eq')).toEqual([['status', 'published']]);
    expect(of('events', 'gte').map((a) => a[0])).toEqual(['ends_at']);
    expect(of('opportunities', 'eq')).toEqual([['status', 'published']]);
    expect(of('opportunities', 'gte').map((a) => a[0])).toEqual(['closes_at']);
    expect(of('teams', 'eq')).toEqual([['moderation_status', 'active']]);
    expect(of('courses', 'eq')).toEqual([['status', 'published']]);
    expect(of('courses', 'gt')).toEqual([['lesson_count', 0]]);
    expect(of('events', 'ilike')).toEqual([['title', '%robot%']]);
    expect(of('opportunities', 'ilike')).toEqual([['title', '%robot%']]);
    expect(of('teams', 'ilike')).toEqual([['name', '%robot%']]);
    expect(of('courses', 'ilike')).toEqual([['title', '%robot%']]);
  });

  it('the event columns are a subset of the public event list (no description, no staff ids)', () => {
    const cols = EVENT_SEARCH_COLUMNS.split(', ');
    for (const c of cols) expect(EVENT_PUBLIC_FIELDS as readonly string[]).toContain(c);
    expect(cols).not.toContain('description');
  });

  it('asks one more row than it shows, so "Tümünü gör" appears only when there is more', async () => {
    await searchGroup('teams', 'robot', 5);
    expect(of('teams', 'limit')).toEqual([[6]]);
    mockRows['teams|%robot%'] = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `Robot ${i}`, member_count: 10 - i }));
    const more = await searchGroup('teams', 'robot', 5);
    expect(more.hits.map((t) => t.id)).toEqual(['t0', 't1', 't2', 't3', 't4']);
    expect(more.hasMore).toBe(true);
    mockRows['teams|%robot%'] = mockRows['teams|%robot%'].slice(0, 5);
    expect((await searchGroup('teams', 'robot', 5)).hasMore).toBe(false);
  });
});

describe('search api — Turkish case: second pattern, merged by id', () => {
  it('"İSTANBUL" runs the typed and the Turkish-lower pattern and merges the rows by id, in list order', async () => {
    const a = { id: 'e1', title: 'İstanbul Kampı', starts_at: '2026-12-02T10:00:00Z' };
    const b = { id: 'e2', title: 'istanbul gençlik', starts_at: '2026-12-01T10:00:00Z' };
    mockRows['events|%İSTANBUL%'] = [a];
    mockRows['events|%istanbul%'] = [b, a];
    const r = await searchGroup('events', 'İSTANBUL', 5);
    expect(of('events', 'ilike')).toEqual([['title', '%İSTANBUL%'], ['title', '%istanbul%']]);
    expect(r.hits.map((e) => e.id)).toEqual(['e2', 'e1']); // starts_at ascending, e1 once
  });

  it('a query with no Turkish-specific letter is one request per group', async () => {
    await searchGroup('courses', 'Robot', 5);
    expect(of('courses', 'ilike')).toHaveLength(1);
  });

  it('if any pattern’s request fails, the group fails (never a silently partial list)', async () => {
    mockFail = 'events|%istanbul%';
    mockRows['events|%İSTANBUL%'] = [{ id: 'e1', title: 'İstanbul', starts_at: '2026-12-02T10:00:00Z' }];
    await expect(searchGroup('events', 'İSTANBUL', 5)).rejects.toMatchObject({ code: 'network_unreachable' });
  });

  it('each group sorts like its list: teams by member count, courses newest first, opportunities by deadline', async () => {
    mockRows['teams|%_ş_k%'] = [{ id: 'a', member_count: 1 }, { id: 'b', member_count: 9 }];
    expect((await SEARCH.teams('ışık', 5)).hits.map((t) => t.id)).toEqual(['b', 'a']);
    mockRows['courses|%arduino%'] = [{ id: 'old', published_at: '2026-01-01T00:00:00Z' }, { id: 'new', published_at: '2026-10-01T00:00:00Z' }];
    expect((await SEARCH.courses('arduino', 5)).hits.map((c) => c.id)).toEqual(['new', 'old']);
    mockRows['opportunities|%staj%'] = [{ id: 'late', closes_at: '2026-12-30T00:00:00Z' }, { id: 'soon', closes_at: '2026-11-20T00:00:00Z' }];
    expect((await SEARCH.opportunities('staj', 5)).hits.map((o) => o.id)).toEqual(['soon', 'late']);
  });
});
