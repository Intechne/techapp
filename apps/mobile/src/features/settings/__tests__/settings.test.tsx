import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WEB_ORIGIN, WEB_PATHS } from '../../../lib/domain';
import { SettingsScreen } from '../SettingsScreen';
import { NotificationSettingsScreen } from '../NotificationSettingsScreen';
import { PrivacyScreen } from '../PrivacyScreen';
import { DISCOVERABLE_HELP, MINOR_DISCOVERABLE_TEXT, RETENTION_FACT } from '../labels';

let mockUser: string | null = 'u1';
let mockMinor: boolean | null = false;
let mockAccountError = false;
let mockReminders = true; let mockPrefsFail = false; let mockDiscoverable = false; let mockShareToken: string | null = null;
const mockToast = jest.fn(); const mockUpdatePrefs = jest.fn(); const mockOpen = jest.fn(async () => {}); const mockHapticsFlag = jest.fn();
const mockSignOut = jest.fn(async () => {}); const mockDelete = jest.fn(async () => {});
const mockSetReminders = jest.fn(async (_v: boolean) => { if (mockPrefsFail) throw { code: 'PT422', message: 'notification_preferences_invalid' }; });
const mockSetDiscoverable = jest.fn(async (_u: string, _v: boolean) => {});

jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchNotificationPrefs: async () => ({ event_reminders: mockReminders }),
  setEventReminders: (v: boolean) => mockSetReminders(v),
  setDiscoverable: (u: string, v: boolean) => mockSetDiscoverable(u, v),
}));
jest.mock('../../profile/api', () => ({
  ...jest.requireActual('../../profile/api'),
  useMyProfile: () => ({ isPending: false, isError: false, data: { id: 'u1', discoverable: mockDiscoverable } }),
  useMyCv: () => ({ isPending: false, isError: false, data: { profile: { display_name: 'Ayşe Kaya' }, share_token: mockShareToken } }),
  useSetCvSharing: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
jest.mock('../../auth/SessionProvider', () => ({
  useSession: () => ({ userId: mockUser, session: mockUser ? { user: { email: 'ayse@example.com' } } : null }),
  useAccountState: () => mockAccountError
    ? { isPending: false, isError: true, error: { code: 'PT500', message: 'server_error' }, data: undefined, refetch: jest.fn() }
    : { isPending: false, isError: false, data: { is_minor: mockMinor, profile_complete: true, organization_roles: [] }, refetch: jest.fn() },
  accountStateKey: (id: string | null) => ['account-state', id],
}));
jest.mock('../../auth/authService', () => ({ signOut: () => mockSignOut(), deleteAccount: () => mockDelete() }));
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => ({ clear: jest.fn() }) }));
jest.mock('../../onboarding/PrefsProvider', () => ({ usePrefs: () => ({ prefs: { haptics: true }, ready: true, update: mockUpdatePrefs }) }));
jest.mock('../../../lib/haptics', () => ({ ...jest.requireActual('../../../lib/haptics'), setHapticsEnabledFromPrefs: (v: boolean) => mockHapticsFlag(v) }));
jest.mock('../../../lib/links', () => ({ ...jest.requireActual('../../../lib/links'), openExternalUrl: (...a: unknown[]) => mockOpen(...(a as [])) }));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

const navigate = jest.fn(); const popToTop = jest.fn();
const nav = { navigate, goBack: jest.fn(), popToTop, canGoBack: () => true, getParent: () => ({ navigate: jest.fn() }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = async (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}>{ui}</QueryClientProvider></SafeAreaProvider>);
};
const props = <T,>(name: string) => ({ navigation: nav, route: { key: 'k', name } }) as unknown as T;
const openSettings = () => wrap(<SettingsScreen {...props<React.ComponentProps<typeof SettingsScreen>>('Settings')} />);
const openNotif = () => wrap(<NotificationSettingsScreen {...props<React.ComponentProps<typeof NotificationSettingsScreen>>('NotificationSettings')} />);
const openPrivacy = () => wrap(<PrivacyScreen {...props<React.ComponentProps<typeof PrivacyScreen>>('Privacy')} />);

beforeEach(() => {
  mockUser = 'u1'; mockMinor = false; mockAccountError = false; mockReminders = true; mockPrefsFail = false; mockDiscoverable = false; mockShareToken = null;
  for (const m of [mockToast, mockUpdatePrefs, mockOpen, mockHapticsFlag, mockSignOut, mockDelete, mockSetReminders, mockSetDiscoverable, navigate, popToTop]) m.mockClear();
});

afterEach(async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); });

