import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationsScreen } from '../NotificationsScreen';

// The probe is NOT mocked away here: `targetAvailable` runs for real against a fake Supabase client.
type Row = { id: string; kind: string; title: string; body: string | null; target_type: string | null; target_id: string | null; read_at: string | null; created_at: string };
let mockRows: Row[] = []; let mockUnread = 0; let mockMarkFail = false; let mockProbe: 'missing' | 'present' | 'error' = 'missing';
const probed: string[] = []; const mockToast = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      b.select = () => b; b.eq = () => b;
      b.maybeSingle = async () => { probed.push(table); return mockProbe === 'error' ? { data: null, error: { message: 'Failed to fetch', code: '' } } : { data: mockProbe === 'present' ? { id: 'x' } : null, error: null }; };
      return b;
    },
  }),
}));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchNotifications: async () => mockRows,
  useUnreadCount: () => mockUnread,
  markRead: async () => { if (mockMarkFail) throw { code: 'PT500', message: 'server_error' }; return 1; },
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

const tabNavigate = jest.fn();
const nav = { navigate: jest.fn(), goBack: jest.fn(), getParent: () => ({ navigate: tabNavigate }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  const props = { navigation: nav, route: { key: 'k', name: 'Notifications' } } as unknown as React.ComponentProps<typeof NotificationsScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><NotificationsScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
const row = (over: Partial<Row>): Row => ({ id: 'a', kind: 'registration.confirmed', title: 'Başlık', body: null, target_type: 'event_registration', target_id: 'r1', read_at: null, created_at: new Date().toISOString(), ...over });
beforeEach(() => { mockRows = []; mockUnread = 0; mockMarkFail = false; mockProbe = 'missing'; probed.length = 0; mockToast.mockClear(); tabNavigate.mockClear(); });

describe('list destinations are opened even when their entity is gone', () => {
  it('event.cancelled, event unreadable → Katılımlarım, no probe, no toast', async () => {
    mockRows = [row({ kind: 'event.cancelled', target_type: 'event', target_id: 'ev1', title: 'Etkinlik iptal edildi.' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Etkinlik iptal edildi/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalledWith('EventsTab', { screen: 'MyRegistrations', params: {}, initial: false }));
    expect(probed).toEqual([]);
    expect(mockToast).not.toHaveBeenCalled();
  });
  it('application.status_changed, application gone (withdrawn) → Başvurularım (a list that handles absence), no toast', async () => {
    mockRows = [row({ kind: 'application.status_changed', target_type: 'application', target_id: 'ap1', title: 'Başvurunda yeni bir durum var.' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Başvurunda yeni bir durum var/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalledWith('OpportunitiesTab', { screen: 'MyApplications', params: {}, initial: false }));
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('detail destinations are probed for real', () => {
  it('event.reminder_24h with the event unreadable → toast, no navigation', async () => {
    mockRows = [row({ kind: 'event.reminder_24h', target_type: 'event', target_id: 'ev1', title: 'Etkinliğine bir gün kaldı.' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Etkinliğine bir gün kaldı/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Bu içerik artık yok'));
    expect(probed).toEqual(['events']);
    expect(tabNavigate).not.toHaveBeenCalled();
  });
  it('readable target → navigates', async () => {
    mockProbe = 'present';
    mockRows = [row({ kind: 'team_join.accepted', target_type: 'team', target_id: 't1', title: 'Takıma katıldın.' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Takıma katıldın/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalledWith('CommunityTab', { screen: 'TeamDetail', params: { teamId: 't1' }, initial: false }));
    expect(probed).toEqual(['teams']);
  });
  it('a probe that errors (offline) proves nothing: treated as available, navigates, no toast', async () => {
    mockProbe = 'error';
    mockRows = [row({ target_id: 'r9' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Başlık/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalledWith('EventsTab', { screen: 'RegistrationStatus', params: { registrationId: 'r9' }, initial: false }));
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('marking fails', () => {
  it('still navigates, and the row and the count stay unread after the refresh (no false "read")', async () => {
    mockMarkFail = true; mockUnread = 1; mockProbe = 'present';
    mockRows = [row({ target_id: 'r9' })];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: /Başlık/ }));
    await waitFor(() => expect(tabNavigate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByTestId('unread-dot')).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Tümünü okundu say' })).toBeTruthy();
    expect(mockToast).not.toHaveBeenCalled();
  });
});
