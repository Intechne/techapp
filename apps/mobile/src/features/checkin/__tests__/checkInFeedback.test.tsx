import React from 'react';
import { AccessibilityInfo, TextInput } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CheckInScreen } from '../CheckInScreen';
import { makeError } from '../../../lib/errors';

const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
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
const renderScreen = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const props = { navigation: { goBack: jest.fn() }, route: { params: undefined } } as unknown as React.ComponentProps<typeof CheckInScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><CheckInScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
const ok = (result: 'checked_in' | 'already_checked_in') => ({ data: { result, registration_id: 'r1', checked_in_at: '2026-12-01T07:30:00Z', holder_name: 'Ada Yılmaz' }, error: null });

let announce: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks(); mockGranted = true; mockScan = undefined;
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
const typeAndSubmit = async (code: string) => {
  await fireEvent.changeText(screen.getByPlaceholderText('TA1.…'), code);
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
    expect(screen.getByPlaceholderText('TA1.…')).toBeTruthy();
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
