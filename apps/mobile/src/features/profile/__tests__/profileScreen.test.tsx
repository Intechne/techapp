import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProfileScreen, breakAfterHyphen } from '../ProfileScreen';
import { ProvenanceBadge } from '../ProvenanceBadge';

let mockFontScale = 1;
let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: mockFontScale }),
}));

const ME = 'u1';
const LONG = 'Ayşegül Nur Karaosmanoğlu-Çağlayan';
let mockUserId: string | null = ME;
let mockRegs: unknown[] = [];
let mockCv: Record<string, unknown> = {};
const baseCv = () => ({
  profile: { id: ME, display_name: 'Ayşe Kaya', headline: 'Robotik meraklısı', bio: null, city: 'İstanbul', education_stage: 'high_school', discoverable: false, skills: [] },
  interests: [], experiences: [], participations: [], volunteering: [], teams: [], share_token: null,
});
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: () => { const b: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'in', 'order', 'limit', 'overrideTypes']) b[m] = () => b; b.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r); return b; } }) }));
jest.mock('../../auth/SessionProvider', () => ({
  useSession: () => ({ userId: mockUserId, session: mockUserId ? { user: { email: 'ayse@example.com' } } : null }),
  useAccountState: () => ({ data: { organization_roles: [], profile_complete: true }, refetch: jest.fn() }),
}));
jest.mock('../../auth/pendingIntent', () => ({ usePendingIntent: () => ({ clear: jest.fn() }) }));
jest.mock('../../onboarding/PrefsProvider', () => ({ usePrefs: () => ({ update: jest.fn() }) }));
jest.mock('../../events/api', () => ({ ...jest.requireActual('../../events/api'), fetchMyRegistrations: async () => mockRegs }));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  useMyCv: () => ({ isPending: false, isError: false, isRefetching: false, refetch: jest.fn(), data: mockCv }),
}));

