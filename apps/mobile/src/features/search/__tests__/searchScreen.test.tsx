import React from 'react';
import { fireEvent, render, renderHook, act, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SearchScreen } from '../SearchScreen';
import { SEARCH_DEBOUNCE_MS } from '../query';
import { useDebouncedValue } from '../useDebouncedValue';

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const event = (id: string, title: string) => ({ id, title, type: 'workshop', format: 'in_person', city: 'İstanbul', starts_at: iso(10), ends_at: iso(10.2), tone: 'iris', is_demo: false, cover_path: null, cover_blurhash: null });
const opportunity = (id: string, title: string) => ({ id, title, type: 'internship', closes_at: iso(12), is_remote: true, city: null, audience_note: null, reward_note: null, is_demo: false, cover_path: null, cover_blurhash: null });
const team = (id: string, name: string) => ({ id, name, kind: 'team', category: 'Robotik', category_key: 'robotics', tagline: 'Birlikte üretiyoruz', city: 'İstanbul', member_count: 4, is_demo: false });
const course = (id: string, title: string) => ({ id, title, summary: 'Özet', level: 'beginner', tone: 'moss', estimated_minutes: 30, lesson_count: 4, is_demo: false, published_at: iso(-1) });

// ---- query builder mock: rows per table, matched against the ilike pattern like Postgres would (ASCII case-insensitive here)
type Row = { id: string; title?: string; name?: string };
const data: Record<string, Row[]> = { events: [], opportunities: [], teams: [], courses: [] };
let errorTables: string[] = [];
/** Pattern → a promise the test resolves itself (stale-response test). */
const gates = new Map<string, Promise<void>>();
const requests: { table: string; pattern: string; limit: number }[] = [];
const toRegex = (pattern: string) => new RegExp(`^${pattern.replace(/\\([%_\\])|([%_])|([.*+?^${}()|[\]])/g, (_m, esc, wild, meta) => (esc ? `\\${esc}` : wild === '%' ? '.*' : wild === '_' ? '.' : `\\${meta}`))}$`, 'is');
function mockBuilder(table: string) {
  let pattern = ''; let column = ''; let limit = 0;
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'gte', 'order']) b[m] = () => b;
  b.ilike = (c: string, p: string) => { column = c; pattern = p; return b; };
  b.limit = (n: number) => { limit = n; return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    requests.push({ table, pattern, limit });
    const gate = gates.get(pattern) ?? Promise.resolve();
    return gate.then(() => {
      if (errorTables.includes(table)) return { data: null, error: { message: 'Failed to fetch', code: '' } };
      const re = toRegex(pattern);
      return { data: (data[table] ?? []).filter((r) => re.test(String((r as Record<string, unknown>)[column] ?? ''))).slice(0, limit), error: null };
    }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));

beforeEach(() => {
  Object.assign(data, { events: [], opportunities: [], teams: [], courses: [] });
  errorTables = []; gates.clear(); requests.length = 0;
  navigate.mockClear(); push.mockClear(); parentNavigate.mockClear(); goBack.mockClear();
});

const navigate = jest.fn(); const push = jest.fn(); const goBack = jest.fn(); const parentNavigate = jest.fn();
function renderScreen(params?: { query?: string; group?: 'events' | 'opportunities' | 'teams' | 'courses' }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const navigation = { navigate, push, goBack, getParent: () => ({ navigate: parentNavigate }) };
  const props = { navigation, route: { key: 'k', name: 'Search', params } } as unknown as React.ComponentProps<typeof SearchScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><SearchScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
}
const field = () => screen.getByPlaceholderText('Etkinlik, fırsat, takım ara');
async function type(text: string) { await fireEvent.changeText(field(), text); }
const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('settles 300 ms after the last change', async () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, SEARCH_DEBOUNCE_MS), { initialProps: { v: 'a' } });
    await rerender({ v: 'ab' });
    await act(async () => { jest.advanceTimersByTime(200); });
    await rerender({ v: 'abc' });
    await act(async () => { jest.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(result.current).toBe('abc');
  });
});

