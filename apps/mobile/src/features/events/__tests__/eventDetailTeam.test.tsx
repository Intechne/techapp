import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventDetailScreen } from '../EventDetailScreen';

jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: new Set<string>(), toggle: jest.fn(), pending: false, requiresAuth: false, ready: true }) }));
let mockFlag = true;
jest.mock('../../../lib/features', () => ({ features: { get teamRegistration() { return mockFlag; } } }));
let mockUserId: string | null = 'u1';
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUserId }) }));
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => ({ set: jest.fn(), consume: () => false }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../volunteers/VolunteerSection', () => ({ VolunteerSection: () => null }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const baseEvent = {
  id: 'e1', title: 'Robot Turnuvası', summary: 'Takımların yarıştığı gün.', description: null, type: 'competition', format: 'in_person',
  city: 'İstanbul', venue: 'Salon', status: 'published', starts_at: iso(10), ends_at: iso(10.2), fee_minor_units: 0, tone: 'iris',
  poster_line: null, is_demo: false, capacity: null, seats_taken: 0, waitlist_enabled: false, registration_opens_at: null,
  registration_closes_at: iso(5), registration_mode: 'team', team_min_size: 2, team_max_size: 4, team_capacity: 8, teams_taken: 3,
  audience_note: null, min_age: null, max_age: null, guardian_required_under: null, requires_review: false, accepts_volunteers: false,
  cancellation_policy: null, support_contact: null, organization: { id: 'o', name: 'Org', verification: 'verified' }, sessions: [],
};
const team = (registration_id: string | null = null) => ({ team_id: 't1', name: 'Dişli Kafalar', role: 'captain', active_member_count: 4, registration_id, registration_status: registration_id ? 'pending_members' : null });
const baseEligibility = {
  event_id: 'e1', authenticated: true, eligible: false, reasons: ['team_registration_only'], guardian_required: false, is_full: false,
  waitlist_enabled: false, seats_left: null, registration_id: null, registration_status: null, registration_mode: 'team', team_seats_left: 5, manageable_teams: [] as unknown[],
};
let mockEvent: Record<string, unknown> = baseEvent;
let mockEligibility: Record<string, unknown> = baseEligibility;
jest.mock('../api', () => ({
  fetchEvent: async () => mockEvent,
  fetchEligibility: async () => mockEligibility,
  eventKeys: { detail: (id: string) => ['events', 'detail', id], eligibility: (id: string, u: string | null) => ['events', 'eligibility', id, u] },
}));
jest.mock('../../learning/api', () => ({ fetchEventCourses: async () => [], learningKeys: jest.requireActual('../../learning/api').learningKeys }));

const navigate = jest.fn(); const tabNavigate = jest.fn();
beforeEach(() => { mockFlag = true; mockUserId = 'u1'; mockEvent = baseEvent; mockEligibility = baseEligibility; navigate.mockClear(); tabNavigate.mockClear(); });
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
async function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const navigation = { navigate, goBack: jest.fn(), getParent: () => ({ navigate: tabNavigate, getParent: () => ({ navigate: jest.fn() }) }) };
  const props = { navigation, route: { key: 'k', name: 'EventDetail', params: { eventId: 'e1' } } } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><EventDetailScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
  await screen.findAllByText('Robot Turnuvası');
  await new Promise((r) => setTimeout(r, 0));
}
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);
const noTeamCta = () => { expect(screen.queryByRole('button', { name: /Takımımı kaydet|Takım kaydını gör/ })).toBeNull(); };

