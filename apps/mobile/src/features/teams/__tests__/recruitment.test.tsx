import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { makeError } from '../../../lib/errors';
import { RecruitmentPostEditorScreen } from '../RecruitmentPostEditorScreen';
import { TeamProjectEditorScreen } from '../TeamProjectEditorScreen';
import { TeamWorkspaceScreen } from '../TeamWorkspaceScreen';

const post = (id: string, over: Record<string, unknown> = {}) => ({ id, team_id: 't1', title: 'Mekanik ekibine katıl', role_label: 'Mekanik lideri', description: null, skills: ['CAD'], is_open: true, closes_at: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', ...over });
const application = (id: string, postId: string, over: Record<string, unknown> = {}) => ({ id, post_id: postId, display_name: 'Elif Arslan', is_minor: false, message: 'Atölyede çalışmak istiyorum', status: 'submitted', created_at: '2026-11-03T10:00:00Z', ...over });
const rosterRow = (role: string) => [{ membership_id: 'm1', user_id: 'u1', display_name: 'Ayşe K.', role, status: 'active', title: null, message: null }];

let mockRole = 'captain'; let mockPosts: unknown[] = []; let mockApps: unknown[] = []; let mockProjects: unknown[] = [];
const mockSetOpen = jest.fn(async () => undefined); const mockDecide = jest.fn(async () => ({})); const mockSavePost = jest.fn(async () => 'p-new');
const mockUpsert = jest.fn(); const mockDeleteProject = jest.fn(async () => undefined);
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchTeam: async () => ({ id: 't1', name: 'Orbit Robotik' }),
  fetchRoster: async () => rosterRow(mockRole),
  fetchTasks: async () => [],
  fetchAllPosts: async () => mockPosts,
  fetchPostApplications: async () => mockApps,
  fetchTeamProjects: async () => mockProjects,
  setRecruitmentPostOpen: (...a: unknown[]) => (mockSetOpen as unknown as (...x: unknown[]) => unknown)(...a),
  decideRecruitmentApplication: (...a: unknown[]) => (mockDecide as unknown as (...x: unknown[]) => unknown)(...a),
  saveRecruitmentPost: (...a: unknown[]) => (mockSavePost as unknown as (...x: unknown[]) => unknown)(...a),
  upsertTeamProject: (...a: unknown[]) => (mockUpsert as unknown as (...x: unknown[]) => unknown)(...a),
  deleteTeamProject: (...a: unknown[]) => (mockDeleteProject as unknown as (...x: unknown[]) => unknown)(...a),
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));

const navigate = jest.fn(); const goBack = jest.fn();
beforeEach(() => {
  mockRole = 'captain'; mockPosts = []; mockApps = []; mockProjects = [];
  for (const m of [navigate, goBack, mockSetOpen, mockDecide, mockSavePost, mockUpsert, mockDeleteProject]) m.mockClear();
  mockUpsert.mockReset(); mockUpsert.mockResolvedValue({});
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>);
};
const nav = { navigate, goBack, replace: jest.fn(), popTo: jest.fn(), getParent: () => ({ navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) }) };
const props = <T,>(name: string, params: object) => ({ navigation: nav, route: { key: 'k', name, params } }) as unknown as T;
const workspace = async () => {
  await mount(<TeamWorkspaceScreen {...props<React.ComponentProps<typeof TeamWorkspaceScreen>>('TeamWorkspace', { teamId: 't1' })} />);
  await fireEvent.press(await screen.findByRole('tab', { name: 'İlanlar' }));
};
const disabledButtons = () => screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);

describe('Takım alanı — İlanlar', () => {
  it('only captains and mentors get the tab', async () => {
    mockRole = 'member';
    await mount(<TeamWorkspaceScreen {...props<React.ComponentProps<typeof TeamWorkspaceScreen>>('TeamWorkspace', { teamId: 't1' })} />);
    await screen.findByText('Görevler');
    expect(screen.queryByRole('tab', { name: 'İlanlar' })).toBeNull();
  });

  it('no posts: an empty state that opens the editor', async () => {
    await workspace();
    expect(await screen.findByText('Henüz açık rol ilanı yok')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'İlan aç' }));
    expect(navigate).toHaveBeenCalledWith('RecruitmentPostEditor', { teamId: 't1' });
  });

  it('lists open and closed posts with the status wording from Status.tsx; closing and reopening go through the server', async () => {
    mockPosts = [post('p1'), post('p2', { title: 'Yazılım ekibi', is_open: false })];
    await workspace();
    expect(await screen.findByText('AÇIK')).toBeTruthy();
    expect(screen.getByText('KAPALI')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mekanik ekibine katıl: ilanı kapat' }));
    await waitFor(() => expect(mockSetOpen).toHaveBeenCalledWith('p1', false));
    await fireEvent.press(screen.getByRole('button', { name: 'Yazılım ekibi: ilanı yeniden aç' }));
    await waitFor(() => expect(mockSetOpen).toHaveBeenCalledWith('p2', true));
    await fireEvent.press(screen.getByRole('button', { name: 'Yazılım ekibi: düzenle' }));
    expect(navigate).toHaveBeenCalledWith('RecruitmentPostEditor', { teamId: 't1', postId: 'p2' });
  });

  it('a post whose closing date has passed reads KAPALI even though is_open is still true', async () => {
    mockPosts = [post('p1', { closes_at: '2020-01-01T20:59:59Z' })];
    await workspace();
    expect(await screen.findByText('KAPALI')).toBeTruthy();
    expect(screen.queryByText('AÇIK')).toBeNull();
  });

  it('names the applicant; an under-18 applicant carries the neutral "18 YAŞ ALTI" tag, an adult does not', async () => {
    mockPosts = [post('p1')]; mockApps = [application('a1', 'p1'), application('a2', 'p1', { display_name: 'Genç Başvuran', is_minor: true }), application('a3', 'p1', { display_name: null })];
    await workspace();
    expect(await screen.findByText('Elif Arslan')).toBeTruthy();
    expect(screen.getByText('Genç Başvuran')).toBeTruthy();
    expect(screen.getByText('İsimsiz kullanıcı')).toBeTruthy();
    expect(screen.getAllByText('18 YAŞ ALTI')).toHaveLength(1);
    expect(screen.queryByText(/Başvuranın adı, kabul/)).toBeNull();
  });

  it('a captain decides an application with decide_recruitment_application', async () => {
    mockPosts = [post('p1')]; mockApps = [application('a1', 'p1'), application('a2', 'p1', { message: null })];
    await workspace();
    expect(await screen.findByText('2 başvuru karar bekliyor')).toBeTruthy();
    expect(screen.getByText(/Atölyede çalışmak istiyorum/)).toBeTruthy();
    const accept = screen.getAllByRole('button', { name: 'Mekanik ekibine katıl: başvuruyu kabul et' });
    await fireEvent.press(accept[0]!);
    await waitFor(() => expect(mockDecide).toHaveBeenCalledWith('a1', true));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Mekanik ekibine katıl: başvuruyu reddet' })[1]!);
    await waitFor(() => expect(mockDecide).toHaveBeenCalledWith('a2', false));
    expect(disabledButtons()).toHaveLength(0);
  });
});