describe('Ayarlar', () => {
  it('shows every section: Hesap, Bildirimler, Dokunsal geri bildirim, Gizlilik, Rıza merkezi, Yardım, Yasal, Sürüm', async () => {
    await openSettings();
    for (const t of ['Hesap', 'Bildirimler', 'Gizlilik', 'Rıza merkezi', 'Yardım', 'Yasal']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: 'Dokunsal geri bildirim' })).toBeTruthy();
    expect(screen.getByText(/^Sürüm/)).toBeTruthy();
  });

  it('the e-mail is read-only text (no input) and sign-out calls the existing flow', async () => {
    await openSettings();
    expect(screen.getByText(/ayse@example\.com/)).toBeTruthy();
    expect(screen.queryByDisplayValue('ayse@example.com')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Çıkış yap' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });


  it('the haptics switch goes through PrefsProvider.update({ haptics }) and never touches the flag directly', async () => {
    await openSettings();
    const sw = screen.getByRole('switch', { name: 'Dokunsal geri bildirim' });
    expect(sw.props.value ?? sw.props.accessibilityState?.checked).toBe(true);
    fireEvent(sw, 'valueChange', false);
    expect(mockUpdatePrefs).toHaveBeenCalledWith({ haptics: false });
    expect(mockHapticsFlag).not.toHaveBeenCalled();
  });

  it.each([
    ['Bildirimler', 'NotificationSettings'], ['Gizlilik\\.', 'Privacy'], ['Rıza merkezi', 'ConsentCenter'],
  ])('the %s row opens %s', async (name, route) => {
    await openSettings();
    fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    expect(navigate).toHaveBeenCalledWith(route);
  });

  it.each([
    ['Destek', WEB_PATHS.support], ['Gizlilik politikası', WEB_PATHS.privacy], ['Kullanım koşulları', WEB_PATHS.terms], ['Hesap silme', WEB_PATHS.deleteAccount],
  ])('Yardım / Yasal: %s opens WEB_ORIGIN + %s', async (name, path) => {
    await openSettings();
    fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    expect(mockOpen.mock.calls.map((c) => (c as unknown[])[0])).toEqual([WEB_ORIGIN + path]);
  });

  it('the paths are the four web pages and the app holds no legal text', async () => {
    expect(WEB_PATHS).toEqual({ support: '/destek', privacy: '/gizlilik', terms: '/kosullar', deleteAccount: '/hesap-silme' });
    await openSettings();
    expect(screen.queryByText(/KVKK|aydınlatma metni|madde \d/i)).toBeNull();
  });

  it('a failed link toasts instead of failing silently', async () => {
    mockOpen.mockImplementationOnce(async (...a: unknown[]) => { (a[1] as () => void)(); });
    await openSettings();
    fireEvent.press(screen.getByRole('button', { name: /^Destek/ }));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Bağlantı açılamadı.', 'danger'));
  });

  it('after the session ends (sign-out / deletion) the screen leaves itself', async () => {
    mockUser = null;
    await openSettings();
    await waitFor(() => expect(popToTop).toHaveBeenCalled());
  });

  it('deleting the account asks first, then runs the existing deleteAccount flow', async () => {
    await openSettings();
    fireEvent.press(screen.getByRole('button', { name: 'Hesabımı sil' }));
    expect(mockDelete).not.toHaveBeenCalled();
    fireEvent.press(await screen.findByRole('button', { name: 'Evet, hesabımı sil' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
  });
});

describe('Bildirim ayarları', () => {
  it('reflects the server value and saves through set_notification_preferences', async () => {
    await openNotif();
    const sw = await screen.findByRole('switch', { name: 'Etkinlik hatırlatmaları' });
    fireEvent(sw, 'valueChange', false);
    await waitFor(() => expect(mockSetReminders).toHaveBeenCalledWith(false));
  });

  it('states what is not optional and the retention period as plain facts', async () => {
    await openNotif();
    await screen.findByRole('switch', { name: 'Etkinlik hatırlatmaları' });
    expect(screen.getByText(RETENTION_FACT)).toBeTruthy();
    expect(RETENTION_FACT).toBe('Bildirimler oluşturulmasından 90 gün sonra, okunmuşsa silinir.');
    expect(screen.getByText(/kayıt, başvuru ve veli onayı/i)).toBeTruthy();
  });

  it('a failed save shows the COPY message', async () => {
    mockPrefsFail = true;
    await openNotif();
    fireEvent(await screen.findByRole('switch', { name: 'Etkinlik hatırlatmaları' }), 'valueChange', false);
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Bildirim tercihin kaydedilemedi. Yeniden dener misin?', 'danger'));
  });
});

describe('Gizlilik', () => {
  it('an adult sees the discoverability switch and the plain-language helper about being named on team pages', async () => {
    await openPrivacy();
    const sw = await screen.findByRole('switch', { name: 'Profilimi keşfe aç' });
    expect(screen.getByText(DISCOVERABLE_HELP)).toBeTruthy();
    expect(DISCOVERABLE_HELP).toMatch(/kaptanı ya da mentoru olduğun takımların sayfasında herkese görünür/);
    fireEvent(sw, 'valueChange', true);
    await waitFor(() => expect(mockSetDiscoverable).toHaveBeenCalledWith('u1', true));
  });

  it('a minor gets no switch, only the text', async () => {
    mockMinor = true;
    await openPrivacy();
    expect(await screen.findByText(MINOR_DISCOVERABLE_TEXT)).toBeTruthy();
    expect(MINOR_DISCOVERABLE_TEXT).toBe('18 yaşını doldurduğunda açabilirsin.');
    expect(screen.queryByRole('switch', { name: 'Profilimi keşfe aç' })).toBeNull();
    expect(screen.queryByText(DISCOVERABLE_HELP)).toBeNull();
  });

  it('unknown minor status (account state failed) never shows the switch', async () => {
    mockAccountError = true;
    await openPrivacy();
    expect(screen.queryByRole('switch', { name: 'Profilimi keşfe aç' })).toBeNull();
  });

  it('the server rule discoverable_requires_adult shows its COPY message', async () => {
    mockSetDiscoverable.mockImplementationOnce(async () => { throw { code: 'PT403', message: 'discoverable_requires_adult' }; });
    await openPrivacy();
    fireEvent(await screen.findByRole('switch', { name: 'Profilimi keşfe aç' }), 'valueChange', true);
    expect(await screen.findByText('Profilini keşifte göstermek şimdilik 18 yaş ve üzeri için açık.')).toBeTruthy();
  });

  it('hosts the CV share card and links to the consent center', async () => {
    await openPrivacy();
    expect(await screen.findByText('Dijital CV bağlantın')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /^Rıza merkezi/ }));
    expect(navigate).toHaveBeenCalledWith('ConsentCenter');
    expect(within(screen.getByTestId('privacy-screen')).queryByText(/KVKK/)).toBeNull();
  });
});
