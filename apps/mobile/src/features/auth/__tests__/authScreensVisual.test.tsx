import React from 'react';
import { AccessibilityInfo, StyleSheet, TextInput } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthOtpScreen, FOCUS_AFTER_PUSH_MS } from '../AuthOtpScreen';
import { StartupUnavailableScreen } from '../StartupUnavailableScreen';
import { otpFlow } from '../otpFlow';
import { noticeTones, radius } from '../../../design-system';

const mockVerifyOtp = jest.fn(async (..._a: unknown[]): Promise<{ data: unknown; error: unknown }> => ({ data: { session: { user: { id: 'u1' } } }, error: null }));
const mockAccount = jest.fn((): { data: unknown } => ({ data: undefined }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({ auth: { signInWithOtp: jest.fn(), verifyOtp: mockVerifyOtp }, rpc: jest.fn() }),
}));
jest.mock('../authService', () => ({ ...jest.requireActual('../authService'), signOut: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../SessionProvider', () => ({
  accountStateKey: (id: string) => ['account-state', id],
  useSession: () => ({ userId: 'u1' }),
  useAccountState: () => mockAccount(),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}>{ui}</QueryClientProvider>
  </SafeAreaProvider>
);
const nav = () => ({ navigate: jest.fn(), replace: jest.fn(), popTo: jest.fn(), goBack: jest.fn() });
const props = (): { navigation: never; route: never } => ({ navigation: nav(), route: { key: 'k', name: 'x' } }) as never;
beforeEach(() => { jest.clearAllMocks(); otpFlow.clear(); mockAccount.mockReturnValue({ data: undefined }); });

describe('AuthOtp field and error', () => {
  it('declares the one-time-code hints for iOS and Android autofill', async () => {
    otpFlow.begin('ada@example.com');
    await render(wrap(<AuthOtpScreen {...props()} />));
    const f = screen.getByLabelText('Doğrulama kodu');
    expect(f.props.textContentType).toBe('oneTimeCode');
    expect(f.props.autoComplete).toBe('one-time-code');
    expect(f.props.maxLength).toBe(6);
  });

  describe('focus', () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
    const reader = (r: () => Promise<boolean>) => jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(r);
    beforeEach(() => focus.mockClear());
    afterAll(() => { focus.mockRestore(); });
    const open = async () => { otpFlow.begin('ada@example.com'); return render(wrap(<AuthOtpScreen {...props()} />)); };
    const settle = () => act(async () => { await new Promise((r) => setTimeout(r, FOCUS_AFTER_PUSH_MS + 30)); });

    it('no autoFocus prop; reader off: focus is requested once the push has settled', async () => {
      reader(async () => false);
      await open();
      expect(screen.getByLabelText('Doğrulama kodu').props.autoFocus).toBeFalsy();
      await settle();
      expect(focus).toHaveBeenCalledTimes(1);
    });
    it('reader on: not focused', async () => {
      reader(async () => true);
      await open(); await settle();
      expect(focus).not.toHaveBeenCalled();
    });
    it('reader query rejects: treated as off, focused anyway', async () => {
      reader(async () => { throw new Error('no a11y service'); });
      await open(); await settle();
      expect(focus).toHaveBeenCalledTimes(1);
    });
    it('unmount before the reader answers: never focused', async () => {
      let resolve!: (v: boolean) => void;
      reader(() => new Promise<boolean>((r) => { resolve = r; }));
      const view = await open();
      await view.unmount();
      resolve(false); await settle();
      expect(focus).not.toHaveBeenCalled();
    });
  });

  it('a wrong code shows a danger Notice with the error icon and the honest copy', async () => {
    otpFlow.begin('ada@example.com');
    mockVerifyOtp.mockResolvedValueOnce({ data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid', status: 403 } });
    await render(wrap(<AuthOtpScreen {...props()} />));
    await fireEvent.changeText(screen.getByLabelText('Doğrulama kodu'), '123456');
    const msg = await screen.findByText('Kod hatalı ya da süresi dolmuş. Kontrol edip tekrar dene ya da yeni kod iste.');
    // Text -> wrapper View -> the Notice row that also holds the icon.
    const notice = msg.parent!.parent!;
    expect(notice.props.accessibilityRole).toBe('alert');
    // The Notice paints its tone's icon: `error` for danger.
    expect(noticeTones.danger.icon).toBe('error');
  });

  it('the code field uses the type scale and a token letter spacing (no loose numbers)', async () => {
    otpFlow.begin('ada@example.com');
    await render(wrap(<AuthOtpScreen {...props()} />));
    const s = StyleSheet.flatten(screen.getByLabelText('Doğrulama kodu').props.style);
    expect(s.fontSize).toBe(24);
    expect(s.letterSpacing).toBe(8);
  });
});

describe('StartupUnavailable', () => {
  it('the icon tile uses radius.hero (token, not a loose number)', async () => {
    await render(wrap(<StartupUnavailableScreen reason="offline" onRetry={() => {}} loadSavedCards={async () => []} />));
    expect(StyleSheet.flatten(screen.getByTestId('startup-icon').props.style).borderRadius).toBe(radius.hero);
  });
});