const navigate = jest.fn(); const parentNavigate = jest.fn(); const setParams = jest.fn(); const rootNavigate = jest.fn();
beforeEach(() => {
  mockUserId = ME; mockRegs = []; mockCv = baseCv(); mockFontScale = 1; mockWidth = 390;
  navigate.mockClear(); parentNavigate.mockClear(); setParams.mockClear(); rootNavigate.mockClear();
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const tree = (params?: { segment?: 'Deneyimler' | 'Katılımlar' | 'Takımlar' }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const props = {
    navigation: { navigate, setParams, getParent: () => ({ navigate: parentNavigate, getParent: () => ({ navigate: rootNavigate }) }) },
    route: { key: 'k', name: 'ProfileHome', params },
  } as unknown as React.ComponentProps<typeof ProfileScreen>;
  return <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ProfileScreen {...props} /></QueryClientProvider></SafeAreaProvider>;
};
const open = async (params?: Parameters<typeof tree>[0]) => { const r = await render(tree(params)); return r; };
const reg = (id: string, eventId: string, title: string, days: number, status = 'confirmed') =>
  ({ id, event_id: eventId, status, event: { id: eventId, title, starts_at: new Date(Date.now() + days * 86_400_000).toISOString(), ends_at: null, is_demo: false } });
const experience = (i: number, org: string | null = null, verified = false) => ({
  id: `x${i}`, kind: 'project', title: `Proje ${i}`, role: null, contribution: null, organization_name: org, link_url: null, started_on: '2026-01-01', ended_on: null,
  status: 'published', visibility: 'profile',
  attestation: verified ? { id: `a${i}`, status: 'verified', scope: null, source: null, decided_at: null, decision_note: null, valid_until: null, organization: org } : null,
});

describe('Profil üst kartı', () => {
  it('avatar and name are children of the same identity card (the avatar never leaves it)', async () => {
    await open();
    const card = screen.getByTestId('identity-card');
    expect(within(card).getByText('AK')).toBeTruthy();
    expect(within(card).getByText('Ayşe Kaya')).toBeTruthy();
    expect(within(card).getByText(/Robotik meraklısı/)).toBeTruthy();
  });

  it('e-mail is not on the identity card; it shows in the Hesap section as account context', async () => {
    await open();
    expect(within(screen.getByTestId('identity-card')).queryByText('ayse@example.com')).toBeNull();
    expect(within(screen.getByTestId('account-section')).getByText(/ayse@example\.com/)).toBeTruthy();
  });

  it('the edit action sits in the header bar, not in the identity card (the name gets the full width)', async () => {
    await open();
    const edit = screen.getByRole('button', { name: 'Profili düzenle' });
    expect(within(screen.getByTestId('identity-card')).queryByRole('button', { name: 'Profili düzenle' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Profili düzenle' })).toHaveLength(1);
    fireEvent.press(edit);
    expect(navigate).toHaveBeenCalledWith('EditProfile');
  });

  it('a long name is never upper-cased and breaks between words on Android', async () => {
    const OS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    try {
      (mockCv.profile as { display_name: string }).display_name = LONG;
      await open();
      const name = within(screen.getByTestId('identity-card')).getByLabelText(LONG);
      expect(name.props.textBreakStrategy).toBe('simple');
      expect(name.props.android_hyphenationFrequency).toBe('none');
    } finally { Object.defineProperty(Platform, 'OS', { value: OS, configurable: true }); }
  });

  it('does not show dead entries for modules that do not exist yet (Kaydedilenler, Bildirimler, Ayarlar)', async () => {
    await open();
    for (const name of [/Kaydedilenler/, /Bildirimler/, /Ayarlar/]) expect(screen.queryByText(name)).toBeNull();
  });
});

describe('breakAfterHyphen', () => {
  it('adds a break point after a hyphen between letters, nothing else', () => {
    expect(breakAfterHyphen(LONG)).toBe('Ayşegül Nur Karaosmanoğlu-\u200BÇağlayan');
    expect(breakAfterHyphen('Ayşe Kaya')).toBe('Ayşe Kaya');
    expect(breakAfterHyphen('A - B 5-3')).toBe('A - B 5-3');
  });
  it('the spoken name stays the plain name (no invisible characters)', async () => {
    (mockCv.profile as { display_name: string }).display_name = LONG;
    await open();
    const name = within(screen.getByTestId('identity-card')).getByLabelText(LONG);
    expect(name.props.accessibilityLabel).toBe(LONG);
    expect(name.props.accessibilityLabel).not.toContain('\u200B');
    // The drawn text carries the break point after the hyphen (raw string: the default normalizer would hide it).
    expect(within(screen.getByTestId('identity-card')).getByText('Ayşegül Nur Karaosmanoğlu-\u200BÇağlayan', { normalizer: (t) => t })).toBe(name);
  });
});

describe('Sayaçlar', () => {
  const dir = () => StyleSheet.flatten(screen.getByTestId('counters').props.style).flexDirection;
  it('sit side by side at normal text size', async () => { await open(); expect(dir()).toBe('row'); });
  it('stack vertically from font scale 1.5', async () => {
    mockFontScale = 1.5;
    await open();
    expect(dir()).toBe('column');
  });
  it('show zero counts and the spoken summary uses formatCount wording', async () => {
    await open();
    expect(screen.getByTestId('counters').props.accessibilityLabel).toBe('0 deneyim, 0 doğrulanmış, 0 katılım');
  });
  it('12 experiences: counters and the list both render', async () => {
    mockCv.experiences = Array.from({ length: 12 }, (_, i) => experience(i, 'Orbit Robotik', i < 4));
    await open();
    expect(screen.getByTestId('counters').props.accessibilityLabel).toBe('12 deneyim, 4 doğrulanmış, 0 katılım');
    expect(screen.getByText('Proje 11')).toBeTruthy();
  });
});

describe('Yaklaşan', () => {
  it('lists at most three of the user’s own registrations and links to all of them', async () => {
    mockRegs = [reg('r1', 'e1', 'Etkinlik Bir', 1), reg('r2', 'e2', 'Etkinlik İki', 2), reg('r3', 'e3', 'Etkinlik Üç', 3), reg('r4', 'e4', 'Etkinlik Dört', 4)];
    await open();
    expect(await screen.findByText('Etkinlik Bir')).toBeTruthy();
    expect(screen.getByText('Etkinlik Üç')).toBeTruthy();
    expect(screen.queryByText('Etkinlik Dört')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /Tümünü gör/ }));
    expect(navigate).toHaveBeenCalledWith('MyRegistrations');
  });

  it('a checked-in registration reads "GİRİŞ YAPILDI", not "KATILIMIN ONAYLANDI"', async () => {
    mockRegs = [reg('r1', 'e1', 'Etkinlik Bir', 1)];
    mockCv.participations = [{ event_id: 'e1', title: 'Etkinlik Bir', type: 'workshop', starts_at: '2026-12-01T10:00:00Z', organizer: null, checked_in_at: '2026-11-13T10:00:00Z' }];
    await open();
    expect(await screen.findByText('GİRİŞ YAPILDI')).toBeTruthy();
    expect(screen.queryByText('KATILIMIN ONAYLANDI')).toBeNull();
  });

  it('a row opens its registration status', async () => {
    mockRegs = [reg('r1', 'e1', 'Etkinlik Bir', 1)];
    await open();
    fireEvent.press(await screen.findByRole('button', { name: /Etkinlik Bir/ }));
    expect(navigate).toHaveBeenCalledWith('RegistrationStatus', { registrationId: 'r1' });
  });
});

describe('Segmentler', () => {
  const dir = () => StyleSheet.flatten(screen.getByTestId('segmented').props.style).flexDirection;
  it('sit side by side at normal text size and stack in one column from font scale 1.5', async () => {
    await open();
    expect(dir()).toBe('row');
    await screen.unmount();
    mockFontScale = 2;
    await open();
    expect(dir()).toBe('column');
  });
});

describe('Deneyimler', () => {
  it('empty: the empty state carries the add action; the list has none of its own then', async () => {
    await open();
    expect(screen.getAllByRole('button', { name: /Deneyim ekle/ })).toHaveLength(1);
  });
  it('filled: "Deneyim ekle" sits under the list', async () => {
    mockCv.experiences = [experience(1)];
    await open();
    fireEvent.press(screen.getByRole('button', { name: /Deneyim ekle/ }));
    expect(navigate).toHaveBeenCalledWith('ExperienceEditor', {});
  });
});

describe('segment parametresi (Topluluk > Tüm takımların)', () => {
  it('is applied and then cleared, so the same request can be made again', async () => {
    await open({ segment: 'Takımlar' });
    expect(await screen.findByText('Henüz bir takımda değilsin')).toBeTruthy();
    expect(setParams).toHaveBeenCalledWith({ segment: undefined });
  });

  it('a second request after a manual segment switch selects Takımlar again', async () => {
    const r = await open({ segment: 'Takımlar' });
    expect(await screen.findByText('Henüz bir takımda değilsin')).toBeTruthy();
    // params cleared by the screen
    await act(async () => { r.rerender(tree(undefined)); });
    await fireEvent.press(screen.getByText('Deneyimler'));
    expect(screen.queryByText('Henüz bir takımda değilsin')).toBeNull();
    await act(async () => { r.rerender(tree({ segment: 'Takımlar' })); });
    expect(await screen.findByText('Henüz bir takımda değilsin')).toBeTruthy();
  });
});

describe('Misafir profili', () => {
  beforeEach(() => { mockUserId = null; });
  it('shows the three benefits and exactly one primary action', async () => {
    await open();
    expect(screen.getByText('Yaptıkların seni anlatsın.')).toBeTruthy();
    for (const t of ['Etkinliklere katıl', 'Deneyimlerini doğrulat', 'Profilini paylaş']) expect(screen.getByText(t)).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.press(buttons[0]!);
    expect(rootNavigate).toHaveBeenCalledWith('AuthEmail');
  });
  it('has no dead entries and no e-mail', async () => {
    await open();
    for (const name of [/Kaydedilenler/, /Bildirimler/, /Ayarlar/, /@/]) expect(screen.queryByText(name)).toBeNull();
  });
});

describe('ProvenanceBadge', () => {
  const att = (status: string, org: string | null) => ({ id: 'a', status, scope: null, source: null, decided_at: null, decision_note: null, valid_until: null, organization: org }) as never;
  it('keeps the organisation name as written; only the category label is upper-case', async () => {
    await render(<ProvenanceBadge attestation={att('verified', 'Yıldız Teknik Üniversitesi')} />);
    expect(screen.getByText(/^DOĞRULANDI · Yıldız Teknik Üniversitesi$/)).toBeTruthy();
  });
  it('self-declared stays distinct and shows no organisation', async () => {
    await render(<ProvenanceBadge attestation={null} />);
    expect(screen.getByText('KENDİ BEYANI')).toBeTruthy();
  });
  it('a requested attestation never looks verified', async () => {
    await render(<ProvenanceBadge attestation={att('requested', 'Orbit Robotik')} />);
    expect(screen.queryByText(/DOĞRULANDI/)).toBeNull();
    expect(screen.queryByText(/Orbit/)).toBeNull();
  });
});