describe('İlan editörü', () => {
  it('saves trimmed values and never sends created_by (the API layer has no way to)', async () => {
    await mount(<RecruitmentPostEditorScreen {...props<React.ComponentProps<typeof RecruitmentPostEditorScreen>>('RecruitmentPostEditor', { teamId: 't1' })} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'İlanı yayınla' }));
    expect(await screen.findByText(/3 ile 120 karakter/)).toBeTruthy();
    expect(mockSavePost).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('İlan başlığı'), '  Yazılım ekibi  ');
    await fireEvent.changeText(screen.getByLabelText('Beceriler (isteğe bağlı)'), 'Python, ,C++');
    await fireEvent.press(screen.getByRole('button', { name: 'İlanı yayınla' }));
    await waitFor(() => expect(mockSavePost).toHaveBeenCalledWith('t1', undefined, { title: 'Yazılım ekibi', roleLabel: '', description: '', skills: ['Python', 'C++'], closesAt: null }));
  });
});

describe('Proje editörü', () => {
  const editor = (params: object = { teamId: 't1' }) => mount(<TeamProjectEditorScreen {...props<React.ComponentProps<typeof TeamProjectEditorScreen>>('TeamProjectEditor', params)} />);

  it('validates before calling the server: https only, year range', async () => {
    await editor();
    await fireEvent.changeText(await screen.findByLabelText('Proje adı'), 'Otonom şasi');
    await fireEvent.changeText(screen.getByLabelText('Bağlantı (isteğe bağlı)'), 'http://orbit.example');
    await fireEvent.changeText(screen.getByLabelText('Yıl (isteğe bağlı)'), '1999');
    await fireEvent.press(screen.getByRole('button', { name: 'Projeyi ekle' }));
    expect(await screen.findByText(/https:\/\/ ile başlamalı/)).toBeTruthy();
    expect(screen.getByText(/2000 ile 2100/)).toBeTruthy();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves through upsert_team_project', async () => {
    await editor();
    await fireEvent.changeText(await screen.findByLabelText('Proje adı'), 'Otonom şasi');
    await fireEvent.changeText(screen.getByLabelText('Yıl (isteğe bağlı)'), '2026');
    await fireEvent.changeText(screen.getByLabelText('Bağlantı (isteğe bağlı)'), 'https://orbit.example/sasi');
    await fireEvent.press(screen.getByRole('button', { name: 'Projeyi ekle' }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith('t1', null, { title: 'Otonom şasi', summary: '', year: 2026, url: 'https://orbit.example/sasi' }));
  });

  it('the 50-project cap is stated honestly and offers no retry', async () => {
    mockUpsert.mockRejectedValue(makeError('team_project_limit', 429));
    await editor();
    await fireEvent.changeText(await screen.findByLabelText('Proje adı'), 'Elli birinci');
    await fireEvent.press(screen.getByRole('button', { name: 'Projeyi ekle' }));
    expect(await screen.findByText('Bir takım en fazla 50 proje ekleyebilir.')).toBeTruthy();
    expect(screen.queryByText('Tekrar dene')).toBeNull();
  });

  it('editing starts from the stored project; delete asks first', async () => {
    mockProjects = [{ id: 'pr1', team_id: 't1', title: 'Otonom şasi', summary: 'Sezon', year: 2026, url: null, created_at: '', updated_at: '' }];
    await editor({ teamId: 't1', projectId: 'pr1' });
    expect(await screen.findByDisplayValue('Otonom şasi')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Projeyi sil' }));
    expect(mockDeleteProject).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByRole('button', { name: 'Evet, sil' }));
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledWith('pr1'));
  });
});
