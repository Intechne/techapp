import React from 'react';
import { AccessibilityInfo, TextInput } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CheckInScreen } from '../CheckInScreen';
import { makeError } from '../../../lib/errors';

const mockRpc = jest.fn();
let mockEvents: { id: string; title: string; starts_at: string; ends_at: string }[] = [];
const mockFrom = jest.fn();
jest.mock('../../../lib/supabase', () => {
  // Chainable stand-in for from('events').select().in().eq().gte().lte().order().limit()
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'in', 'eq', 'gte', 'lte', 'order']) b[m] = (...a: unknown[]) => { mockFrom(m, ...a); return b; };
    b.limit = () => (mockEventsPending ? new Promise(() => {}) : Promise.resolve({ data: mockEvents, error: null }));
    return b;
  };
  return { getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a), from: (t: string) => { mockFrom('from', t); return builder(); } }) };
});
const ACCOUNT_OK = { isPending: false, isSuccess: true, isError: false, error: null, data: { organization_roles: [{ organization_id: 'org1', role: 'checkin_staff' }, { organization_id: 'org2', role: 'editor' }] } };
let mockAccount: Record<string, unknown> = ACCOUNT_OK;
const mockAccountRefetch = jest.fn();
let mockEventsPending = false;
jest.mock('../../auth/SessionProvider', () => ({ useAccountState: () => ({ ...mockAccount, refetch: mockAccountRefetch }) }));
const EVENT_A = { id: 'evA', title: 'Robot Ligi Finali', starts_at: '2026-12-01T07:00:00Z', ends_at: '2026-12-01T15:00:00Z' };
const EVENT_B = { id: 'evB', title: 'Atölye Günü', starts_at: '2026-12-01T09:00:00Z', ends_at: '2026-12-01T12:00:00Z' };
jest.mock('../../../lib/haptics', () => ({ haptics: { success: jest.fn(), warning: jest.fn(), error: jest.fn(), selection: jest.fn() } }));
const mockHaptics = jest.requireMock('../../../lib/haptics').haptics as Record<'success' | 'warning' | 'error' | 'selection', jest.Mock>;
let mockGranted = true;
let mockScan: ((e: { data: string }) => void) | undefined;
jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [{ granted: mockGranted }, jest.fn()],
    CameraView: (p: { onBarcodeScanned?: (e: { data: string }) => void }) => { mockScan = p.onBarcodeScanned; return <View testID="camera" />; },
  };
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const clients: QueryClient[] = [];
afterEach(() => { clients.splice(0).forEach((c) => c.clear()); });
const renderScreen = async () => {
  // gcTime Infinity: no 5-minute GC timers are scheduled when the screen unmounts, so the jest worker can exit.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const props = { navigation: { goBack: jest.fn() }, route: { params: undefined } } as unknown as React.ComponentProps<typeof CheckInScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><CheckInScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
  // let the event-picker query settle so later updates happen inside act()
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
const ok = (result: 'checked_in' | 'already_checked_in') => ({ data: { result, registration_id: 'r1', checked_in_at: '2026-12-01T07:30:00Z', holder_name: 'Ada Yılmaz' }, error: null });

let announce: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks(); mockGranted = true; mockScan = undefined; mockEvents = [EVENT_A]; mockAccount = ACCOUNT_OK; mockEventsPending = false;
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
const PLACEHOLDER = 'ör. 0B8E1BD1';
const typeAndSubmit = async (code: string) => {
  await fireEvent.changeText(screen.getByPlaceholderText('ör. 0B8E1BD1'), code);
  await fireEvent.press(screen.getByText('Kodu doğrula'));
};

describe('check-in feedback', () => {
  it('checked_in: one success haptic, spoken announcement with name, icon + title', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    expect(await screen.findByText('GİRİŞ ONAYLANDI')).toBeTruthy();
    expect(mockHaptics.success).toHaveBeenCalledTimes(1);
    expect(mockHaptics.warning).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('Giriş onaylandı, Ada Yılmaz');
    expect(screen.getByTestId('checkin-result-icon-check')).toBeTruthy();
    expect(screen.getByText('Ada Yılmaz')).toBeTruthy();
  });

  it('same code again: warning, never success; announcement carries the first check-in time', async () => {
    mockRpc.mockResolvedValueOnce(ok('checked_in')).mockResolvedValueOnce(ok('already_checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    await screen.findByText('GİRİŞ ONAYLANDI');
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    await typeAndSubmit('TA1.abc');
    expect(await screen.findByText('DAHA ÖNCE GİRİŞ YAPILMIŞ')).toBeTruthy();
    expect(mockHaptics.success).toHaveBeenCalledTimes(1);
    expect(mockHaptics.warning).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith(expect.stringMatching(/^Daha önce giriş yapılmış, ilk giriş \d{2}:\d{2}$/));
    expect(screen.getByTestId('checkin-result-icon-clock')).toBeTruthy();
  });

  it('error: error haptic + announcement with the error copy + close icon', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PT403', message: 'outside_checkin_window' } });
    await renderScreen();
    await typeAndSubmit('bad');
    expect(await screen.findByText('GİRİŞ ONAYLANMADI')).toBeTruthy();
    expect(mockHaptics.error).toHaveBeenCalledTimes(1);
    expect(mockHaptics.success).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Giriş onaylanmadı, .+/));
    expect(screen.getByTestId('checkin-result-icon-close')).toBeTruthy();
  });

  it('a re-render after the result does not repeat haptics or announcement', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    await screen.findByText('GİRİŞ ONAYLANDI');
    await act(async () => { await Promise.resolve(); });
    expect(mockHaptics.success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('camera firing the same code repeatedly yields one mutation until "Sıradaki katılımcı"', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    const scan = mockScan!;
    await act(async () => { scan({ data: 'QR1' }); scan({ data: 'QR1' }); scan({ data: 'QR1' }); });
    await screen.findByText('GİRİŞ ONAYLANDI');
    await act(async () => { scan({ data: 'QR1' }); scan({ data: 'QR2' }); });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockHaptics.success).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    expect(screen.getByTestId('camera')).toBeTruthy();
    await act(async () => { mockScan!({ data: 'QR2' }); });
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
  });

  it('without camera permission the manual field is visible alongside the permission button', async () => {
    mockGranted = false;
    await renderScreen();
    expect(screen.getByText('Kameraya izin ver')).toBeTruthy();
    expect(screen.getByPlaceholderText('ör. 0B8E1BD1')).toBeTruthy();
  });

  it('feedback throwing never changes the displayed outcome', async () => {
    mockHaptics.success.mockImplementationOnce(() => { throw new Error('haptic boom'); });
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    expect(await screen.findByText('GİRİŞ ONAYLANDI')).toBeTruthy();
    expect(screen.queryByText('GİRİŞ ONAYLANMADI')).toBeNull();
    announce.mockImplementationOnce(() => { throw new Error('a11y boom'); });
    mockHaptics.error.mockImplementationOnce(() => { throw new Error('haptic boom'); });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PT403', message: 'outside_checkin_window' } });
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    await typeAndSubmit('bad');
    expect(await screen.findByText('GİRİŞ ONAYLANMADI')).toBeTruthy();
  });

  it.each([[true, 0], [false, 1]])('after "Sıradaki katılımcı" (camera granted=%s) manual field focus calls: %s', async (granted, calls) => {
    mockGranted = granted as boolean;
    const focus = jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(() => {});
    const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 1; });
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    await screen.findByText('GİRİŞ ONAYLANDI');
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(focus).toHaveBeenCalledTimes(calls as number);
    focus.mockRestore(); raf.mockRestore();
  });

  it('maps network failures through the error contract (no success screen)', async () => {
    mockRpc.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    expect(await screen.findByText('GİRİŞ ONAYLANMADI')).toBeTruthy();
    expect(screen.queryByText('GİRİŞ ONAYLANDI')).toBeNull();
  });
});

