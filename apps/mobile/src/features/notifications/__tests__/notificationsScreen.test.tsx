import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationsScreen } from '../NotificationsScreen';
import { NotificationBell, formatBadge } from '../NotificationBell';
import { groupNotifications } from '../groups';

type Row = { id: string; kind: string; title: string; body: string | null; target_type: string | null; target_id: string | null; read_at: string | null; created_at: string };
let mockUser: string | null = 'u1';
let mockRows: Row[] = []; let mockUnread = 0; let mockGone = false; let mockFail = false; let mockMarkFail = false;
const mockToast = jest.fn(); const order: string[] = [];
const mockMark = jest.fn(async (ids?: string[]) => { order.push(`mark:${ids ? ids.join(',') : 'all'}`); if (mockMarkFail) throw { code: 'PT500', message: 'server_error' }; return 1; });
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchNotifications: async () => { if (mockFail) throw { code: 'PT500', message: 'server_error' }; return mockRows; },
  useUnreadCount: () => mockUnread,
  markRead: (ids?: string[]) => mockMark(ids),
  targetAvailable: async () => !mockGone,
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]) }));

const navigate = jest.fn(); const tabNavigate = jest.fn();
const nav = { navigate, goBack: jest.fn(), getParent: () => ({ navigate: (...a: unknown[]) => { order.push('route'); tabNavigate(...a); } }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = async (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>);
};
const open = () => wrap(<NotificationsScreen {...({ navigation: nav, route: { key: 'k', name: 'Notifications' } } as unknown as React.ComponentProps<typeof NotificationsScreen>)} />);

const NOW = new Date('2026-11-13T09:00:00Z'); // Friday 12:00 in Istanbul
const row = (id: string, over: Partial<Row> = {}): Row => ({
  id, kind: 'registration.confirmed', title: 'Kaydın onaylandı.', body: 'Robotik Atölyesi için yerin hazır.', target_type: 'event_registration', target_id: `r-${id}`,
  read_at: null, created_at: '2026-11-13T08:00:00Z', ...over,
});

// Frozen clock for `new Date()` / `Date.now()` only (timers stay real, so waitFor keeps working).
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args: unknown[]) { if (args.length === 0) super(NOW.getTime()); else super(...(args as [number])); }
  static override now() { return NOW.getTime(); }
}
beforeAll(() => { (globalThis as { Date: DateConstructor }).Date = FrozenDate as unknown as DateConstructor; });
afterAll(() => { (globalThis as { Date: DateConstructor }).Date = RealDate; });
beforeEach(() => {
  mockUser = 'u1'; mockRows = []; mockUnread = 0; mockGone = false; mockFail = false; mockMarkFail = false; order.length = 0;
  for (const m of [mockToast, mockMark, navigate, tabNavigate]) m.mockClear();
});

describe('formatBadge', () => {
  it('0 → empty, 1–99 → the number, ≥100 → 99+', () => {
    expect(formatBadge(0)).toBe('');
    expect(formatBadge(1)).toBe('1');
    expect(formatBadge(99)).toBe('99');
    expect(formatBadge(100)).toBe('99+');
    expect(formatBadge(120)).toBe('99+');
  });
  it('never shows a negative or fractional count', () => {
    expect(formatBadge(-3)).toBe('');
    expect(formatBadge(2.7)).toBe('2');
  });
});

