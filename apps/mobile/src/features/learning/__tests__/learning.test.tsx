import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CourseListScreen } from '../CourseListScreen';
import { CourseDetailScreen } from '../CourseDetailScreen';
import { LessonScreen } from '../LessonScreen';

jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]) }));
let mockUser: string | null = 'u1';
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
const mockSaveToggle = jest.fn(); let mockSavedIds = new Set<string>();
jest.mock('../../saved/useBookmarks', () => ({ useBookmarks: () => ({ ids: mockSavedIds, toggle: mockSaveToggle, pending: false, requiresAuth: false, ready: true }) }));
const mockIntent = { set: jest.fn(), consume: jest.fn(), clear: jest.fn() };
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => mockIntent }));
const mockToast = jest.fn(); const mockToastApi = { show: mockToast };
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => mockToastApi }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));

type Row = Record<string, unknown>;
const course = (id: string, title: string, over: Row = {}): Row => ({ id, title, poster_line: null, summary: `${title} özeti`, level: 'beginner', tone: 'moss', estimated_minutes: 45, lesson_count: 3, is_demo: false, status: 'published', topic_interest_id: null, ...over });
const lesson = (id: string, courseId: string, sort: number, title: string, body = 'Gövde.'): Row => ({ id, course_id: courseId, sort_order: sort, title, body, estimated_minutes: 5 });

const mockDb: { courses: Row[]; lessons: Row[]; course_progress: Row[]; fail: string[]; rpcCalls: { fn: string; args: Row }[] } = { courses: [], lessons: [], course_progress: [], fail: [], rpcCalls: [] };
const mockOrders: { table: string; col: string }[] = [];

function mockBuilder(table: string) {
  const filters: [string, unknown][] = []; let orderCol: string | null = null; let mode: 'many' | 'single' | 'maybe' = 'many'; let selected = '';
  const b: Record<string, unknown> = {};
  b.select = (cols: string) => { selected = cols; return b; };
  b.eq = (c: string, v: unknown) => { filters.push([c, v]); return b; };
  b.in = () => b; b.limit = () => b; b.overrideTypes = () => b;
  b.order = (c: string) => { orderCol = c; mockOrders.push({ table, col: c }); return b; };
  b.single = () => { mode = 'single'; return b; };
  b.maybeSingle = () => { mode = 'maybe'; return b; };
  b.then = (resolve: (v: unknown) => unknown) => {
    if (mockDb.fail.includes(table)) return Promise.resolve({ data: null, error: { message: 'boom', code: 'PT500' } }).then(resolve);
    let rows = ((mockDb as unknown as Record<string, Row[]>)[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v));
    // Like the server: published only, and ordering is the server's job.
    if (table === 'courses') rows = rows.filter((r) => r.status === 'published');
    if (orderCol) { const c = orderCol; rows = [...rows].sort((a, z) => Number(a[c]) - Number(z[c])); }
    if (mode === 'single') return Promise.resolve(rows[0] ? { data: rows[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } }).then(resolve);
    if (mode === 'maybe') return Promise.resolve({ data: rows[0] ?? null, error: null }).then(resolve);
    void selected;
    return Promise.resolve({ data: rows, error: null }).then(resolve);
  };
  return b;
}
jest.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({
    from: (t: string) => mockBuilder(t),
    rpc: async (fn: string, args: Row) => {
      mockDb.rpcCalls.push({ fn, args });
      if (mockDb.fail.includes('rpc')) return { data: null, error: { message: 'lesson_not_found', code: 'PT404' } };
      const l = mockDb.lessons.find((x) => x.id === args.p_lesson_id)!;
      const cid = l.course_id as string;
      const prev = mockDb.course_progress.find((p) => p.course_id === cid && p.user_id === 'u1');
      const done = [...new Set([...(prev?.completed_lesson_ids as string[] ?? []), l.id as string])];
      const total = mockDb.lessons.filter((x) => x.course_id === cid).length;
      const row = { user_id: 'u1', course_id: cid, completed_lesson_ids: done, percent: Math.floor((100 * done.length) / total), completed_at: done.length >= total ? 'now' : null, started_at: 'x', created_at: 'x', updated_at: 'x' };
      mockDb.course_progress = [...mockDb.course_progress.filter((p) => p !== prev), row];
      return { data: row, error: null };
    },
  }),
}));