describe('manual check-in by short code (D1)', () => {
  const verify = () => screen.getByRole('button', { name: 'Kodu doğrula' });

  it('preselects the only qualifying event and sends the normalised short code to check_in_by_short_code', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    expect(await screen.findByText('Robot Ligi Finali')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Robot Ligi Finali/ }).props.accessibilityState).toMatchObject({ checked: true });
    // only organisations with a check-in role are queried
    expect(mockFrom).toHaveBeenCalledWith('in', 'organization_id', ['org1']);
    expect(mockFrom).toHaveBeenCalledWith('eq', 'status', 'published');
    await typeAndSubmit(' 0b8e-1bd1 ');
    expect(await screen.findByText('GİRİŞ ONAYLANDI')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('check_in_by_short_code', { p_event_id: 'evA', p_short_code: '0B8E1BD1' });
  });

  it('a full TA1 token still uses check_in_participant, bound to the selected event', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    await typeAndSubmit('TA1.11111111-2222-3333-4444-555555555555.abcdef');
    await screen.findByText('GİRİŞ ONAYLANDI');
    expect(mockRpc).toHaveBeenCalledWith('check_in_participant', { p_token: 'TA1.11111111-2222-3333-4444-555555555555.abcdef', p_expected_event_id: 'evA' });
  });

  it('a camera scan passes the selected event so a QR from another event is flagged', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'ticket_wrong_event' } });
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    await act(async () => { mockScan!({ data: 'TA1.x.y' }); });
    expect(await screen.findByText('Bu kart başka bir etkinliğe ait.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('check_in_participant', { p_token: 'TA1.x.y', p_expected_event_id: 'evA' });
  });

  it('with several events nothing is preselected: a short code waits for a choice, a full token does not', async () => {
    mockEvents = [EVENT_A, EVENT_B];
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await screen.findByText('Atölye Günü');
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '0B8E1BD1');
    expect(verify().props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Önce etkinliği seç.')).toBeTruthy();
    await fireEvent.press(verify());
    expect(mockRpc).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), 'TA1.abc');
    expect(verify().props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByText('Önce etkinliği seç.')).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '0B8E1BD1');
    await fireEvent.press(screen.getByRole('radio', { name: /Atölye Günü/ }));
    expect(verify().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(verify());
    await screen.findByText('GİRİŞ ONAYLANDI');
    expect(mockRpc).toHaveBeenCalledWith('check_in_by_short_code', { p_event_id: 'evB', p_short_code: '0B8E1BD1' });
    // the choice survives "Sıradaki katılımcı"
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    expect(screen.getByRole('radio', { name: /Atölye Günü/ }).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('no qualifying event: explains it and keeps the short-code button disabled', async () => {
    mockEvents = [];
    await renderScreen();
    expect(await screen.findByText('Bugün giriş kontrolü açılan bir etkinlik yok')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '0B8E1BD1');
    expect(verify().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('429 after too many wrong codes: the throttle copy and one error haptic', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PT429', message: 'short_code_rate_limited' } });
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    await typeAndSubmit('00000000');
    expect(await screen.findByText("Çok fazla hatalı deneme. Birkaç dakika sonra tekrar dene ya da QR'ı okut.")).toBeTruthy();
    expect(screen.getByText('GİRİŞ ONAYLANMADI')).toBeTruthy();
    expect(mockHaptics.error).toHaveBeenCalledTimes(1);
    expect(mockHaptics.success).not.toHaveBeenCalled();
  });

  it('404 from the short-code lookup (custom status body) maps to ticket_unknown copy', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PT404', message: 'ticket_unknown', details: '', hint: null } });
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    await typeAndSubmit('ABCDEF12');
    expect(await screen.findByText('Bu kodla eşleşen bir kayıt yok.')).toBeTruthy();
  });

  it('account state failing: the picker shows an error with retry, never an endless skeleton; QR and full tokens still work', async () => {
    mockAccount = { isPending: false, isSuccess: false, isError: true, error: makeError('network_unreachable', 0), data: undefined };
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    expect(screen.getByText('Bağlantı yok gibi görünüyor')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tekrar dene'));
    expect(mockAccountRefetch).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalledWith('from', 'events');
    // a short code needs an event; a full token does not
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '0B8E1BD1');
    expect(verify().props.accessibilityState).toMatchObject({ disabled: true });
    await typeAndSubmit('TA1.abc');
    await screen.findByText('GİRİŞ ONAYLANDI');
    expect(mockRpc).toHaveBeenCalledWith('check_in_participant', { p_token: 'TA1.abc' });
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    await act(async () => { mockScan!({ data: 'TA1.qr' }); });
    await waitFor(() => expect(mockRpc).toHaveBeenLastCalledWith('check_in_participant', { p_token: 'TA1.qr' }));
  });

  it('while the events are loading the "Önce etkinliği seç." hint is not shown (the button stays disabled)', async () => {
    mockEventsPending = true;
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER), '0B8E1BD1');
    expect(screen.queryByText('Önce etkinliği seç.')).toBeNull();
    expect(verify().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('the TA1. prefix is recognised in any case and the token is sent trimmed but never re-cased; short codes are upper-cased', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    await typeAndSubmit('  ta1.11111111-2222-3333-4444-555555555555.abcdef  ');
    await screen.findByText('GİRİŞ ONAYLANDI');
    expect(mockRpc).toHaveBeenLastCalledWith('check_in_participant', { p_token: 'ta1.11111111-2222-3333-4444-555555555555.abcdef', p_expected_event_id: 'evA' });
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    await typeAndSubmit('Ta1.Mixed.Case');
    await waitFor(() => expect(mockRpc).toHaveBeenLastCalledWith('check_in_participant', { p_token: 'Ta1.Mixed.Case', p_expected_event_id: 'evA' }));
    await fireEvent.press(screen.getByText('Sıradaki katılımcı'));
    await typeAndSubmit('ab12 cd34');
    await waitFor(() => expect(mockRpc).toHaveBeenLastCalledWith('check_in_by_short_code', { p_event_id: 'evA', p_short_code: 'AB12CD34' }));
  });

  it('405 method_not_allowed has its own copy', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PT405', message: 'method_not_allowed' } });
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    await typeAndSubmit('ABCDEF12');
    expect(await screen.findByText('Bu istek bu şekilde yapılamıyor. Uygulamayı güncelleyip tekrar dener misin?')).toBeTruthy();
  });

  it('manual field does not force upper case (full tokens are case-sensitive); a typed lowercase short code is normalised in code', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await screen.findByText('Robot Ligi Finali');
    expect(screen.getByPlaceholderText('ör. 0B8E1BD1').props.autoCapitalize).toBe('none');
    await typeAndSubmit('ab12cd34');
    await waitFor(() => expect(mockRpc).toHaveBeenLastCalledWith('check_in_by_short_code', { p_event_id: 'evA', p_short_code: 'AB12CD34' }));
  });
});