describe('NotificationBell', () => {
  it('names the unread count for screen readers: "Bildirimler, 3 okunmamış"', async () => {
    mockUnread = 3;
    await wrap(<NotificationBell onPress={() => {}} />);
    expect(await screen.findByLabelText('Bildirimler, 3 okunmamış')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
  it('plain "Bildirimler" with nothing unread, and no badge', async () => {
    await wrap(<NotificationBell onPress={() => {}} />);
    expect(await screen.findByLabelText('Bildirimler')).toBeTruthy();
    expect(screen.queryByTestId('icon-badge')).toBeNull();
  });
  it('120 unread: badge reads 99+, the label keeps the real number', async () => {
    mockUnread = 120;
    await wrap(<NotificationBell onPress={() => {}} />);
    expect(await screen.findByLabelText('Bildirimler, 120 okunmamış')).toBeTruthy();
    expect(screen.getByText('99+')).toBeTruthy();
  });
  it('guests get no bell at all', async () => {
    mockUser = null;
    await wrap(<NotificationBell onPress={() => {}} />);
    expect(screen.queryByLabelText(/Bildirimler/)).toBeNull();
  });
});

describe('groupNotifications (Europe/Istanbul days, week starts Monday)', () => {
  const g = (iso: string) => groupNotifications([{ created_at: iso }], NOW)[0]?.label;
  it('Bugün / Bu hafta / Daha önce', () => {
    expect(g('2026-11-13T08:00:00Z')).toBe('Bugün');
    expect(g('2026-11-10T10:00:00Z')).toBe('Bu hafta');
    expect(g('2026-11-02T10:00:00Z')).toBe('Daha önce');
  });
  it('uses Istanbul midnight, not UTC: 00:30 Istanbul on the 13th is still today', () => {
    expect(g('2026-11-12T21:30:00Z')).toBe('Bugün');
    expect(g('2026-11-12T20:30:00Z')).toBe('Bu hafta');
  });
  it('the week starts Monday 00:00 Istanbul', () => {
    expect(g('2026-11-08T21:00:00Z')).toBe('Bu hafta');
    expect(g('2026-11-08T20:59:00Z')).toBe('Daha önce');
  });
  it('keeps the incoming (newest first) order and omits empty groups', () => {
    const out = groupNotifications([{ created_at: '2026-11-13T08:00:00Z' }, { created_at: '2026-10-01T08:00:00Z' }], NOW);
    expect(out.map((x) => x.label)).toEqual(['Bugün', 'Daha önce']);
  });
});

describe('Bildirimler ekranı', () => {
  it('empty: the Faz 4 copy, no mark-all', async () => {
    await open();
    expect(await screen.findByText('Henüz bildirim yok.')).toBeTruthy();
    expect(screen.getByText('Kayıt ve başvuru güncellemelerin burada görünür.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tümünü okundu say' })).toBeNull();
  });

  it('renders the server title and body verbatim (no client copy per kind)', async () => {
    mockRows = [row('a', { kind: 'event.reminder_24h', target_type: 'event', title: 'Etkinliğine bir gün kaldı.', body: 'Robotik Atölyesi yaklaşık 24 saat sonra başlıyor.' })];
    await open();
    expect(await screen.findByText('Etkinliğine bir gün kaldı.')).toBeTruthy();
    expect(screen.getByText('Robotik Atölyesi yaklaşık 24 saat sonra başlıyor.')).toBeTruthy();
  });

  it('groups: Bugün, Bu hafta, Daha önce in that order, each with its rows', async () => {
    mockRows = [row('a', { title: 'Bugünkü' }), row('b', { title: 'Haftaki', created_at: '2026-11-10T10:00:00Z' }), row('c', { title: 'Eski', created_at: '2026-10-20T10:00:00Z' })];
    await open();
    await screen.findByText('Bugünkü');
    const headings = ['BUGÜN', 'BU HAFTA', 'DAHA ÖNCE'].map((h) => screen.getByText(h));
    expect(headings).toHaveLength(3);
    const order = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel)).filter((l) => /Bugünkü|Haftaki|Eski/.test(l));
    expect(order.map((l) => l.split('.')[0])).toEqual(['Bugünkü', 'Haftaki', 'Eski']);
  });

  it('unread rows are announced as unread; read rows are not', async () => {
    mockRows = [row('a', { title: 'Yeni' }), row('b', { title: 'Eski', read_at: '2026-11-13T08:30:00Z' })];
    await open();
    await screen.findByText('Yeni');
    expect(screen.getByRole('button', { name: /Yeni.*Okunmadı/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Eski.*Okunmadı/ })).toBeNull();
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
  });

  it('"Tümünü okundu say" only while something is unread; it marks all', async () => {
    mockRows = [row('a'), row('b')]; mockUnread = 2;
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tümünü okundu say' }));
    await waitFor(() => expect(mockMark).toHaveBeenCalledWith(undefined));
  });
  it('all read → no mark-all button', async () => {
    mockRows = [row('a', { read_at: '2026-11-13T08:30:00Z' })]; mockUnread = 0;
    await open();
    await screen.findByText('Kaydın onaylandı.');
    expect(screen.queryByRole('button', { name: 'Tümünü okundu say' })).toBeNull();
  });
  it('a failed mark-all says so with the shared error copy', async () => {
    mockRows = [row('a')]; mockUnread = 1; mockMarkFail = true;
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tümünü okundu say' }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Bizim tarafta'), 'danger'));
  });

  it('tap: mark_notifications_read([id]) first, then the route', async () => {
    mockRows = [row('a', { title: 'Kaydın onaylandı.', target_id: 'reg-9' })]; mockUnread = 1;
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Kaydın onaylandı/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalled());
    expect(order).toEqual(['mark:a', 'route']);
    expect(tabNavigate).toHaveBeenCalledWith('EventsTab', { screen: 'RegistrationStatus', params: { registrationId: 'reg-9' }, initial: false });
  });

  it('target gone (not readable any more): row still marked read, explanatory toast, no navigation, no 404 screen', async () => {
    mockRows = [row('a', { kind: 'event.reminder_24h', target_type: 'event', title: 'Etkinliğine bir gün kaldı.', target_id: 'ev-1' })]; mockGone = true;
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Etkinliğine bir gün kaldı/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Bu içerik artık yok'));
    expect(mockMark).toHaveBeenCalledWith(['a']);
    expect(tabNavigate).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no route for the kind: still marked read + same toast', async () => {
    mockRows = [row('a', { kind: 'brand.new.kind', target_type: null, target_id: null, title: 'Yeni tür' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Yeni tür/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Bu içerik artık yok'));
    expect(mockMark).toHaveBeenCalledWith(['a']);
    expect(tabNavigate).not.toHaveBeenCalled();
  });

  it('marking fails (offline): the destination still opens', async () => {
    mockRows = [row('a', { target_id: 'reg-9' })]; mockMarkFail = true;
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Kaydın onaylandı/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalled());
  });

  it('error state offers a retry; guests are asked to sign in', async () => {
    mockFail = true;
    const { unmount } = await open();
    expect(await screen.findByRole('button', { name: 'Tekrar dene' })).toBeTruthy();
    await unmount();
    mockUser = null;
    await open();
    expect(await screen.findByText('Bildirimlerini görmek için giriş yap')).toBeTruthy();
  });
});