const navigate = jest.fn(); const replace = jest.fn(); const parentNavigate = jest.fn();
const nav = { navigate, replace, goBack: jest.fn(), getParent: () => ({ navigate: parentNavigate, getParent: () => ({ navigate: parentNavigate }) }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
async function mount(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{node}</QueryClientProvider></SafeAreaProvider>);
}
const props = (name: string, params?: Row) => ({ navigation: nav, route: { key: 'k', name, params } }) as unknown as { navigation: never; route: never };

beforeEach(() => {
  mockUser = 'u1'; mockSavedIds = new Set();
  Object.assign(mockDb, { courses: [], lessons: [], course_progress: [], fail: [], rpcCalls: [] });
  mockOrders.length = 0;
  for (const m of [navigate, replace, parentNavigate, mockToast, mockSaveToggle, mockIntent.set, mockIntent.consume, mockIntent.clear]) m.mockReset();
  mockIntent.consume.mockReturnValue(null);
});

const seedCourse = () => {
  mockDb.courses = [course('c1', 'Arduino’ya giriş')];
  // Inserted out of order: the screen must follow sort_order, not insertion order.
  mockDb.lessons = [lesson('l3', 'c1', 30, 'Üçüncü ders'), lesson('l1', 'c1', 10, 'Birinci ders'), lesson('l2', 'c1', 20, 'İkinci ders')];
};

describe('Gelişim — kurs listesi', () => {
  it('lists published courses with lesson count and duration; a draft never shows', async () => {
    mockDb.courses = [course('c1', 'Arduino’ya giriş'), course('c2', 'Taslak kurs', { status: 'draft' })];
    await mount(<CourseListScreen {...props('CourseList')} />);
    expect(await screen.findByText('Arduino’ya giriş')).toBeTruthy();
    expect(screen.queryByText('Taslak kurs')).toBeNull();
    expect(screen.getByText(/3 ders · 45 dk/)).toBeTruthy();
  });
  it('a course without lessons yet says "Dersler yakında", not "0 ders"', async () => {
    mockDb.courses = [course('c1', 'Boş kurs', { lesson_count: 0, estimated_minutes: null })];
    await mount(<CourseListScreen {...props('CourseList')} />);
    expect(await screen.findByText(/Dersler yakında/)).toBeTruthy();
    expect(screen.queryByText(/0 ders/)).toBeNull();
  });
  it('empty: says so', async () => {
    await mount(<CourseListScreen {...props('CourseList')} />);
    expect(await screen.findByText('Şu an yayında eğitim yok')).toBeTruthy();
  });
});

describe('Gelişim — kurs detayı', () => {
  it('lessons follow sort_order (the query orders on it)', async () => {
    seedCourse();
    await mount(<CourseDetailScreen {...props('CourseDetail', { courseId: 'c1' })} />);
    await screen.findByText('1. Birinci ders');
    const titles = screen.getAllByText(/^\d\. .+ ders$/).map((n) => n.props.children as string);
    expect(titles).toEqual(['1. Birinci ders', '2. İkinci ders', '3. Üçüncü ders']);
    expect(mockOrders).toContainEqual({ table: 'lessons', col: 'sort_order' });
  });

  it('progress percent is the server value, not recomputed from ids', async () => {
    seedCourse();
    // 1 of 3 lessons would be 33; the server says 40 and that is what is shown.
    mockDb.course_progress = [{ user_id: 'u1', course_id: 'c1', completed_lesson_ids: ['l1'], percent: 40, completed_at: null }];
    await mount(<CourseDetailScreen {...props('CourseDetail', { courseId: 'c1' })} />);
    expect(await screen.findByText(/%40/)).toBeTruthy();
    expect(screen.queryByText(/%33/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Devam et' })).toBeTruthy();
  });

  it('not started: "Başla" opens the first lesson; guest sees no progress', async () => {
    seedCourse(); mockUser = null;
    await mount(<CourseDetailScreen {...props('CourseDetail', { courseId: 'c1' })} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Başla' }));
    expect(navigate).toHaveBeenCalledWith('Lesson', { courseId: 'c1', lessonId: 'l1' });
    expect(screen.queryByText(/%\d/)).toBeNull();
  });

  it('save control toggles the course bookmark', async () => {
    seedCourse();
    await mount(<CourseDetailScreen {...props('CourseDetail', { courseId: 'c1' })} />);
    await screen.findByText('1. Birinci ders');
    fireEvent.press(screen.getAllByRole('button', { name: 'Kaydet' })[0]!);
    expect(mockSaveToggle).toHaveBeenCalledWith('c1');
  });

  it('unreadable (unpublished) course: error state, not a crash', async () => {
    await mount(<CourseDetailScreen {...props('CourseDetail', { courseId: 'nope' })} />);
    expect(await screen.findByText(/Tekrar dene|bulunamadı|bulunamıyor/i)).toBeTruthy();
  });
});

describe('Gelişim — ders', () => {
  const open = (lessonId = 'l1') => mount(<LessonScreen {...props('Lesson', { courseId: 'c1', lessonId })} />);

  it('guest reads the lesson (paragraphs) but "Tamamladım" asks for sign-in and completes nothing', async () => {
    seedCourse(); mockUser = null;
    mockDb.lessons = mockDb.lessons.map((l) => (l.id === 'l1' ? { ...l, body: 'Birinci paragraf.\r\n\r\nİkinci paragraf.' } : l));
    await open();
    expect(await screen.findByText('Birinci paragraf.')).toBeTruthy();
    expect(screen.getByText('İkinci paragraf.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Tamamladım' }));
    expect(mockIntent.set).toHaveBeenCalledWith({ type: 'complete_lesson', courseId: 'c1', lessonId: 'l1' });
    expect(parentNavigate).toHaveBeenCalledWith('AuthEmail');
    expect(mockDb.rpcCalls).toHaveLength(0);
  });

  it('back from sign-in: the pending completion is finished', async () => {
    seedCourse();
    mockIntent.consume.mockImplementation((t: string, m?: (i: unknown) => boolean) => (t === 'complete_lesson' && (!m || m({ lessonId: 'l1' })) ? { type: 'complete_lesson', courseId: 'c1', lessonId: 'l1' } : null));
    await open();
    await waitFor(() => expect(mockDb.rpcCalls).toEqual([{ fn: 'complete_lesson', args: { p_lesson_id: 'l1' } }]));
  });

  it('signed in: completes via complete_lesson, says the server percent, then offers the next lesson', async () => {
    seedCourse();
    await open();
    fireEvent.press(await screen.findByRole('button', { name: 'Tamamladım' }));
    await waitFor(() => expect(mockDb.rpcCalls).toEqual([{ fn: 'complete_lesson', args: { p_lesson_id: 'l1' } }]));
    expect(await screen.findByRole('button', { name: 'Sonraki ders' })).toBeTruthy();
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('%33'));
    expect(screen.queryByRole('button', { name: 'Tamamladım' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Sonraki ders' }));
    expect(replace).toHaveBeenCalledWith('Lesson', { courseId: 'c1', lessonId: 'l2' });
  });

  it('last lesson done: the action returns to the course', async () => {
    seedCourse();
    mockDb.course_progress = [{ user_id: 'u1', course_id: 'c1', completed_lesson_ids: ['l3'], percent: 33, completed_at: null }];
    await open('l3');
    fireEvent.press(await screen.findByRole('button', { name: 'Eğitime dön' }));
    expect(navigate).toHaveBeenCalledWith('CourseDetail', { courseId: 'c1' });
  });

  it('a failed completion keeps "Tamamladım" available and names the error; no primary button is ever disabled', async () => {
    seedCourse(); mockDb.fail = ['rpc'];
    await open();
    fireEvent.press(await screen.findByRole('button', { name: 'Tamamladım' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Bu ders artık yayında değil.', 'danger'));
    expect(screen.getByRole('button', { name: 'Tamamladım' })).toBeTruthy();
    expect(screen.queryAllByRole('button').filter((b) => b.props.accessibilityState?.disabled)).toHaveLength(0);
  });
});

// Last on purpose: pressing a RowCard (reanimated press scale) leaves the act environment unusable for later renders in this file.
describe('Gelişim — kurs listesi, dokunma', () => {
  it('opens the detail and saves from the card', async () => {
    mockDb.courses = [course('c1', 'Arduino’ya giriş')];
    await mount(<CourseListScreen {...props('CourseList')} />);
    fireEvent.press(await screen.findByRole('button', { name: /Arduino’ya giriş/ }));
    expect(navigate).toHaveBeenCalledWith('CourseDetail', { courseId: 'c1' });
    fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(mockSaveToggle).toHaveBeenCalledWith('c1');
  });
});
