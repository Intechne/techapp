import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventDetailScreen } from '../EventDetailScreen';

// Save state is its own module (saved/__tests__); screens here only see ids + toggle.
const mockSaveToggle = jest.fn(); let mockSavedIds = new Set<string>();
jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: mockSavedIds, toggle: mockSaveToggle, pending: false, requiresAuth: false, ready: true }) }));
beforeEach(() => { mockSavedIds = new Set(); mockSaveToggle.mockClear(); });

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const baseEvent = {
  id: 'e1', title: 'Robotik Günü', summary: 'Bir günlük robot atölyesi.', description: 'Kısa açıklama.', type: 'workshop', format: 'in_person',
  city: 'İstanbul', venue: 'Salon', status: 'published', starts_at: iso(10), ends_at: iso(10.2), fee_minor_units: 0, tone: 'iris',
  poster_line: null, is_demo: false, capacity: 30, seats_taken: 4, waitlist_enabled: false, registration_opens_at: null,
  registration_closes_at: iso(5), registration_mode: 'individual', audience_note: null, min_age: null, max_age: null,
  guardian_required_under: null, requires_review: false, accepts_volunteers: false, cancellation_policy: null, support_contact: null,
  organization: { id: 'o', name: 'Şehit Öğretmen Ayşe Gülşen Çağlayan Mesleki ve Teknik Anadolu Lisesi', verification: 'verified' }, sessions: [],
};
const baseEligibility = {
  event_id: 'e1', authenticated: true, eligible: true, reasons: [] as string[], guardian_required: false, is_full: false,
  waitlist_enabled: false, seats_left: 26, registration_id: null as string | null, registration_status: null as string | null,
};
let mockEvent = { ...baseEvent };
let mockEligibility = { ...baseEligibility };
jest.mock('../api', () => ({
  fetchEvent: async () => mockEvent,
  fetchEligibility: async () => mockEligibility,
  eventKeys: { detail: (id: string) => ['events', 'detail', id], eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u] },
}));
let mockCourses: unknown[] = [];
jest.mock('../../learning/api', () => ({
  fetchEventCourses: async () => mockCourses,
  learningKeys: jest.requireActual('../../learning/api').learningKeys,
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../volunteers/VolunteerSection', () => ({ VolunteerSection: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

const navigate = jest.fn();
const tabNavigate = jest.fn(); const rootNavigate = jest.fn();
beforeEach(() => { mockCourses = []; mockEvent = { ...baseEvent }; mockEligibility = { ...baseEligibility }; navigate.mockClear(); tabNavigate.mockClear(); rootNavigate.mockClear(); });

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
async function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const navigation = { navigate, goBack: jest.fn(), getParent: () => ({ navigate: tabNavigate, getParent: () => ({ navigate: rootNavigate }) }) };
  const props = { navigation, route: { key: 'k', name: 'EventDetail', params: { eventId: 'e1' } } } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><EventDetailScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
  await screen.findAllByText('Robotik Günü');
}
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

describe('Etkinlik detayı — Bu etkinliğe hazırlan', () => {
  it('no linked course: the section does not exist', async () => {
    mockEvent = { ...baseEvent, sessions: [{ id: 's1', title: 'Açılış', starts_at: iso(10), location_note: null } as never] };
    await renderDetail();
    await screen.findByText('Program');
    expect(screen.queryByText('Bu etkinliğe hazırlan')).toBeNull();
  });

  it('linked courses: listed after Program', async () => {
    mockEvent = { ...baseEvent, sessions: [{ id: 's1', title: 'Açılış', starts_at: iso(10), location_note: null } as never] };
    mockCourses = [{ id: 'c1', title: 'Arduino’ya giriş', level: 'beginner', lesson_count: 3, estimated_minutes: 45, is_demo: false }];
    await renderDetail();
    expect(await screen.findByText('Bu etkinliğe hazırlan')).toBeTruthy();
    const texts: string[] = [];
    const walk = (n: unknown): void => { if (typeof n === 'string') texts.push(n); else if (n && typeof n === 'object') { const o = n as { children?: unknown[] | null }; (o.children ?? []).forEach(walk); } };
    const json = screen.toJSON(); (Array.isArray(json) ? json : [json]).forEach(walk);
    expect(texts.indexOf('Program')).toBeLessThan(texts.indexOf('Bu etkinliğe hazırlan'));
    expect(screen.getByText('Arduino’ya giriş')).toBeTruthy();
  });
});

describe('Etkinlik detayı — tek engel kutusu, pasif birincil düğme yok', () => {
  it('registration open: one primary "Etkinliğe katıl", no notice', async () => {
    await renderDetail();
    expect(await screen.findByRole('button', { name: 'Etkinliğe katıl' })).toBeTruthy();
    expect(screen.queryByTestId('blocker-notice')).toBeNull();
    expect(disabledButtons()).toHaveLength(0);
  });

  it('closed + team-only: one notice titled by the closed reason with the other reason, footer short line + "Benzer etkinlikler", no disabled button', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, reasons: ['registration_closed', 'team_registration_only'] };
    await renderDetail();
    const notice = await screen.findByTestId('blocker-notice');
    expect(within(notice).getByText('Kayıtlar kapandı.')).toBeTruthy();
    expect(within(notice).getByText(/Diğer nedenler: Bu etkinliğe takım olarak kayıt olunuyor\./)).toBeTruthy();
    expect(screen.getAllByTestId('blocker-notice')).toHaveLength(1);
    const footer = screen.getByTestId('blocker-footer', { includeHiddenElements: true });
    expect(within(footer).getByText('Kayıtlar kapandı.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Etkinliğe katıl' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Kayıt şu an yapılamıyor|Kontenjan doldu/ })).toBeNull();
    expect(disabledButtons()).toHaveLength(0);
    fireEvent.press(screen.getByRole('button', { name: 'Benzer etkinlikler' }));
    expect(tabNavigate).toHaveBeenCalledWith('EventsTab', { screen: 'EventsList', params: { type: 'workshop' }, pop: true });
  });

  it('F-03: a blocked event announces the reason once: one alert notice, the footer line is hidden from screen readers', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, reasons: ['registration_closed'] };
    await renderDetail();
    await screen.findByTestId('blocker-notice');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').props.accessibilityLabel).toMatch(/^Kayıtlar kapandı\. /);
    const footer = screen.getByTestId('blocker-footer', { includeHiddenElements: true });
    expect(footer.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(footer.props.accessible).not.toBe(true);
    expect(screen.queryByLabelText(/^Kayıt yapılamıyor:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Benzer etkinlikler' })).toBeTruthy(); // the action stays reachable
  });

  it('full without a waitlist: "Kontenjan doldu." decides; no disabled primary button', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, is_full: true, seats_left: 0 };
    await renderDetail();
    expect(within(await screen.findByTestId('blocker-notice')).getByText('Kontenjan doldu.')).toBeTruthy();
    expect(within(screen.getByTestId('blocker-footer', { includeHiddenElements: true })).getByText('Kontenjan doldu.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Benzer etkinlikler' })).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
  });

  it('full with a waitlist is not blocked: primary "Bekleme listesine katıl"', async () => {
    mockEligibility = { ...baseEligibility, is_full: true, waitlist_enabled: true, seats_left: 0 };
    await renderDetail();
    expect(await screen.findByRole('button', { name: 'Bekleme listesine katıl' })).toBeTruthy();
    expect(screen.queryByTestId('blocker-notice')).toBeNull();
  });

  it('team-only: secondary is "Takımını bul" → Topluluk', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, reasons: ['team_registration_only'] };
    await renderDetail();
    fireEvent.press(await screen.findByRole('button', { name: 'Takımını bul' }));
    expect(tabNavigate).toHaveBeenCalledWith('CommunityTab');
    expect(disabledButtons()).toHaveLength(0);
  });

  it('age reason: secondary "Benzer etkinlikler"', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, reasons: ['below_min_age'] };
    await renderDetail();
    expect(within(await screen.findByTestId('blocker-notice')).getByText('Bu etkinlik senin yaş grubuna açık değil.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Benzer etkinlikler' })).toBeTruthy();
  });

  it('already registered: the registration decides — status action, no blocker even when registration closed since', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, reasons: ['registration_closed'], registration_id: 'r1', registration_status: 'confirmed' };
    await renderDetail();
    expect(await screen.findByRole('button', { name: 'Katılım kartımı göster' })).toBeTruthy();
    expect(screen.queryByTestId('blocker-notice')).toBeNull();
    expect(disabledButtons()).toHaveLength(0);
  });

  it('header has no "Etkinlik" title; back + share', async () => {
    await renderDetail();
    expect(screen.queryByText('Etkinlik')).toBeNull();
    expect(screen.getByRole('button', { name: 'Paylaş' })).toBeTruthy();
  });

  it('the header carries the save control next to share; its state is spoken', async () => {
    await renderDetail();
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(mockSaveToggle).toHaveBeenCalledWith('e1');
  });

  it('saved: the header control reads "Kaydedildi" and is selected', async () => {
    mockSavedIds = new Set(['e1']);
    await renderDetail();
    expect(screen.getByRole('button', { name: 'Kaydedildi' }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it('registration not open yet: the footer offers "Kaydet" (the one thing that still helps), not a disabled button', async () => {
    mockEligibility = { ...baseEligibility, eligible: false, reasons: ['registration_not_open'] };
    await renderDetail();
    await screen.findByTestId('blocker-footer', { includeHiddenElements: true });
    expect(screen.getAllByRole('button', { name: 'Kaydet' })).toHaveLength(2); // header + footer
    expect(disabledButtons()).toHaveLength(0);
  });

  it('organiser name is a verified organiser row and never upper-cased', async () => {
    await renderDetail();
    expect(screen.getByLabelText(/^Düzenleyen: Şehit Öğretmen Ayşe Gülşen Çağlayan Mesleki ve Teknik Anadolu Lisesi, doğrulanmış kurum$/)).toBeTruthy();
    expect(screen.queryByText(/ŞEHİT ÖĞRETMEN/)).toBeNull();
  });

  it('the organiser row opens the organisation profile', async () => {
    await renderDetail();
    await fireEvent.press(screen.getByLabelText(/^Düzenleyen: Şehit Öğretmen/));
    expect(navigate).toHaveBeenCalledWith('Organization', { organizationId: 'o' });
  });

  it('Bildir opens the report sheet route for this event (the form itself is tested with the sheet)', async () => {
    await renderDetail();
    await fireEvent.press(screen.getByRole('button', { name: 'Etkinliği bildir' }));
    expect(rootNavigate).toHaveBeenCalledWith('ReportSheet', { targetType: 'event', targetId: 'e1', label: 'Robotik Günü' });
  });
});
