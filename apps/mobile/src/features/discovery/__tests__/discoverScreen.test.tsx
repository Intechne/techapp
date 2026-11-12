import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DiscoverScreen } from '../DiscoverScreen';

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

const event = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id, title, type: 'workshop', format: 'in_person', city: 'İstanbul', venue: 'Salon', status: 'published',
  starts_at: iso(10), ends_at: iso(10.2), fee_minor_units: 0, tone: 'iris', poster_line: null, is_demo: false,
  capacity: null, seats_taken: 0, waitlist_enabled: false, registration_opens_at: null, registration_closes_at: iso(5),
  audience_note: null, min_age: null, max_age: null, organization: { id: 'o', name: 'Org', verification: 'verified' }, ...over,
});
const opportunity = (id: string, title: string) => ({
  id, title, type: 'internship', status: 'published', closes_at: iso(12), is_remote: true, city: null,
  audience_note: null, reward_note: null, is_demo: false,
});
const team = (id: string, name: string) => ({ id, name, kind: 'team', category: 'Robotik', tagline: 'Birlikte üretiyoruz', city: 'İstanbul', member_count: 4, is_demo: false });

const data: { events: unknown[]; opportunities: unknown[]; teams: unknown[]; interests: unknown[]; pending: boolean; pendingTables: string[] } = {
  events: [], opportunities: [], teams: [], interests: [], pending: false, pendingTables: [],
};
const calls: { table: string }[] = [];

function mockBuilder(table: string) {
  calls.push({ table });
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'in', 'or', 'order', 'limit', 'overrideTypes']) b[m] = () => b;
  b.then = (resolve: (v: unknown) => unknown) => {
    if (data.pending || data.pendingTables.includes(table)) return new Promise(() => {}).then(resolve);
    const rows = (data as unknown as Record<string, unknown[]>)[table] ?? [];
    return Promise.resolve({ data: rows, error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));

let mockProfile: { display_name: string } | undefined;
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../profile/api', () => ({ useMyProfile: () => ({ data: mockProfile }) }));

beforeEach(() => {
  Object.assign(data, { events: [], opportunities: [], teams: [], interests: [], pending: false, pendingTables: [] });
  calls.length = 0;
  mockProfile = undefined;
});

const navigate = jest.fn();
const parentNavigate = jest.fn();
beforeEach(() => { navigate.mockClear(); parentNavigate.mockClear(); });

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const navigation = { navigate, getParent: () => ({ navigate: parentNavigate }) };
  const props = { navigation, route: { key: 'k', name: 'DiscoverHome' } } as unknown as React.ComponentProps<typeof DiscoverScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><DiscoverScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
}

type Node = string | { type: string; children: Node[] | null; props: Record<string, unknown> };
/** All rendered text strings in document order. */
function texts(node: Node | Node[] | null): string[] {
  if (node === null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  return (node.children ?? []).flatMap(texts);
}
const rendered = () => texts(screen.toJSON() as Node | Node[] | null);

const HEADINGS = ['Yaklaşan etkinlikler', 'Sıradaki adımın', 'Birlikte üretenler', 'Gelişim'];
const headingOrder = () => rendered().filter((t) => HEADINGS.includes(t));

describe('Keşfet ana — bölüm hiyerarşisi', () => {
  it('orders vitrin → Yaklaşan → Sıradaki adımın → Birlikte üretenler', async () => {
    data.events = [event('e1', 'Açık kayıtlı vitrin etkinliği'), event('e2', 'İkinci etkinlik'), event('e3', 'Üçüncü etkinlik')];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    data.teams = [team('t1', 'Robotik Takımı')];
    await renderScreen();
    await screen.findByText('Birlikte üretenler');
    expect(headingOrder()).toEqual(['Yaklaşan etkinlikler', 'Sıradaki adımın', 'Birlikte üretenler']);
    const all = rendered();
    const at = (s: string) => all.indexOf(s);
    expect(at('Detayları gör')).toBeGreaterThan(-1);
    expect(at('Detayları gör')).toBeLessThan(at('Yaklaşan etkinlikler'));
    expect(at('Yaklaşan etkinlikler')).toBeLessThan(at('İkinci etkinlik'));
    expect(at('Yaz stajı')).toBeGreaterThan(at('Sıradaki adımın'));
    expect(at('Robotik Takımı')).toBeGreaterThan(at('Birlikte üretenler'));
  });

  it('shows at most 3 upcoming posters, and the vitrin event is not repeated in the list', async () => {
    data.events = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => event(k, `Etkinlik ${k}`));
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    // a is the vitrin (HeroCard title is the poster line = title), b-d are the 3 posters, e-f cut off.
    expect(screen.getAllByLabelText(/Etkinlik a\b/)).toHaveLength(1);
    for (const k of ['b', 'c', 'd']) expect(screen.getAllByText(`Etkinlik ${k}`).length).toBeGreaterThan(0);
    expect(screen.queryByText('Etkinlik e')).toBeNull();
    expect(screen.queryByText('Etkinlik f')).toBeNull();
  });

  it('with no vitrin, the first block after the chips is the "Yaklaşan etkinlikler" heading (no spacer)', async () => {
    // Only a full event without a waitlist qualifies as no-vitrin: capacity reached.
    data.events = [event('e1', 'Dolu etkinlik', { capacity: 10, seats_taken: 10 }), event('e2', 'Başka dolu', { capacity: 5, seats_taken: 5 })];
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    expect(screen.queryByText('Detayları gör')).toBeNull();
    const all = rendered();
    expect(all[all.indexOf('Tümü') + 1]).toBe('Yaklaşan etkinlikler');
  });

  it('never lists an event whose registration is closed under Yaklaşan', async () => {
    data.events = [
      event('e1', 'Kaydı kapanmış etkinlik', { registration_closes_at: iso(-1) }),
      event('e2', 'Kaydı açık etkinlik', { capacity: 4, seats_taken: 1, registration_closes_at: iso(3) }),
      event('e3', 'Ikinci açık etkinlik', { capacity: 40, seats_taken: 1 }),
    ];
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    expect(screen.queryAllByText('Kaydı kapanmış etkinlik')).toHaveLength(0);
    expect(screen.getAllByText('Ikinci açık etkinlik').length).toBeGreaterThan(0);
  });

  it('never renders Gelişim (no course screen yet) and makes no course request', async () => {
    data.events = [event('e1', 'Etkinlik')];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    await renderScreen();
    await screen.findByText('Sıradaki adımın');
    expect(screen.queryByText('Gelişim')).toBeNull();
    expect(calls.some((c) => c.table === 'courses')).toBe(false);
  });

  it('hides an empty section; the rest stay', async () => {
    data.events = [event('e1', 'Etkinlik'), event('e2', 'Etkinlik iki')];
    data.teams = [team('t1', 'Robotik Takımı')];
    await renderScreen();
    await screen.findByText('Birlikte üretenler');
    expect(headingOrder()).toEqual(['Yaklaşan etkinlikler', 'Birlikte üretenler']);
  });

  it('all sections empty → exactly one EmptyState with the plan copy', async () => {
    await renderScreen();
    expect(await screen.findByText('Şu an yayında içerik yok')).toBeTruthy();
    expect(screen.getByText('İlgi alanlarını genişlet; yeni etkinlik ve fırsatlar eklendikçe burada görünür.')).toBeTruthy();
    expect(screen.getAllByText('Şu an yayında içerik yok')).toHaveLength(1);
    expect(headingOrder()).toEqual([]);
  });

  it('only closed-registration events and nothing else counts as empty', async () => {
    data.events = [event('e1', 'Kapalı', { registration_closes_at: iso(-2) })];
    await renderScreen();
    expect(await screen.findByText('Şu an yayında içerik yok')).toBeTruthy();
    expect(screen.queryByText('Kapalı')).toBeNull();
  });
});

