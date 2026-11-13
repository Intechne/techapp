import React from 'react';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommunityScreen } from '../CommunityScreen';
import { TeamDetailScreen } from '../../teams/TeamDetailScreen';
import { TeamWorkspaceScreen } from '../../teams/TeamWorkspaceScreen';
import { categoryIcon } from '../../teams/categoryIcon';

const team = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, kind: 'team', tagline: null, category: null, city: null, about: null, member_count: 3, is_demo: false, accepts_join_requests: true, ...over,
});
const mine = (id: string, t: ReturnType<typeof team>, role: string, status: string) => ({ id, team_id: t.id, user_id: 'u1', role, status, message: null, title: null, created_at: '2026-11-01T10:00:00Z', team: t });
const post = (id: string, over: Record<string, unknown> = {}) => ({ id, team_id: 't1', title: 'Mekanik ekibine katıl', role_label: null, description: null, skills: [] as string[], is_open: true, ...over });

let mockTeams: ReturnType<typeof team>[] = [];
let mockMine: ReturnType<typeof mine>[] = [];
let mockMembership: Record<string, unknown> | null = null;
let mockPosts: ReturnType<typeof post>[] = [];
let mockTeam: ReturnType<typeof team> = team('t1', 'Orbit Robotik');
let mockRoster: Record<string, unknown>[] = [];
let mockTasks: Record<string, unknown>[] = [];
let mockUser: string | null = 'u1';
const mockFetchMyTeams = jest.fn(async () => mockMine);
jest.mock('../../teams/api', () => ({
  ...jest.requireActual('../../teams/api'),
  fetchTeams: async () => mockTeams,
  fetchMyTeams: (...a: unknown[]) => (mockFetchMyTeams as unknown as (...x: unknown[]) => unknown)(...a),
  fetchTeam: async () => mockTeam,
  fetchOpenPosts: async () => mockPosts,
  fetchTeamProfile: async () => ({ member_count: 0, role_counts: { captain: 0, mentor: 0, member: 0 }, leaders: [], projects_count: 0, events: [] }),
  fetchTeamProjects: async () => [],
  fetchMyRecruitmentApplications: async () => [],
  fetchMyMembership: async () => mockMembership,
  fetchRoster: async () => mockRoster,
  fetchTasks: async () => mockTasks,
}));
// useFocusEffect needs a navigation container (TeamDetail resumes a guest's apply intent on focus).
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));

const navigate = jest.fn();
const parentNavigate = jest.fn();
beforeEach(() => {
  mockTeams = []; mockMine = []; mockMembership = null; mockPosts = []; mockTeam = team('t1', 'Orbit Robotik'); mockUser = 'u1';
  mockRoster = []; mockTasks = []; navigate.mockClear(); parentNavigate.mockClear(); mockFetchMyTeams.mockClear();
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>;
};
const nav = { navigate, goBack: jest.fn(), replace: jest.fn(), popTo: jest.fn(), getParent: () => ({ navigate: parentNavigate, getParent: () => ({ navigate: jest.fn() }) }) };
const props = <T,>(name: string, params?: object) => ({ navigation: nav, route: { key: 'k', name, params } }) as unknown as T;
const home = () => render(wrap(<CommunityScreen {...props<React.ComponentProps<typeof CommunityScreen>>('CommunityHome')} />));
const detail = () => render(wrap(<TeamDetailScreen {...props<React.ComponentProps<typeof TeamDetailScreen>>('TeamDetail', { teamId: 't1' })} />));
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

describe('Topluluk ana — Takımım kısayolu', () => {
  it('shows "Takımım" for an active membership and opens the Takım alanı', async () => {
    const orbit = team('t1', 'Orbit Robotik');
    mockMine = [mine('m1', orbit, 'captain', 'active')];
    await home();
    expect(await screen.findByText(/Takımım · Kaptan/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Orbit Robotik/ }));
    expect(navigate).toHaveBeenCalledWith('TeamWorkspace', { teamId: 't1' });
  });

  it('a pending request alone is not on the home screen (it shows on the team profile and under Profil > Takımlar > Bekleyen istekler)', async () => {
    const nova = team('t2', 'Nova Robotik');
    mockMine = [mine('m2', nova, 'member', 'pending')];
    await home();
    await screen.findByText('Bir fikrin ve iki arkadaşın mı var?');
    expect(mockFetchMyTeams).toHaveBeenCalled();
    expect(screen.queryByText(/Takımım/)).toBeNull();
    expect(screen.queryByText('Nova Robotik')).toBeNull();
    expect(screen.queryByText(/İSTEĞİN BEKLİYOR/)).toBeNull();
  });

  it('a pending request next to an active team does not show up either; extra active teams are counted', async () => {
    mockMine = [mine('m1', team('t1', 'Orbit Robotik'), 'member', 'active'), mine('m3', team('t3', 'Delta Takımı'), 'member', 'active'), mine('m2', team('t2', 'Nova Robotik'), 'member', 'pending')];
    await home();
    expect(await screen.findByText(/\+1 takım daha/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Tüm takımların \(2\)/ }));
    expect(parentNavigate).toHaveBeenCalledWith('ProfileTab', { screen: 'ProfileHome', params: { segment: 'Takımlar' } });
    expect(screen.queryByText('Nova Robotik')).toBeNull();
    expect(screen.queryByText('Takımlarım')).toBeNull();
  });

  it('a single active team gets no "Tüm takımların" link', async () => {
    mockMine = [mine('m1', team('t1', 'Orbit Robotik'), 'member', 'active')];
    await home();
    await screen.findByText(/Takımım/);
    expect(screen.queryByText(/Tüm takımların/)).toBeNull();
  });

  it('guest: no memberships are fetched and no shortcut shows', async () => {
    mockUser = null;
    await home();
    await screen.findByText('Bir fikrin ve iki arkadaşın mı var?');
    expect(mockFetchMyTeams).not.toHaveBeenCalled();
    expect(screen.queryByText(/Takımım/)).toBeNull();
  });
});

