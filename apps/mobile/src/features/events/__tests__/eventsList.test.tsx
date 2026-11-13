import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventsListScreen } from '../EventsListScreen';
import { EventFiltersScreen } from '../EventFiltersScreen';
import { DEFAULT_LIST_FILTERS, activeFilterCount, findEventsList, readListFilters, toListParams, toQueryFilters, type EventListParams } from '../filters';

// Save state is its own module (saved/__tests__); screens here only see ids + toggle.
const mockSaveToggle = jest.fn(); let mockSavedIds = new Set<string>();
jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: mockSavedIds, toggle: mockSaveToggle, pending: false, requiresAuth: false, ready: true }) }));
beforeEach(() => { mockSavedIds = new Set(); mockSaveToggle.mockClear(); });

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const event = (id: string, title: string) => ({
  id, title, type: 'workshop', format: 'in_person', city: 'İstanbul', venue: 'Salon', status: 'published',
  starts_at: iso(10), ends_at: iso(10.2), fee_minor_units: 0, tone: 'iris', poster_line: null, is_demo: false,
  capacity: null, seats_taken: 0, waitlist_enabled: false, registration_opens_at: null, registration_closes_at: iso(5),
  audience_note: null, min_age: null, max_age: null, organization: { id: 'o', name: 'Org', verification: 'verified' },
});

const data: { events: unknown[]; cities: unknown[] } = { events: [], cities: [] };
/** Every builder call of every events query, in order; one entry per query. */
const queries: { method: string; args: unknown[] }[][] = [];
function mockBuilder() {
  const calls: { method: string; args: unknown[] }[] = [];
  queries.push(calls);
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'gte', 'lte', 'in', 'not', 'or', 'order', 'limit', 'overrideTypes']) b[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    const cityQuery = calls.some((c) => c.method === 'select' && c.args[0] === 'city');
    return Promise.resolve({ data: cityQuery ? data.cities : data.events, error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: () => mockBuilder() }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));

const navigate = jest.fn();
const goBack = jest.fn();
const dispatch = jest.fn();
beforeEach(() => { data.events = []; data.cities = []; queries.length = 0; navigate.mockClear(); goBack.mockClear(); dispatch.mockClear(); });

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>;
};

/** The list keeps its filters in route params (the sheet hands them back that way); setParams merges like the native stack. */
function ListHarness({ initial }: { initial?: EventListParams }) {
  const [params, setParams] = useState<EventListParams>(initial);
  // The filter sheet lives on the root stack (above the tab bar): the list reaches it through its parents.
  const navigation = { navigate: jest.fn(), getState: () => ({ key: 'events-stack' }), getParent: () => ({ getParent: () => ({ navigate }) }), setParams: (p: Partial<NonNullable<EventListParams>>) => setParams((prev) => ({ ...prev, ...p })) };
  const props = { navigation, route: { key: 'k', name: 'EventsList', params } } as unknown as React.ComponentProps<typeof EventsListScreen>;
  return <EventsListScreen {...props} />;
}
const lastEventsQuery = () => [...queries].reverse().find((q) => q.some((c) => c.method === 'order'))!;

