import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { makeError } from '../../../lib/errors';
import { TeamDetailScreen } from '../TeamDetailScreen';

// Save state is its own module (saved/__tests__); screens here only see ids + toggle.
const mockSaveToggle = jest.fn(); let mockSavedIds = new Set<string>();
jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: mockSavedIds, toggle: mockSaveToggle, pending: false, requiresAuth: false, ready: true }) }));
beforeEach(() => { mockSavedIds = new Set(); mockSaveToggle.mockClear(); });

const team = (over: Record<string, unknown> = {}) => ({
  id: 't1', name: 'Orbit Robotik', kind: 'team', tagline: null, category: 'Robotik', category_key: 'robotics', city: null, about: 'Haftada üç gün atölyede.',
  member_count: 15, is_demo: false, accepts_join_requests: true, cover_path: null, cover_blurhash: null, ...over,
});
const profile = (over: Record<string, unknown> = {}) => ({
  member_count: 15, role_counts: { captain: 1, mentor: 2, member: 12 }, leaders: [{ display_name: 'Ayşe Yılmaz', role: 'captain' }, { display_name: 'Mert Demir', role: 'mentor' }],
  projects_count: 1, events: [], ...over,
});
const project = (over: Record<string, unknown> = {}) => ({ id: 'pr1', team_id: 't1', title: 'Otonom şasi v2', summary: 'Sezon robotu.', year: 2026, url: 'https://orbit.example/sasi', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', ...over });
const post = (over: Record<string, unknown> = {}) => ({ id: 'p1', team_id: 't1', title: 'Mekanik ekibine katıl', role_label: 'Mekanik lideri', description: null, skills: ['CAD'], is_open: true, closes_at: null, ...over });

let mockTeam = team(); let mockProfile: unknown = profile(); let mockProjects: unknown[] = []; let mockPosts: unknown[] = [];
let mockMembership: Record<string, unknown> | null = null; let mockMyApps: unknown[] = []; let mockUser: string | null = 'u1';
const mockApply = jest.fn(); const mockRosterFetch = jest.fn(async () => { throw new Error('the public page must never read the roster'); });
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchTeam: async () => mockTeam,
  fetchTeamProfile: async () => { if (mockProfile === 'unreadable') throw { code: 'PT500', message: 'server_error' }; return mockProfile; },
  fetchTeamProjects: async () => mockProjects,
  fetchOpenPosts: async () => mockPosts,
  fetchMyMembership: async () => mockMembership,
  fetchMyRecruitmentApplications: async () => mockMyApps,
  fetchRoster: (...a: unknown[]) => (mockRosterFetch as unknown as (...x: unknown[]) => unknown)(...a),
  applyToRecruitment: (...a: unknown[]) => (mockApply as unknown as (...x: unknown[]) => unknown)(...a),
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
const mockIntentSet = jest.fn(); let mockResume: unknown = null;
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => ({ set: mockIntentSet, consume: () => { const v = mockResume; mockResume = null; return v; }, clear: jest.fn() }) }));
// useFocusEffect needs a navigation container; here "focused" simply means mounted.
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]) }));