// RNTL's text normalizer folds the no-break space formatCount emits into a plain space.
describe('Topluluk ana — takım kartları', () => {
  it('segments read Takımlar | Topluluklar; no slogan eyebrow', async () => {
    await home();
    await screen.findAllByRole('tab');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Takımlar');
    expect(screen.getAllByRole('tab')[1]).toHaveTextContent('Topluluklar');
    expect(screen.queryByText('BİRLİKTE DAHA FAZLASI')).toBeNull();
  });

  it('a demo team gets one DemoTag; the name is never repeated as "(örnek)" or "Örnek"', async () => {
    mockTeams = [team('t1', 'Orbit Robotik', { is_demo: true }), team('t2', 'Nova Robotik')];
    await home();
    await screen.findByText('Orbit Robotik');
    expect(screen.getAllByText('ÖRNEK')).toHaveLength(1);
    expect(screen.queryByText(/\(örnek\)/i)).toBeNull();
    expect(screen.queryByText(/^Örnek/)).toBeNull();
  });

  it('member counts read "0 üye", "1 üye", "999 üye"', async () => {
    mockTeams = [team('a', 'Sıfır Takımı', { member_count: 0 }), team('b', 'Tek Takımı', { member_count: 1 }), team('c', 'Bin Takımı', { member_count: 999 })];
    await home();
    expect(await screen.findByText(/(^|· )0 üye/)).toBeTruthy();
    expect(screen.getByText(/(^|· )1 üye/)).toBeTruthy();
    expect(screen.getByText(/(^|· )999 üye/)).toBeTruthy();
  });

  it('the count leads the footnote, so a long category or city is what gets clipped, never the number', async () => {
    mockTeams = [team('a', 'Uzun Kategori', { member_count: 12345, category: 'Mühendislikbilimleriuygulamalarıkategorisi', city: 'Kahramanmaraş · Afşin' })];
    await home();
    expect(await screen.findByText(/^12\.000\+ üye · Mühendislik/)).toBeTruthy();
  });

  it('the icon comes from category_key: robot only for robotics, never from the free-text category', () => {
    expect(categoryIcon('robotics', 'team')).toBe('robot');
    expect(categoryIcon('software', 'team')).not.toBe('robot');
    expect(categoryIcon(undefined, 'team')).not.toBe('robot');
    expect(categoryIcon('other', 'community')).toBe('community');
  });
});

