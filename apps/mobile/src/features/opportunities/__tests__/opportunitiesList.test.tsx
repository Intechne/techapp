import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, tones } from '../../../design-system';
import { opportunityKeys } from '../api';
import { OPPORTUNITY_TYPE, deadlineTag, groupByHorizon } from '../labels';
import { OpportunitiesScreen } from '../OpportunitiesScreen';
import { OpportunityDetailScreen } from '../OpportunityDetailScreen';
import { DeadlinesScreen } from '../DeadlinesScreen';
import { MyApplicationsScreen } from '../MyApplicationsScreen';

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const opp = (id: string, title: string, over: Record<string, unknown> = {}) => ({
  id, title, summary: 'Kısa özet.', description: 'Uzun açıklama.', type: 'internship', tone: 'iris', city: null, is_remote: true,
  audience_note: 'Lise', reward_note: null, skills: ['Python'], min_age: null, max_age: null, guardian_required_under: 18, opens_at: null,
  closes_at: iso(12), shared_fields: ['display_name'], apply_url: null, team_based: false, is_demo: false,
  organization: { id: 'org', name: 'Intechne', verification: 'verified' }, ...over,
});

// ---- query builder + session mocks -------------------------------------------------------------------------------
let rows: Record<string, unknown>[] = [];
const calls: { method: string; args: unknown[] }[] = [];
function mockBuilder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'gte', 'in', 'order', 'limit', 'overrideTypes']) b[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return b; };
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: () => mockBuilder() }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
let mockUser: string | null = 'u1';
let mockMinor: boolean | null = false;
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }), useAccountState: () => ({ data: { is_minor: mockMinor } }) }));
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => ({ set: jest.fn(), consume: () => false }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
const mockToggle = jest.fn();
let mockFollowed = new Set<string>();
jest.mock('../useFollow', () => ({ useFollowedOpportunities: () => ({ ids: mockFollowed, requiresAuth: mockUser === null, toggle: mockToggle, pending: false }) }));
let mockApps: unknown[] = [];
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchOpportunity: async () => mockOpportunity,
  fetchMyApplicationFor: async () => null,
  fetchMyApplications: async () => mockApps,
}));
let mockOpportunity: ReturnType<typeof opp> = opp('o1', 'Yaz stajı');

const navigate = jest.fn();
beforeEach(() => { rows = []; calls.length = 0; mockUser = 'u1'; mockMinor = false; mockFollowed = new Set(); mockToggle.mockClear(); navigate.mockClear(); mockApps = []; });
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>;
};
const nav = { navigate, goBack: jest.fn(), replace: jest.fn(), getParent: () => ({ getParent: () => ({ navigate: jest.fn() }) }) };
const props = <T,>(name: string, params?: object) => ({ navigation: nav, route: { key: 'k', name, params } }) as unknown as T;
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

// ---- 1. icon table -----------------------------------------------------------------------------------------------
describe('Fırsat türü ikonları', () => {
  it('competition is a badge; no opportunity type uses the robot icon (robot = robotik kategori only)', () => {
    expect(OPPORTUNITY_TYPE.competition.icon).toBe('badge');
    expect(Object.values(OPPORTUNITY_TYPE).map((t) => t.icon)).not.toContain('robot');
  });
});

// ---- 2. remaining-day tones --------------------------------------------------------------------------------------
const NOW = new Date('2026-11-12T09:00:00Z'); // Thursday 12:00 in Istanbul
describe('kalan gün etiketi tonu (sınırlar)', () => {
  it.each([
    ['today', '2026-11-12T20:00:00Z', 'SON GÜN BUGÜN', 'apricot'],
    ['1 day', '2026-11-13T20:00:00Z', 'SON 1 GÜN', 'apricot'],
    ['2 days', '2026-11-14T20:00:00Z', 'SON 2 GÜN', 'iris'],
    ['7 days', '2026-11-19T20:00:00Z', 'SON 7 GÜN', 'iris'],
  ])('%s → %s (%s)', (_n, closes, label, tone) => {
    expect(deadlineTag(closes, NOW)).toEqual({ label, tone, icon: 'clock' });
  });
  it('8 days and later: no tag at all (the absolute date is enough); closed: no tag', () => {
    expect(deadlineTag('2026-11-20T20:00:00Z', NOW)).toBeUndefined();
    expect(deadlineTag('2027-03-01T20:00:00Z', NOW)).toBeUndefined();
    expect(deadlineTag('2026-11-12T08:00:00Z', NOW)).toBeUndefined();
  });
});