describe('Etkinlikler listesi — filtreler', () => {
  it('the Filtrele button carries the active filter count', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    await render(wrap(<ListHarness initial={{ type: 'hackathon', open: '1' }} />));
    expect(await screen.findByRole('button', { name: 'Filtrele · 2' })).toBeTruthy();
  });

  it('Filtrele opens the filter sheet with the current filters', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    await render(wrap(<ListHarness initial={{ city: 'Ankara' }} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Filtrele · 1' }));
    expect(navigate).toHaveBeenCalledWith('EventFilters', { city: 'Ankara', listKey: 'k', stackKey: 'events-stack' });
  });

  it('filtered-empty: "Bu filtrelerle sonuç yok" and "Filtreleri temizle" resets every filter', async () => {
    await render(wrap(<ListHarness initial={{ type: 'hackathon', format: 'online', city: 'Ankara', within: 'week', open: '1' }} />));
    expect(await screen.findByText('Bu filtrelerle sonuç yok')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filtrele · 5' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Filtreleri temizle' }));
    expect(await screen.findByRole('button', { name: 'Filtrele' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Yakında burası dolacak')).toBeTruthy());
    const q = lastEventsQuery();
    expect(q.filter((c) => c.method === 'eq').map((c) => c.args[0])).toEqual(['status']);
    expect(q.some((c) => c.method === 'in' || c.method === 'lte' || c.method === 'gt')).toBe(false);
    expect(screen.getByRole('button', { name: 'Tümü' }).props.accessibilityState.selected).toBe(true);
  });

  it('filters reach the existing list query (server-side), keyset paging untouched', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    await render(wrap(<ListHarness initial={{ type: 'competition', format: 'in_person', city: 'İzmir', within: 'month', open: '1' }} />));
    await screen.findAllByText('Robot atölyesi');
    const q = lastEventsQuery();
    const eq = Object.fromEntries(q.filter((c) => c.method === 'eq').map((c) => c.args));
    expect(eq).toEqual({ status: 'published', type: 'competition', city: 'İzmir' });
    expect(q.find((c) => c.method === 'in')?.args).toEqual(['format', ['in_person', 'hybrid']]);
    expect(q.find((c) => c.method === 'gt')?.args[0]).toBe('registration_closes_at');
    const lte = q.find((c) => c.method === 'lte')!;
    expect(lte.args[0]).toBe('starts_at');
    expect(Date.parse(String(lte.args[1])) - Date.now()).toBeGreaterThan(29 * DAY);
    expect(Date.parse(String(lte.args[1])) - Date.now()).toBeLessThan(31 * DAY);
    expect(q.find((c) => c.method === 'limit')?.args).toEqual([11]);
  });

  it('a type chip changes the type filter only', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    await render(wrap(<ListHarness initial={{ open: '1' }} />));
    await screen.findAllByText('Robot atölyesi');
    await fireEvent.press(screen.getByRole('button', { name: 'Hackathon' }));
    expect(await screen.findByRole('button', { name: 'Filtrele · 2' })).toBeTruthy();
  });

  it('every poster carries the save control: filled + "Kaydedildi" when saved, a tap toggles that event only', async () => {
    data.events = [event('e1', 'Robot atölyesi'), event('e2', 'Hackathon günü')];
    mockSavedIds = new Set(['e2']);
    await render(wrap(<ListHarness />));
    await screen.findAllByText('Robot atölyesi');
    const save = screen.getByRole('button', { name: 'Kaydet' });
    const saved = screen.getByRole('button', { name: 'Kaydedildi' });
    expect(saved.props.accessibilityState).toMatchObject({ selected: true });
    expect(save.props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(save);
    expect(mockSaveToggle).toHaveBeenCalledWith('e1');
    expect(navigate).not.toHaveBeenCalledWith('EventDetail', expect.anything());
  });

  it('the slogan eyebrow is gone (eyebrow is for categories only)', async () => {
    await render(wrap(<ListHarness />));
    expect(screen.queryByText('MERAKINI HAREKETE GEÇİR')).toBeNull();
  });
});

describe('filter params (route params are strings on web)', () => {
  it('reads, validates and writes back without defaults', () => {
    expect(readListFilters(undefined)).toEqual(DEFAULT_LIST_FILTERS);
    expect(readListFilters({ type: 'nope', format: 'x', within: 'decade', open: 'false' })).toEqual(DEFAULT_LIST_FILTERS);
    const f = readListFilters({ type: 'hackathon', format: 'online', city: ' Ankara ', within: 'quarter', open: 'true' });
    expect(f).toEqual({ type: 'hackathon', format: 'online', city: 'Ankara', within: 'quarter', openOnly: true });
    expect(readListFilters({ open: true }).openOnly).toBe(true);
    expect(toListParams(f)).toEqual({ type: 'hackathon', format: 'online', city: 'Ankara', within: 'quarter', open: '1' });
    expect(toListParams(DEFAULT_LIST_FILTERS)).toEqual({});
    expect(activeFilterCount(f)).toBe(5);
    expect(activeFilterCount(DEFAULT_LIST_FILTERS)).toBe(0);
  });
  it('maps to the query filters', () => {
    expect(toQueryFilters(DEFAULT_LIST_FILTERS)).toEqual({ type: 'all' });
    expect(toQueryFilters({ ...DEFAULT_LIST_FILTERS, format: 'online', openOnly: true }))
      .toEqual({ type: 'all', format: 'online', registrationOpenOnly: true });
  });
});

/** Root stack: Main (tabs → Events stack → EventsList) with the filter sheet on top of it, so it covers the tab bar. */
const ROOT_STATE = {
  key: 'root', routes: [
    { name: 'Main', key: 'main', state: { key: 'tabs', routes: [
      { name: 'DiscoverTab', key: 'dt' },
      { name: 'EventsTab', key: 'et', state: { key: 'events-stack', routes: [{ name: 'EventsList', key: 'list-1' }, { name: 'EventDetail', key: 'd1' }] } },
    ] } },
    { name: 'EventFilters', key: 's' },
  ],
};

