import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DiscoverScreen } from '../DiscoverScreen';
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]) }));

// Save state is its own module (saved/__tests__); screens here only see ids + toggle.
const mockSaveToggle = jest.fn(); let mockSavedIds = new Set<string>();
jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: mockSavedIds, toggle: mockSaveToggle, pending: false, requiresAuth: false, ready: true }) }));
beforeEach(() => { mockSavedIds = new Set(); mockSaveToggle.mockClear(); });

// The bell reads the signed-in user and the unread count; both are modules of their own (notifications/__tests__).
let mockUserId: string | null = null; let mockUnread = 0;
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUserId }) }));
jest.mock('../../notifications/api', () => ({ ...jest.requireActual('../../notifications/api'), useUnreadCount: () => mockUnread }));
beforeEach(() => { mockUserId = null; mockUnread = 0; });

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
const course = (id: string, title: string) => ({ id, title, poster_line: null, summary: 'Özet', level: 'beginner', tone: 'moss', estimated_minutes: 30, lesson_count: 4, is_demo: false, published_at: iso(-1), status: 'published' });
const team = (id: string, name: string) => ({ id, name, kind: 'team', category: 'Robotik', tagline: 'Birlikte üretiyoruz', city: 'İstanbul', member_count: 4, is_demo: false });

const data: { events: unknown[]; opportunities: unknown[]; teams: unknown[]; courses: unknown[]; interests: unknown[]; pending: boolean; pendingTables: string[]; errorTables: string[] } = {
  events: [], opportunities: [], teams: [], courses: [], interests: [], pending: false, pendingTables: [], errorTables: [],
};
const calls: { table: string }[] = [];
const queryCalls: { table: string; method: string; args: unknown[] }[] = [];

function mockBuilder(table: string) {
  calls.push({ table });
  const b: Record<string, unknown> = {};
  const gts: [string, string][] = [];
  for (const m of ['select', 'eq', 'gt', 'gte', 'in', 'or', 'order', 'limit', 'overrideTypes']) b[m] = (...args: unknown[]) => { queryCalls.push({ table, method: m, args }); if (m === 'gt') gts.push([String(args[0]), String(args[1])]); return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    if (data.errorTables.includes(table)) return Promise.resolve({ data: null, error: { message: 'Failed to fetch', code: '' } }).then(resolve);
    if (data.pending || data.pendingTables.includes(table)) return new Promise(() => {}).then(resolve);
    // Like the server: honours `gt` filters, and an events page is 10 rows (PAGE_SIZE) + 1.
    let rows = (data as unknown as Record<string, Record<string, string>[]>)[table] ?? [];
    for (const [col, v] of gts) rows = rows.filter((r) => Date.parse(r[col]!) > Date.parse(v));
    if (table === 'events') rows = rows.slice(0, 11);
    return Promise.resolve({ data: rows, error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: (t: string) => mockBuilder(t) }) }));

let mockPrefs: { interestSlugs: string[] } = { interestSlugs: [] };
jest.mock('../../onboarding/PrefsProvider', () => ({ usePrefs: () => ({ prefs: mockPrefs }) }));
let mockProfile: { display_name: string } | undefined;
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../profile/api', () => ({ useMyProfile: () => ({ data: mockProfile }) }));