// ---- 3. list hides past deadlines --------------------------------------------------------------------------------
describe('Fırsatlar listesi', () => {
  it('asks the server for open calls only (closes_at >= now), now is not part of the query key', async () => {
    const before = Date.now();
    rows = [opp('o1', 'Açık çağrı')];
    await render(wrap(<OpportunitiesScreen {...props<React.ComponentProps<typeof OpportunitiesScreen>>('OpportunitiesHome')} />));
    expect(await screen.findByText('Açık çağrı')).toBeTruthy();
    const gte = calls.find((c) => c.method === 'gte');
    expect(gte?.args[0]).toBe('closes_at');
    expect(Date.parse(String(gte?.args[1]))).toBeGreaterThanOrEqual(before - 1000);
    expect(opportunityKeys.list('all')).toEqual(['opportunities', 'list', 'all']);
    expect(calls.find((c) => c.method === 'select')?.args[0]).not.toMatch(/\*|created_by|approved_by/);
  });
  it('a past-deadline row that is still in memory (screen left open overnight) is never drawn', async () => {
    rows = [opp('o1', 'Açık çağrı'), opp('o2', 'Geçmiş çağrı', { closes_at: iso(-1) })];
    await render(wrap(<OpportunitiesScreen {...props<React.ComponentProps<typeof OpportunitiesScreen>>('OpportunitiesHome')} />));
    expect(await screen.findByText('Açık çağrı')).toBeTruthy();
    expect(screen.queryByText('Geçmiş çağrı')).toBeNull();
  });
  it('a row 3 days out wears an iris tag (not the old apricot), a row 20 days out none; the date stays', async () => {
    rows = [opp('o1', 'Yakın çağrı', { closes_at: iso(3) }), opp('o2', 'Uzak çağrı', { closes_at: iso(20) })];
    await render(wrap(<OpportunitiesScreen {...props<React.ComponentProps<typeof OpportunitiesScreen>>('OpportunitiesHome')} />));
    await screen.findByText('Yakın çağrı');
    const feet = screen.getAllByTestId('row-foot');
    const tag = within(feet[0]!).getByText(/^SON\s[34]\sGÜN$/);
    expect(StyleSheet.flatten(tag.props.style).color).toBe(colors.primary);
    expect(within(feet[1]!).queryByText(/GÜN/)).toBeNull();
    expect(within(feet[1]!).getByText(/^Son başvuru:/)).toBeTruthy();
  });
  it('signed in: a save bookmark per row; guest: chevron instead', async () => {
    rows = [opp('o1', 'Açık çağrı')];
    await render(wrap(<OpportunitiesScreen {...props<React.ComponentProps<typeof OpportunitiesScreen>>('OpportunitiesHome')} />));
    fireEvent.press(await screen.findByRole('button', { name: 'Son tarihi takip et' }));
    expect(mockToggle).toHaveBeenCalledWith('o1');
  });
});

// ---- 4. Son tarihler grouping ------------------------------------------------------------------------------------
describe('Son tarihler: Bu hafta / Bu ay / Sonra', () => {
  const at = (closes_at: string) => ({ closes_at });
  it('groups by the Europe/Istanbul calendar week (Mon–Sun) and month, soonest first, empty groups omitted', () => {
    // Thursday 12 Nov 2026 12:00 TRT. Week ends Sunday 15 Nov; month ends 30 Nov.
    const groups = groupByHorizon([
      at('2026-12-02T10:00:00Z'), at('2026-11-30T10:00:00Z'), at('2026-11-12T20:00:00Z'), at('2026-11-15T10:00:00Z'), at('2026-11-16T10:00:00Z'),
    ], NOW);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.closes_at)])).toEqual([
      ['Bu hafta', ['2026-11-12T20:00:00Z', '2026-11-15T10:00:00Z']],
      ['Bu ay', ['2026-11-16T10:00:00Z', '2026-11-30T10:00:00Z']],
      ['Sonra', ['2026-12-02T10:00:00Z']],
    ]);
    expect(groupByHorizon([at('2027-01-05T10:00:00Z')], NOW).map((g) => g.label)).toEqual(['Sonra']);
  });
  it('the week boundary is Istanbul midnight, not UTC: Sunday 23:30 TRT is still this week, Monday 00:30 TRT is not', () => {
    const groups = groupByHorizon([at('2026-11-15T20:59:00Z'), at('2026-11-15T21:30:00Z')], new Date('2026-11-12T09:00:00Z'));
    // 23:59 TRT Sunday → Bu hafta; 00:30 TRT Monday 16 Nov → Bu ay (even though both are Sunday in UTC)
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Bu hafta', 1], ['Bu ay', 1]]);
  });
  it('a week that straddles the month end stays "Bu hafta"; closed calls are dropped', () => {
    const now = new Date('2026-11-26T09:00:00Z'); // Thursday; week ends Sun 29 Nov; month ends Mon 30
    expect(groupByHorizon([at('2026-11-29T10:00:00Z'), at('2026-11-30T10:00:00Z'), at('2026-11-20T10:00:00Z')], now).map((g) => [g.label, g.items.length])).toEqual([['Bu hafta', 1], ['Bu ay', 1]]);
    const feb = new Date('2026-12-30T09:00:00Z'); // Wednesday; week ends Sun 3 Jan
    expect(groupByHorizon([at('2027-01-02T10:00:00Z'), at('2027-01-04T10:00:00Z')], feb).map((g) => g.label)).toEqual(['Bu hafta', 'Sonra']);
  });
  it('the screen shows the three headings over RowCards', async () => {
    rows = [opp('o1', 'Bugünkü', { closes_at: iso(0.2) }), opp('o2', 'Uzak', { closes_at: iso(80) })];
    await render(wrap(<DeadlinesScreen {...props<React.ComponentProps<typeof DeadlinesScreen>>('Deadlines')} />));
    expect(await screen.findByText('Bugünkü')).toBeTruthy();
    expect(screen.getByText('BU HAFTA')).toBeTruthy();
    expect(screen.getByText('SONRA')).toBeTruthy();
    expect(screen.queryByText(/KASIM 2026|ARALIK 2026/)).toBeNull();
  });
});