describe('Etkinlik detayı — takım kaydı CTA', () => {
  it('team event, captain or mentor: one primary "Takımımı kaydet" that opens the roster screen', async () => {
    mockEligibility = { ...baseEligibility, manageable_teams: [team()] };
    await renderDetail();
    await fireEvent.press(await screen.findByRole('button', { name: /Takımımı kaydet/ }));
    expect(navigate).toHaveBeenCalledWith('TeamRegistration', { eventId: 'e1' });
    expect(screen.queryByText(/Bu etkinliğe takım olarak kayıt olunuyor/)).toBeNull();
    expect(disabledButtons()).toHaveLength(0);
  });

  it('team event, my team already registered: "Takım kaydını gör" opens its status', async () => {
    mockEligibility = { ...baseEligibility, manageable_teams: [team('tr1')] };
    await renderDetail();
    await fireEvent.press(await screen.findByRole('button', { name: /Takım kaydını gör/ }));
    expect(navigate).toHaveBeenCalledWith('TeamRegistrationStatus', { teamRegistrationId: 'tr1' });
  });

  it('team event, not a captain or mentor: the sentence names both roles, the secondary finds a team', async () => {
    await renderDetail();
    expect((await screen.findAllByText(/Takım kaydını kaptanın ya da mentorun yapar/)).length).toBeGreaterThan(0);
    noTeamCta();
    await fireEvent.press(screen.getByRole('button', { name: /Takımını bul/ }));
    expect(tabNavigate).toHaveBeenCalledWith('CommunityTab');
    expect(disabledButtons()).toHaveLength(0);
  });

  it('team event, guest: Giriş yap (never a team CTA)', async () => {
    mockUserId = null; mockEligibility = { ...baseEligibility, authenticated: false };
    await renderDetail();
    expect(await screen.findByRole('button', { name: /Giriş yap/ })).toBeTruthy();
    noTeamCta();
  });

  it('both: individual stays primary, the team CTA is a separate secondary button', async () => {
    mockEvent = { ...baseEvent, registration_mode: 'both', capacity: 30 };
    mockEligibility = { ...baseEligibility, eligible: true, reasons: [], registration_mode: 'both', manageable_teams: [team()] };
    await renderDetail();
    expect(await screen.findByRole('button', { name: /Etkinliğe katıl/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Takımımı kaydet/ }));
    expect(navigate).toHaveBeenCalledWith('TeamRegistration', { eventId: 'e1' });
  });

  it('both, not a manager: no team button', async () => {
    mockEvent = { ...baseEvent, registration_mode: 'both', capacity: 30 };
    mockEligibility = { ...baseEligibility, eligible: true, reasons: [], registration_mode: 'both' };
    await renderDetail();
    await screen.findByRole('button', { name: /Etkinliğe katıl/ });
    noTeamCta();
  });

  it('shows the team size and the open team seats on a team event', async () => {
    mockEligibility = { ...baseEligibility, manageable_teams: [team()] };
    await renderDetail();
    expect(await screen.findByText(/Takım: 2–4 kişi/)).toBeTruthy();
    expect(screen.getByText(/5 \/ 8 takım yeri açık/)).toBeTruthy();
  });

  it('registration closed on a team event: the usual blocker, not a team CTA', async () => {
    mockEligibility = { ...baseEligibility, reasons: ['team_registration_only', 'registration_closed'], manageable_teams: [team()] };
    await renderDetail();
    expect((await screen.findAllByText(/kayıtlar kapandı/i)).length).toBeGreaterThan(0);
    noTeamCta();
  });
});

describe('Etkinlik detayı — bayrak kapalı (production)', () => {
  beforeEach(() => { mockFlag = false; });
  it('team event, manager: never a team CTA; the info line stays, nothing disabled', async () => {
    mockEligibility = { ...baseEligibility, manageable_teams: [team()] };
    await renderDetail();
    expect((await screen.findAllByText(/Takım kaydını kaptanın ya da mentorun yapar/)).length).toBeGreaterThan(0);
    noTeamCta();
    expect(disabledButtons()).toHaveLength(0);
  });
  it('both: only the individual button, no team size row', async () => {
    mockEvent = { ...baseEvent, registration_mode: 'both', capacity: 30 };
    mockEligibility = { ...baseEligibility, eligible: true, reasons: [], registration_mode: 'both', manageable_teams: [team()] };
    await renderDetail();
    await screen.findByRole('button', { name: /Etkinliğe katıl/ });
    noTeamCta();
    expect(screen.queryByText(/Takım: 2–4 kişi/)).toBeNull();
  });
});