describe('Arama — alan ve ipucu', () => {
  it('the field is focused on arrival, and under 2 characters shows the hint without asking the server', async () => {
    await renderScreen();
    expect(field().props.autoFocus).toBe(true);
    expect(screen.getByText('En az 2 harf yaz; etkinlik, fırsat, takım ve eğitimlerde ararız.')).toBeTruthy();
    await type(' r ');
    await sleep(SEARCH_DEBOUNCE_MS + 50);
    expect(requests).toEqual([]);
    expect(screen.getByText('En az 2 harf yaz; etkinlik, fırsat, takım ve eğitimlerde ararız.')).toBeTruthy();
  });

  it('debounces: typing quickly sends one search, for the last text, and none before 300 ms', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    await renderScreen();
    await type('ro'); await type('rob'); await type('robo');
    await sleep(150);
    expect(requests).toEqual([]);
    expect(await screen.findByText('Robot atölyesi')).toBeTruthy();
    expect([...new Set(requests.map((r) => r.pattern))]).toEqual(['%robo%']);
  });
});

describe('Arama — gruplar', () => {
  it('shows Etkinlikler, Fırsatlar, Takımlar, Eğitimler in that order, each with its own rows', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    data.opportunities = [opportunity('o1', 'Robot stajı')];
    data.teams = [team('t1', 'Robot Takımı')];
    data.courses = [course('c1', 'Robot 101')];
    await renderScreen();
    await type('robot');
    await screen.findByText('Robot 101');
    const order = ['Etkinlikler', 'Fırsatlar', 'Takımlar', 'Eğitimler'].map((h) => screen.getByText(h));
    expect(order).toHaveLength(4);
    const json = JSON.stringify(screen.toJSON());
    const at = (s: string) => json.indexOf(`"${s}"`);
    expect(at('Etkinlikler')).toBeLessThan(at('Robot atölyesi'));
    expect(at('Robot atölyesi')).toBeLessThan(at('Fırsatlar'));
    expect(at('Fırsatlar')).toBeLessThan(at('Takımlar'));
    expect(at('Takımlar')).toBeLessThan(at('Eğitimler'));
    expect(screen.queryByText('Tümünü gör')).toBeNull(); // no group has more than it shows
  });

  it('a group with nothing is left out; at most 5 rows; "Tümünü gör" only where there are more', async () => {
    data.events = Array.from({ length: 7 }, (_, i) => event(`e${i}`, `Robot etkinliği ${i}`));
    data.teams = [team('t1', 'Robot Takımı')];
    await renderScreen();
    await type('robot');
    await screen.findByText('Robot Takımı');
    expect(screen.queryByText('Fırsatlar')).toBeNull();
    expect(screen.queryByText('Eğitimler')).toBeNull();
    expect(screen.getAllByText(/^Robot etkinliği \d$/)).toHaveLength(5);
    expect(screen.getAllByText('Tümünü gör')).toHaveLength(1);
    await fireEvent.press(screen.getByText('Tümünü gör'));
    expect(push).toHaveBeenCalledWith('Search', { query: 'robot', group: 'events' });
  });

  it('opens each result where it lives', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    data.opportunities = [opportunity('o1', 'Robot stajı')];
    data.teams = [team('t1', 'Robot Takımı')];
    data.courses = [course('c1', 'Robot 101')];
    await renderScreen();
    await type('robot');
    await fireEvent.press(await screen.findByText('Robot atölyesi'));
    await fireEvent.press(screen.getByText('Robot stajı'));
    await fireEvent.press(screen.getByText('Robot Takımı'));
    await fireEvent.press(screen.getByText('Robot 101'));
    expect(navigate.mock.calls).toEqual([['EventDetail', { eventId: 'e1' }], ['CourseDetail', { courseId: 'c1' }]]);
    expect(parentNavigate.mock.calls).toEqual([
      ['OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: 'o1' }, initial: false }],
      ['CommunityTab', { screen: 'TeamDetail', params: { teamId: 't1' }, initial: false }],
    ]);
  });

  it('Turkish case: "İSTANBUL" finds a row titled "istanbul …" through the second pattern', async () => {
    data.events = [event('e1', 'istanbul robot buluşması')];
    await renderScreen();
    await type('İSTANBUL');
    expect(await screen.findByText('istanbul robot buluşması')).toBeTruthy();
    expect([...new Set(requests.filter((r) => r.table === 'events').map((r) => r.pattern))]).toEqual(['%İSTANBUL%', '%istanbul%']);
  });
});