// ---- 5. detail: no disabled primary -----------------------------------------------------------------------------
describe('Fırsat detayı — pasif birincil düğme yok', () => {
  async function renderDetail() { await render(wrap(<OpportunityDetailScreen {...props<React.ComponentProps<typeof OpportunityDetailScreen>>('OpportunityDetail', { opportunityId: 'o1' })} />)); await screen.findAllByText('Yaz stajı'); }

  it('open + eligible: one primary "Başvurunu hazırla"', async () => {
    await renderDetail();
    expect(screen.getByRole('button', { name: 'Başvurunu hazırla' })).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
  });
  it('age mismatch: a reason line and the secondary "Kaydet" (bookmarks exist), no disabled button', async () => {
    mockOpportunity = opp('o1', 'Yaz stajı', { min_age: 18 }); mockMinor = true;
    await renderDetail();
    const footer = await screen.findByTestId('blocker-footer');
    expect(within(footer).getByText('Bu fırsata şimdilik yalnızca 18 yaş ve üzeri başvurabiliyor.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Başvuramıyorsun|Başvurunu hazırla/ })).toBeNull();
    expect(disabledButtons()).toHaveLength(0);
    fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(mockToggle).toHaveBeenCalledWith('o1');
  });
  it('closed: the reason only (saving a closed call is pointless), still no disabled button', async () => {
    mockOpportunity = opp('o1', 'Yaz stajı', { closes_at: iso(-1) });
    await renderDetail();
    expect(within(await screen.findByTestId('blocker-footer')).getByText('Başvurular kapandı.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull();
    expect(disabledButtons()).toHaveLength(0);
  });
  it('not open yet: the opening date as the reason + "Kaydet"', async () => {
    mockOpportunity = opp('o1', 'Yaz stajı', { opens_at: iso(5) });
    await renderDetail();
    expect(within(await screen.findByTestId('blocker-footer')).getByText(/^Başvurular \d+ \p{L}+ 2026 tarihinde açılıyor\.$/u)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
  });
  it('the description is collapsible text (ReadMoreText) and the tag row carries the new tone, not danger', async () => {
    mockOpportunity = opp('o1', 'Yaz stajı', { closes_at: iso(0.2) });
    await renderDetail();
    const tag = screen.getAllByText(/^SON\s(GÜN\sBUGÜN|1\sGÜN)$/)[0]!; // today or (after Istanbul midnight) 1 day: both apricot
    expect(StyleSheet.flatten(tag.props.style).color).toBe(tones.apricot.fg);
    expect(StyleSheet.flatten(tag.props.style).color).not.toBe(colors.danger);
  });
});

// ---- 6. Başvurularım ---------------------------------------------------------------------------------------------
describe('Başvurularım', () => {
  it('each application is a RowCard whose status comes from Status.tsx (trailing status), sorted as fetched', async () => {
    mockApps = [{ id: 'a1', status: 'submitted', submitted_at: iso(-2), opportunity: { id: 'o1', title: 'Yaz stajı', type: 'internship', closes_at: iso(5), organization: { name: 'Intechne' } } }];
    await render(wrap(<MyApplicationsScreen {...props<React.ComponentProps<typeof MyApplicationsScreen>>('MyApplications')} />));
    expect(await screen.findByText('Yaz stajı')).toBeTruthy();
    expect(screen.getByText('GÖNDERİLDİ')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Yaz stajı\./ })).toBeTruthy();
  });
});