describe('check-in visual contract (Faz 4)', () => {
  it('the result glyph sits in a round badge (24 px glyph, 40 px badge), the title is not a display headline', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    const badge = await screen.findByTestId('checkin-result-badge');
    const { StyleSheet } = jest.requireActual('react-native');
    const s = StyleSheet.flatten(badge.props.style);
    expect([s.width, s.height, s.borderRadius]).toEqual([40, 40, 20]);
    expect(screen.getByTestId('checkin-result-icon-check')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('GİRİŞ ONAYLANDI').props.style).fontSize).toBe(24);
  });
  it('with the camera allowed, the short-code field is still visible', async () => {
    await renderScreen();
    expect(screen.getByTestId('camera')).toBeTruthy();
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeTruthy();
  });

  it('the result block is announced once: announceForAccessibility only, no live region or alert role on the block', async () => {
    mockRpc.mockResolvedValue(ok('checked_in'));
    await renderScreen();
    await typeAndSubmit('TA1.abc');
    const badge = await screen.findByTestId('checkin-result-badge');
    const block = badge.parent!;
    expect(announce).toHaveBeenCalledTimes(1);
    expect(block.props.accessibilityLiveRegion).toBeUndefined();
    expect(block.props.accessibilityRole).toBeUndefined();
  });

  it('a failed check-in is also announced once (no alert role on top of announceForAccessibility)', async () => {
    mockRpc.mockRejectedValue(makeError('network_unreachable', 0));
    await renderScreen();
    await typeAndSubmit('TA1.bad');
    const badge = await screen.findByTestId('checkin-result-badge');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(badge.parent!.props.accessibilityRole).toBeUndefined();
    expect(mockHaptics.error).toHaveBeenCalledTimes(1);
  });
});