describe('Keşfet ana — bölüm eylemleri', () => {
  it('"Tümünü gör" goes to Etkinlikler, Fırsatlar and Topluluk in section order', async () => {
    data.events = [event('e1', 'Etkinlik'), event('e2', 'Etkinlik iki')];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    data.teams = [team('t1', 'Robotik Takımı')];
    await renderScreen();
    await screen.findByText('Birlikte üretenler');
    const links = screen.getAllByText('Tümünü gör');
    expect(links).toHaveLength(3);
    await fireEvent.press(links[0]!);
    await fireEvent.press(links[1]!);
    await fireEvent.press(links[2]!);
    expect(parentNavigate.mock.calls.map((c) => c[0])).toEqual(['EventsTab', 'OpportunitiesTab', 'CommunityTab']);
  });

  it('opening the vitrin goes to the event detail', async () => {
    data.events = [event('e1', 'Vitrin etkinliği')];
    await renderScreen();
    await fireEvent.press(await screen.findByText('Detayları gör'));
    expect(navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'e1' });
  });

  it('keeps the Katılımlarım ticket button in the header', async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Katılımlarım'));
    expect(navigate).toHaveBeenCalledWith('MyRegistrations');
  });
});

describe('Keşfet ana — selam, arama, yükleniyor', () => {
  it('greets a signed-in user by first name and a guest plainly', async () => {
    mockProfile = { display_name: 'Ayşe Yılmaz' };
    const a = await renderScreen();
    expect(await screen.findByText('Merhaba Ayşe')).toBeTruthy();
    await a.unmount();
    mockProfile = undefined;
    await renderScreen();
    expect(await screen.findByText('Merhaba')).toBeTruthy();
    expect(screen.queryByText(/Merhaba Ayşe/)).toBeNull();
  });

  it('has no slogan eyebrow under the headline (approved Q2)', async () => {
    await renderScreen();
    await screen.findByText('Merhaba');
    expect(screen.queryByText('Keşfet, birlikte üret, iz bırak.')).toBeNull();
  });

  it('shows the loading skeleton while data is pending', async () => {
    data.pending = true;
    await renderScreen();
    expect((await screen.findAllByLabelText('Yükleniyor')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Şu an yayında içerik yok')).toBeNull();
  });

  it('while the opportunity preview loads, a row skeleton stands under its heading and the events are already shown', async () => {
    data.events = [event('e1', 'Etkinlik'), event('e2', 'Etkinlik iki')];
    data.pendingTables = ['opportunities'];
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    expect(await screen.findAllByLabelText('Yükleniyor')).toHaveLength(1);
    const all = rendered();
    expect(all.indexOf('Sıradaki adımın')).toBeGreaterThan(all.indexOf('Yaklaşan etkinlikler'));
  });

  // 3b'ye bağlı, atlandı: the Search screen and notification bell are Faz 3b modules (not merged). Until a `Search`
  // route exists the field keeps submitting an in-place event search, and the bell is omitted.
  it.todo('tapping the search field navigates to Search (Faz 3b — needs the Search route)');
  it.todo('signed-in header shows the notification bell with a badge; guests never see it (Faz 3b)');
});
