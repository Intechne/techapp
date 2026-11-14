import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OrganizationScreen } from '../OrganizationScreen';

const org = (over: Record<string, unknown> = {}) => ({
  id: 'o1', slug: 'intechne', name: 'Intechne Teknoloji', type: 'company', tagline: 'Gençlerle teknoloji üretir', about: 'Intechne, öğrencilerle ortak projeler yürüten bir teknoloji şirketidir.',
  website: 'https://intechne.example', logo_path: null, verification: 'verified', is_demo: false, ...over,
});
const event = { id: 'e1', title: 'Robotik Atölyesi', type: 'workshop', format: 'in_person', city: 'İstanbul', starts_at: '2027-02-10T09:00:00Z', ends_at: '2027-02-10T15:00:00Z', registration_closes_at: '2027-02-09T09:00:00Z', registration_mode: 'individual', capacity: null, seats_taken: 0, fee_minor_units: 0, min_age: null, max_age: null, tone: 'iris', poster_line: 'Üret. Dene. Yarış.', is_demo: false, cover_path: null, cover_blurhash: null, status: 'published', waitlist_enabled: false };
const opportunity = { id: 'p1', title: 'Yaz Stajı Programı', type: 'internship', closes_at: '2027-03-01T20:00:00Z', is_remote: true, city: null, audience_note: null, reward_note: null, is_demo: false, cover_path: null, cover_blurhash: null };

let mockOrg: unknown = org(); let mockEvents: unknown[] = [event]; let mockOpps: unknown[] = [opportunity]; let mockUser: string | null = 'u1';
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchOrganization: async () => { if (!mockOrg) throw jest.requireActual('../../../lib/errors').makeError('organization_not_found', 404); return mockOrg; },
  fetchOrganizationEvents: async () => mockEvents,
  fetchOrganizationOpportunities: async () => mockOpps,
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: new Set(), toggle: jest.fn() }) }));
jest.mock('../../reports/api', () => ({ ...jest.requireActual('../../reports/api'), submitReport: jest.fn() }));

const tabNavigate = jest.fn(); const rootNavigate = jest.fn();
const navigation = { goBack: jest.fn(), navigate: jest.fn(), getParent: () => ({ navigate: tabNavigate, getParent: () => ({ navigate: rootNavigate }) }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () => {
  const props = { navigation, route: { key: 'k', name: 'Organization', params: { organizationId: 'o1' } } } as unknown as React.ComponentProps<typeof OrganizationScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><OrganizationScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
beforeEach(() => { mockOrg = org(); mockEvents = [event]; mockOpps = [opportunity]; mockUser = 'u1'; tabNavigate.mockClear(); rootNavigate.mockClear(); });

describe('Kurum profili', () => {
  it('verified: name as written, the verification badge, tagline, about, and its published events and opportunities', async () => {
    await open();
    expect(await screen.findByText('Intechne Teknoloji')).toBeTruthy();
    expect(screen.getByText('DOĞRULANMIŞ KURUM')).toBeTruthy();
    expect(screen.getByText('Gençlerle teknoloji üretir')).toBeTruthy();
    expect(screen.getByText('Hakkında')).toBeTruthy();
    expect(screen.getByText(/öğrencilerle ortak projeler/)).toBeTruthy();
    expect(await screen.findByText('Robotik Atölyesi')).toBeTruthy();
    expect(await screen.findByText('Yaz Stajı Programı')).toBeTruthy();
  });

  it('without a logo the TechApp mark stands in (no broken image, no initials)', async () => {
    await open();
    expect(await screen.findByTestId('org-logo-fallback')).toBeTruthy();
  });

  it('unverified: says so plainly and never shows the verified badge', async () => {
    mockOrg = org({ verification: 'unverified' });
    await open();
    expect(await screen.findByText('HENÜZ DOĞRULANMADI')).toBeTruthy();
    expect(screen.queryByText('DOĞRULANMIŞ KURUM')).toBeNull();
  });

  it('a very long name is shown in full, never cut or upper-cased', async () => {
    const name = 'Türkiye Cumhuriyeti Yıldız Teknik Üniversitesi Davutpaşa Kampüsü Robotik ve Yapay Zekâ Araştırma Merkezi Vakfı';
    mockOrg = org({ name });
    await open();
    const node = await screen.findByText(name);
    expect(node.props.numberOfLines).toBeUndefined();
  });

  it('nothing published: one honest line instead of two empty sections', async () => {
    mockEvents = []; mockOpps = [];
    await open();
    expect(await screen.findByText('Şu an yayında etkinlik ya da fırsat yok.')).toBeTruthy();
    expect(screen.queryByText('Etkinlikler')).toBeNull();
  });

  it('a missing organisation is the app\'s own sentence', async () => {
    mockOrg = null;
    await open();
    expect(await screen.findByText('Bu kurum bulunamadı.')).toBeTruthy();
  });

  it('opening an event or a call goes to its own tab', async () => {
    await open();
    await fireEvent.press(await screen.findByText('Robotik Atölyesi'));
    expect(tabNavigate).toHaveBeenCalledWith('EventsTab', { screen: 'EventDetail', params: { eventId: 'e1' } });
    await fireEvent.press(await screen.findByText('Yaz Stajı Programı'));
    expect(tabNavigate).toHaveBeenCalledWith('OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: 'p1' } });
  });

  it('Bildir opens the report sheet route for this organisation (a guest gets the sign-in prompt inside the sheet)', async () => {
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Kurumu bildir' }));
    expect(rootNavigate).toHaveBeenCalledWith('ReportSheet', expect.objectContaining({ targetType: 'organization', targetId: 'o1' }));
  });
});