describe('Arama — sonuç yok, hata, eski yanıt', () => {
  it('no results: “…” için sonuç yok with suggestion chips that lead somewhere', async () => {
    await renderScreen();
    await type('zzqx');
    expect(await screen.findByText('“zzqx” için sonuç yok')).toBeTruthy();
    await fireEvent.press(screen.getByText('Etkinliklere göz at'));
    await fireEvent.press(screen.getByText('Fırsatlara göz at'));
    await fireEvent.press(screen.getByText('Takımlara göz at'));
    await fireEvent.press(screen.getByText('Eğitimlere göz at'));
    expect(parentNavigate.mock.calls.map((c) => c[0])).toEqual(['EventsTab', 'OpportunitiesTab', 'CommunityTab']);
    expect(navigate).toHaveBeenCalledWith('CourseList');
  });

  it('one group failing: the others still show, the failed one says so inline with a retry', async () => {
    data.opportunities = [opportunity('o1', 'Robot stajı')];
    data.teams = [team('t1', 'Robot Takımı')];
    errorTables = ['events'];
    await renderScreen();
    await type('robot');
    expect(await screen.findByText('Etkinlikler yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Robot stajı')).toBeTruthy();
    expect(screen.getByText('Robot Takımı')).toBeTruthy();
    expect(screen.queryByText('“robot” için sonuç yok')).toBeNull();
    errorTables = []; data.events = [event('e1', 'Robot atölyesi')];
    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(await screen.findByText('Robot atölyesi')).toBeTruthy();
    expect(screen.queryByText('Etkinlikler yüklenemedi')).toBeNull();
  });

  it('a slow answer for an older query never replaces the newer one', async () => {
    data.events = [event('e1', 'Robot atölyesi'), event('e2', 'Lehim atölyesi')];
    let release!: () => void;
    gates.set('%robot%', new Promise<void>((r) => { release = r; }));
    await renderScreen();
    await type('robot');
    await waitFor(() => expect(requests.some((r) => r.pattern === '%robot%')).toBe(true));
    await type('lehim');
    expect(await screen.findByText('Lehim atölyesi')).toBeTruthy();
    await act(async () => { release(); });
    await sleep(20);
    expect(screen.getByText('Lehim atölyesi')).toBeTruthy();
    expect(screen.queryByText('Robot atölyesi')).toBeNull();
  });
});

describe('Arama — tek grup ("Tümünü gör")', () => {
  it('shows only that group, prefilled, up to 30 rows', async () => {
    data.events = Array.from({ length: 8 }, (_, i) => event(`e${i}`, `Robot etkinliği ${i}`));
    data.teams = [team('t1', 'Robot Takımı')];
    await renderScreen({ query: 'robot', group: 'events' });
    expect(field().props.value).toBe('robot');
    await screen.findByText('Robot etkinliği 7');
    expect(screen.getAllByText(/^Robot etkinliği \d$/)).toHaveLength(8);
    expect(screen.queryByText('Robot Takımı')).toBeNull();
    expect(new Set(requests.map((r) => r.table))).toEqual(new Set(['events']));
    expect(requests[0]!.limit).toBe(31);
    expect(screen.queryByText('Tümünü gör')).toBeNull();
  });
});