const navigate = jest.fn(); const authNavigate = jest.fn();
beforeEach(() => {
  mockTeam = team(); mockProfile = profile(); mockProjects = []; mockPosts = []; mockMembership = null; mockMyApps = []; mockUser = 'u1'; mockResume = null;
  navigate.mockClear(); authNavigate.mockClear(); mockApply.mockReset(); mockIntentSet.mockClear(); mockRosterFetch.mockClear();
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const nav = { navigate, goBack: jest.fn(), replace: jest.fn(), getParent: () => ({ getParent: () => ({ navigate: authNavigate }) }) };
const detail = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  const props = { navigation: nav, route: { key: 'k', name: 'TeamDetail', params: { teamId: 't1' } } } as unknown as React.ComponentProps<typeof TeamDetailScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><TeamDetailScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
const order = (...titles: string[]) => {
  const strip = (k: string, v: unknown) => (k === 'props' || k === '$$typeof' ? undefined : v);
  const json = JSON.stringify(screen.toJSON(), strip);
  const at = titles.map((t) => json.indexOf(`"${t}"`));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
};

describe('Takım profili — bölümler', () => {
  it('the header carries the save control for this team', async () => {
    await detail();
    await fireEvent.press(await screen.findByRole('button', { name: 'Kaydet' }));
    expect(mockSaveToggle).toHaveBeenCalledWith('t1');
  });

  it('sections run Hakkında → Rol dağılımı → Açık roller → Projeler → Etkinlikler', async () => {
    mockPosts = [post()]; mockProjects = [project()]; mockProfile = profile({ events: [{ id: 'e1', title: 'Bahar kampı', starts_at: '2027-03-01T09:00:00Z' }] });
    await detail();
    await screen.findByText('Etkinlikler');
    order('Hakkında', 'Rol dağılımı', 'Açık roller', 'Projeler', 'Etkinlikler');
  });

  it('empty sections are hidden; "Açık roller" stays with one explanatory line', async () => {
    mockTeam = team({ about: null }); mockProfile = profile({ role_counts: { captain: 0, mentor: 0, member: 0 }, leaders: [], projects_count: 0 });
    await detail();
    expect(await screen.findByText('Açık roller')).toBeTruthy();
    expect(screen.getByText(/Şu an açık rol yok/)).toBeTruthy();
    for (const hidden of ['Hakkında', 'Rol dağılımı', 'Projeler', 'Etkinlikler']) expect(screen.queryByText(hidden)).toBeNull();
  });

  it('role distribution shows the safe counts; 999 members and 0 are stated plainly', async () => {
    mockProfile = profile({ member_count: 999, role_counts: { captain: 1, mentor: 3, member: 995 }, leaders: [] });
    await detail();
    expect(await screen.findByLabelText('Üye: 995')).toBeTruthy();
    expect(screen.getByLabelText('Kaptan: 1')).toBeTruthy();
    expect(screen.getByLabelText('Mentor: 3')).toBeTruthy();
  });

  it('leaders list shows only the names the server returned; the roster is never read', async () => {
    await detail();
    expect(await screen.findByText('Ayşe Yılmaz')).toBeTruthy();
    expect(screen.getByText('Mert Demir')).toBeTruthy();
    expect(mockRosterFetch).not.toHaveBeenCalled();
  });

  it('a minor captain (no leaders returned) is counted but never named', async () => {
    mockProfile = profile({ role_counts: { captain: 1, mentor: 0, member: 4 }, leaders: [] });
    await detail();
    expect(await screen.findByLabelText('Kaptan: 1')).toBeTruthy();
    expect(screen.queryByText(/Takımın liderleri/)).toBeNull();
  });

  it('projects list title, year, summary; the link opens only https', async () => {
    mockProjects = [project(), project({ id: 'pr2', title: 'Eski proje', year: null, summary: null, url: null })];
    await detail();
    expect(await screen.findByText('Otonom şasi v2')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    expect(screen.getByText('Sezon robotu.')).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('if the public profile cannot be read the page still renders, the gap is announced inline and can be retried (no invented counts)', async () => {
    mockProfile = 'unreadable';
    await detail();
    expect(await screen.findByText('Hakkında')).toBeTruthy();
    expect(await screen.findByText('Takım bilgileri yüklenemedi')).toBeTruthy();
    expect(screen.queryByText('Rol dağılımı')).toBeNull();
    mockProfile = profile();
    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByText('Rol dağılımı')).toBeTruthy();
    expect(screen.queryByText('Takım bilgileri yüklenemedi')).toBeNull();
  });
});

describe('Takım profili — yönetim ve başvuru', () => {
  it('a captain/mentor sees "Proje ekle" and an edit action per project', async () => {
    mockMembership = { id: 'm1', team_id: 't1', user_id: 'u1', role: 'captain', status: 'active' }; mockProjects = [project()];
    await detail();
    await fireEvent.press(await screen.findByRole('button', { name: 'Proje ekle' }));
    expect(navigate).toHaveBeenCalledWith('TeamProjectEditor', { teamId: 't1' });
    await fireEvent.press(screen.getByRole('button', { name: 'Otonom şasi v2: düzenle' }));
    expect(navigate).toHaveBeenCalledWith('TeamProjectEditor', { teamId: 't1', projectId: 'pr1' });
  });

  it('a plain member has neither', async () => {
    mockProjects = [project()];
    mockMembership = { id: 'm1', team_id: 't1', user_id: 'u1', role: 'member', status: 'active' };
    await detail();
    await screen.findByText('Otonom şasi v2');
    expect(screen.queryByRole('button', { name: 'Proje ekle' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Otonom şasi v2: düzenle' })).toBeNull();
  });

  it('a guest who applies to an open role is asked to sign in (and the intent is remembered)', async () => {
    mockUser = null; mockPosts = [post()];
    await detail();
    await fireEvent.press(await screen.findByRole('button', { name: 'Mekanik ekibine katıl: başvur' }));
    expect(authNavigate).toHaveBeenCalledWith('AuthEmail');
    expect(mockIntentSet).toHaveBeenCalledWith({ type: 'apply_recruitment', teamId: 't1', postId: 'p1' });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('after signing in, the role the guest tapped opens its apply sheet on its own', async () => {
    mockPosts = [post()]; mockResume = { type: 'apply_recruitment', teamId: 't1', postId: 'p1' };
    await detail();
    expect(await screen.findByText('Role başvur')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Başvuruyu gönder' })).toBeTruthy();
    expect(screen.getByText(/Başvurduğunda takım yöneticileri adını ve notunu görür/)).toBeTruthy();
  });

  it('a signed-in person applies with a note; success shows the status label from Status.tsx instead of the button', async () => {
    mockPosts = [post()]; mockApply.mockResolvedValue({ id: 'a1' });
    await detail();
    await fireEvent.press(await screen.findByRole('button', { name: 'Mekanik ekibine katıl: başvur' }));
    await fireEvent.changeText(await screen.findByLabelText('Kısa bir not (isteğe bağlı)'), 'CAD biliyorum');
    await fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    await waitFor(() => expect(mockApply).toHaveBeenCalledWith('p1', 'CAD biliyorum'));
  });

  it('an application that already exists shows GÖNDERİLDİ and no apply button', async () => {
    mockPosts = [post()]; mockMyApps = [{ id: 'a1', post_id: 'p1', user_id: 'u1', status: 'submitted', message: null, created_at: '2026-11-02T10:00:00Z' }];
    await detail();
    expect(await screen.findByText('GÖNDERİLDİ')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mekanik ekibine katıl: başvur' })).toBeNull();
  });

  it('a server refusal is shown with the app copy, in the sheet, and not as a retry', async () => {
    mockPosts = [post()]; mockApply.mockRejectedValue(makeError('already_team_member', 409));
    await detail();
    await fireEvent.press(await screen.findByRole('button', { name: 'Mekanik ekibine katıl: başvur' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Başvuruyu gönder' }));
    expect(await screen.findByText('Zaten bu takımın üyesisin.')).toBeTruthy();
    expect(screen.queryByText('Tekrar dene')).toBeNull();
  });

  it('members do not get an apply button on their own team’s roles', async () => {
    mockPosts = [post()]; mockMembership = { id: 'm1', team_id: 't1', user_id: 'u1', role: 'member', status: 'active' };
    await detail();
    await screen.findByText('Mekanik ekibine katıl');
    expect(screen.queryByRole('button', { name: 'Mekanik ekibine katıl: başvur' })).toBeNull();
  });
});