beforeEach(() => {
  Object.assign(data, { events: [], opportunities: [], teams: [], courses: [], interests: [], pending: false, pendingTables: [], errorTables: [] });
  calls.length = 0;
  queryCalls.length = 0;
  mockPrefs = { interestSlugs: [] };
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

  it('Gelişim is hidden while no course is published', async () => {
    data.events = [event('e1', 'Etkinlik')];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    await renderScreen();
    await screen.findByText('Sıradaki adımın');
    expect(screen.queryByText('Gelişim')).toBeNull();
  });

  it('Gelişim comes last (after Birlikte üretenler) with two course MiniCards, and only published courses are requested', async () => {
    data.events = [event('e1', 'Etkinlik'), event('e2', 'Etkinlik iki')];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    data.teams = [team('t1', 'Robotik Takımı')];
    data.courses = [course('c1', 'Arduino’ya giriş'), course('c2', 'Lehim 101'), course('c3', 'Üçüncü kurs')];
    await renderScreen();
    await screen.findByText('Gelişim');
    expect(headingOrder()).toEqual(['Yaklaşan etkinlikler', 'Sıradaki adımın', 'Birlikte üretenler', 'Gelişim']);
    expect(screen.getByText('Arduino’ya giriş')).toBeTruthy();
    expect(screen.getByText('Lehim 101')).toBeTruthy();
    expect(screen.queryByText('Üçüncü kurs')).toBeNull();
    expect(queryCalls.filter((c) => c.table === 'courses' && c.method === 'eq')).toContainEqual({ table: 'courses', method: 'eq', args: ['status', 'published'] });
  });

  it('a course alone is enough content: no "Şu an yayında içerik yok"', async () => {
    data.courses = [course('c1', 'Arduino’ya giriş')];
    await renderScreen();
    await screen.findByText('Gelişim');
    expect(screen.queryByText('Şu an yayında içerik yok')).toBeNull();
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

  it('posters, opportunity rows and team cards each carry their own save control', async () => {
    data.events = [event('e1', 'Vitrin'), event('e2', 'İkinci etkinlik'), event('e3', 'Üçüncü etkinlik')];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    data.teams = [team('t1', 'Robotik Takımı')];
    await renderScreen();
    await screen.findByText('Birlikte üretenler');
    const saves = screen.getAllByRole('button', { name: 'Kaydet' }); // 2 posters + 1 team card
    expect(saves).toHaveLength(3);
    await fireEvent.press(saves[0]!); await fireEvent.press(saves[2]!);
    await fireEvent.press(screen.getByRole('button', { name: 'Son tarihi takip et' }));
    expect(mockSaveToggle.mock.calls.map((c) => c[0])).toEqual(['e2', 't1', 'o1']);
    expect(navigate).not.toHaveBeenCalled();
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

  it('a failed events query shows an error with retry, never the empty-content message', async () => {
    data.errorTables = ['events'];
    await renderScreen();
    expect(await screen.findByText('Bağlantı yok gibi görünüyor')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
    expect(screen.queryByText('Şu an yayında içerik yok')).toBeNull();
  });
});

describe('Keşfet ana — ikincil sorgu hataları', () => {
  it('preview failed and there are no events → one ErrorState with retry, not a blank page', async () => {
    data.errorTables = ['opportunities', 'teams'];
    await renderScreen();
    expect(await screen.findByText('Bağlantı yok gibi görünüyor')).toBeTruthy();
    expect(screen.getAllByText('Tekrar dene')).toHaveLength(1);
    expect(screen.queryByText('Şu an yayında içerik yok')).toBeNull();
  });

  it('preview failed but events exist → events stay, the failed sections show an inline error with retry', async () => {
    data.events = [event('e1', 'Etkinlik'), event('e2', 'Etkinlik iki')];
    data.errorTables = ['opportunities', 'teams'];
    await renderScreen();
    expect(await screen.findByText('Fırsatlar ve takımlar yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Yaklaşan etkinlikler')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
    expect(screen.queryByText('Bağlantı yok gibi görünüyor')).toBeNull();
  });

  it('interests failing while the topic is "mine" shows an error with retry, not an endless skeleton', async () => {
    mockPrefs = { interestSlugs: ['robotik'] };
    data.errorTables = ['interests'];
    await renderScreen();
    expect(await screen.findByText('Bağlantı yok gibi görünüyor')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
    expect(screen.queryByLabelText('Yükleniyor')).toBeNull();
  });
});

describe('Keşfet ana — sunucuda kaydı açık filtresi ve sütunlar', () => {
  it('asks the server for events whose registration has not closed', async () => {
    data.events = [event('e1', 'Etkinlik')];
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    const gt = queryCalls.find((c) => c.table === 'events' && c.method === 'gt');
    expect(gt?.args[0]).toBe('registration_closes_at');
    expect(Date.parse(gt?.args[1] as string)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('8 closed + 4 open events: Yaklaşan still shows the vitrin and 3 open events', async () => {
    // The server already dropped the closed ones; the client rule must agree even if it did not.
    const closed = Array.from({ length: 8 }, (_, i) => event(`c${i}`, `Kapalı ${i}`, { registration_closes_at: iso(-1 - i) }));
    const open = ['a', 'b', 'c', 'd'].map((k) => event(`o${k}`, `Açık ${k}`));
    data.events = [...closed, ...open];
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    expect(screen.getAllByLabelText(/Açık a\b/)).toHaveLength(1);
    for (const k of ['b', 'c', 'd']) expect(screen.getAllByText(`Açık ${k}`).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Kapalı \d/)).toHaveLength(0);
  });

  it('the opportunity feed selects explicit public columns, never created_by / approved_by', async () => {
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    await renderScreen();
    await screen.findByText('Sıradaki adımın');
    const sel = queryCalls.find((c) => c.table === 'opportunities' && c.method === 'select');
    expect(sel?.args[0]).not.toBe('*');
    expect(String(sel?.args[0])).not.toMatch(/created_by|approved_by/);
  });
});

describe('Keşfet ana — filtre ve arama', () => {
  it('with a topic filter and no events: the filtered-empty copy, never the all-empty page, other sections stay', async () => {
    mockPrefs = { interestSlugs: ['robotik'] };
    data.interests = [{ id: 1, slug: 'robotik', label_tr: 'Robotik', sort_order: 1 }];
    data.opportunities = [opportunity('o1', 'Yaz stajı')];
    await renderScreen();
    expect(await screen.findByText('Bu filtrelerle sonuç yok')).toBeTruthy();
    expect(screen.getByText('Filtreleri temizle')).toBeTruthy();
    expect(screen.queryByText('Şu an yayında içerik yok')).toBeNull();
    expect(screen.getByText('Sıradaki adımın')).toBeTruthy();
  });

  it('search results have no "Tümünü gör" (the Etkinlikler tab takes no search param)', async () => {
    data.events = [event('e1', 'Robot atölyesi')];
    await renderScreen();
    await screen.findByText('Yaklaşan etkinlikler');
    await fireEvent.changeText(screen.getByPlaceholderText('Etkinlik ara'), 'robot');
    await fireEvent(screen.getByPlaceholderText('Etkinlik ara'), 'submitEditing');
    expect(await screen.findByText('Sonuçlar')).toBeTruthy();
    expect(screen.queryByText('Tümünü gör')).toBeNull();
  });

  // 3b'ye bağlı, atlandı: the Search screen and notification bell are Faz 3b modules (not merged). Until a `Search`
  // route exists the field keeps submitting an in-place event search, and the bell is omitted.
  it.todo('tapping the search field navigates to Search (Faz 3b — needs the Search route)');
  it('signed-in header shows the notification bell with the unread badge and opens Bildirimler', async () => {
    mockUserId = 'u1'; mockUnread = 3;
    await renderScreen();
    await fireEvent.press(await screen.findByLabelText('Bildirimler, 3 okunmamış'));
    expect(navigate).toHaveBeenCalledWith('Notifications');
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('the bell has no badge at 0 and shows 99+ from 100 unread', async () => {
    mockUserId = 'u1';
    const first = await renderScreen();
    expect(await screen.findByLabelText('Bildirimler')).toBeTruthy();
    expect(screen.queryByTestId('icon-badge')).toBeNull();
    await first.unmount();
    mockUnread = 120;
    await renderScreen();
    expect(await screen.findByLabelText('Bildirimler, 120 okunmamış')).toBeTruthy();
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('guests never see the bell', async () => {
    mockUserId = null; mockUnread = 5;
    await renderScreen();
    expect(screen.queryByLabelText(/Bildirimler/)).toBeNull();
  });
});