describe('findEventsList', () => {
  it('finds the list route and its stack inside the tabs', () => {
    expect(findEventsList(ROOT_STATE)).toEqual({ stackKey: 'events-stack', listKey: 'list-1' });
  });
  it('null when the Events stack has not been mounted', () => {
    expect(findEventsList({ key: 'root', routes: [{ name: 'Main', key: 'main' }] })).toBeNull();
    expect(findEventsList(undefined)).toBeNull();
  });
});

describe('EventFiltersScreen (form sheet)', () => {
  async function renderSheet(params: EventListParams) {
    const navigation = { goBack, dispatch, getState: () => ROOT_STATE };
    const props = { navigation, route: { key: 's', name: 'EventFilters', params } } as unknown as React.ComponentProps<typeof EventFiltersScreen>;
    await render(wrap(<EventFiltersScreen {...props} />));
  }
  it('starts from the list filters and hands the edited set back to the list', async () => {
    data.cities = [{ city: 'İzmir' }, { city: 'Ankara' }, { city: 'Ankara' }, { city: null }];
    await renderSheet({ type: 'hackathon' });
    expect(screen.getByRole('button', { name: 'Hackathon' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ankara' }));
    await fireEvent.press(screen.getByRole('button', { name: '7 gün içinde' }));
    await fireEvent.press(screen.getByText('Yalnız kaydı açık olanlar'));
    await fireEvent.press(screen.getByRole('button', { name: 'Sonuçları göster' }));
    const last = dispatch.mock.calls.at(-1)![0];
    expect(last).toMatchObject({ type: 'SET_PARAMS', source: 'list-1', target: 'events-stack' });
    expect(last.payload.params).toEqual({ type: 'hackathon', format: undefined, city: 'Ankara', within: 'week', open: '1' });
    expect(goBack).toHaveBeenCalledTimes(1);
  });
  it('each change is applied to the list behind the sheet at once (setParams on the list route, cleared keys included)', async () => {
    await renderSheet({ type: 'hackathon', city: 'Ankara' });
    await fireEvent.press(screen.getByRole('button', { name: '7 gün içinde' }));
    const last = dispatch.mock.calls.at(-1)![0];
    expect(last.source).toBe('list-1');
    expect(last.target).toBe('events-stack');
    expect(last.type).toBe('SET_PARAMS');
    expect(last.payload.params).toEqual({ type: 'hackathon', format: undefined, city: 'Ankara', within: 'week', open: undefined });
    await fireEvent.press(screen.getByRole('button', { name: 'Temizle' }));
    expect(dispatch.mock.calls.at(-1)![0].payload.params).toEqual({ type: undefined, format: undefined, city: undefined, within: undefined, open: undefined });
  });
  it('cities come from the published events, de-duplicated and sorted in Turkish order', async () => {
    data.cities = [{ city: 'İzmir' }, { city: 'Ankara' }, { city: 'Ankara' }, { city: 'Çanakkale' }];
    await renderSheet(undefined);
    await screen.findByRole('button', { name: 'İzmir' });
    const labels = screen.getAllByText(/^(Ankara|Çanakkale|İzmir)$/).map((n) => n.props.children);
    expect(labels).toEqual(['Ankara', 'Çanakkale', 'İzmir']);
  });
  it('the keys the list passed win over the state lookup (a fresh nested stack is not in the root snapshot yet)', async () => {
    const navigation = { goBack, dispatch, getState: () => ({ key: 'root', routes: [{ name: 'Main', key: 'main' }] }) };
    const props = { navigation, route: { key: 's', name: 'EventFilters', params: { type: 'hackathon', listKey: 'L', stackKey: 'S' } } } as unknown as React.ComponentProps<typeof EventFiltersScreen>;
    await render(wrap(<EventFiltersScreen {...props} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Sonuçları göster' }));
    expect(dispatch.mock.calls.at(-1)![0]).toMatchObject({ source: 'L', target: 'S' });
    expect(dispatch.mock.calls.at(-1)![0].payload.params.type).toBe('hackathon');
  });
  it('"Temizle" resets the sheet; showing results then returns no filters', async () => {
    await renderSheet({ type: 'hackathon', open: '1' });
    await fireEvent.press(screen.getByRole('button', { name: 'Temizle' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sonuçları göster' }));
    expect(dispatch.mock.calls.at(-1)![0].payload.params).toEqual({ type: undefined, format: undefined, city: undefined, within: undefined, open: undefined });
    expect(goBack).toHaveBeenCalled();
  });
});