describe('Takım profili', () => {
  it('sparse team (1 member, no city, no about, no open roles): only the facts that exist', async () => {
    mockTeam = team('t1', 'Işık', { member_count: 1 });
    await detail();
    expect(await screen.findByText(/(^|· )1 üye/)).toBeTruthy();
    expect(screen.queryByText('Hakkında')).toBeNull();
    // "Açık roller" is the one section that stays when empty: a single explanatory line instead of a hole.
    expect(await screen.findByText('Açık roller')).toBeTruthy();
    expect(screen.getByText(/Şu an açık rol yok/)).toBeTruthy();
  });

  it('0 members is stated plainly', async () => {
    mockTeam = team('t1', 'Ğ.', { member_count: 0 });
    await detail();
    expect(await screen.findByText(/(^|· )0 üye/)).toBeTruthy();
  });

  it('sections appear when the data exists; role labels keep their case, category stays a capital label', async () => {
    mockTeam = team('t1', 'Orbit Robotik', { about: 'Haftada üç gün atölyede.', category: 'Robotik', city: 'Ankara', member_count: 12 });
    mockPosts = [post('p1', { role_label: 'Mekanik lideri', skills: ['CAD', 'Şasi'] })];
    await detail();
    expect(await screen.findByText('Hakkında')).toBeTruthy();
    expect(await screen.findByText('Açık roller')).toBeTruthy();
    expect(screen.getByText('Mekanik lideri')).toBeTruthy();
    expect(screen.queryByText('MEKANİK LİDERİ')).toBeNull();
    expect(screen.getByText(/TAKIM · ROBOTİK/)).toBeTruthy();
  });

  it('no disabled primary when the team is closed: the reason is a plain line', async () => {
    mockTeam = team('t1', 'Orbit Robotik', { accepts_join_requests: false });
    await detail();
    expect(await screen.findByText(/Şu an yeni üye almıyor/)).toBeTruthy();
    expect(disabledButtons()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Katılma isteği gönder/ })).toBeNull();
  });

  it('a pending request shows the status label from Status.tsx and "İsteği geri çek"; a demo team gets one ÖRNEK', async () => {
    mockTeam = team('t1', 'Orbit Robotik', { is_demo: true });
    mockMembership = { id: 'm1', team_id: 't1', user_id: 'u1', role: 'member', status: 'pending' };
    await detail();
    expect(await screen.findByText('İSTEĞİN BEKLİYOR')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'İsteği geri çek' })).toBeTruthy();
    expect(screen.getAllByText('ÖRNEK')).toHaveLength(1);
    expect(screen.queryByText('ÖRNEK İÇERİK')).toBeNull();
  });

  it('long names are not capitalised or clipped', async () => {
    const long = 'Şehit Öğretmen Ayşe Çağlayan Mesleki ve Teknik Anadolu Lisesi Robotik Takımı';
    mockTeam = team('t1', long);
    await detail();
    const title = await screen.findByText(long);
    expect(title.props.numberOfLines).toBeUndefined();
  });
});

describe('Takım alanı — görev kartı', () => {
  it('keeps the kanban: grouped columns, priority tag, advance action for the assignee', async () => {
    mockRoster = [{ membership_id: 'm1', user_id: 'u1', display_name: 'Ayşe K.', role: 'member', status: 'active', title: null, message: null }];
    mockTasks = [
      { id: 'k1', team_id: 't1', title: 'Şasi çizimini tamamla', description: null, assignee_id: 'u1', due_date: '2099-01-01', status: 'todo', priority: 'high', created_at: '2026-11-01T10:00:00Z', completed_at: null },
      { id: 'k2', team_id: 't1', title: 'Kod gözden geçir', description: null, assignee_id: null, due_date: null, status: 'doing', priority: 'normal', created_at: '2026-11-01T10:00:00Z', completed_at: null },
    ];
    await render(wrap(<TeamWorkspaceScreen {...props<React.ComponentProps<typeof TeamWorkspaceScreen>>('TeamWorkspace', { teamId: 't1' })} />));
    expect(await screen.findByText('Şasi çizimini tamamla')).toBeTruthy();
    expect(screen.getByText('YÜKSEK ÖNCELİK')).toBeTruthy();
    expect(screen.getByText('Yapılacak')).toBeTruthy();
    expect(screen.getByText('Devam ediyor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Şasi çizimini tamamla: Başla' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kod gözden geçir: Tamamla' })).toBeNull(); // not mine, not a manager
  });
});

describe('Q2: names and free text are never upper-cased', () => {
  const dirs = [join(__dirname, '..'), join(__dirname, '..', '..', 'teams')];
  const files = dirs.flatMap((d) => readdirSync(d).filter((f) => /\.tsx?$/.test(f)).map((f) => join(d, f)));
  it('only a category may be capitalised in teams / community sources', () => {
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.flatMap((f) => readFileSync(f, 'utf8').split('\n')
      .filter((l) => /toLocaleUpperCase|toUpperCase|textTransform/.test(l) && !/\.category/.test(l)).map((l) => `${f}: ${l.trim()}`));
    expect(offenders).toEqual([]);
  });
});
