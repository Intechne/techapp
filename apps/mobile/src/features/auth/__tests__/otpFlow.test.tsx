import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthEmailScreen } from '../AuthEmailScreen';
import { AuthOtpScreen } from '../AuthOtpScreen';
import { otpFlow } from '../otpFlow';

const mockSignInWithOtp = jest.fn(async (..._a: unknown[]) => ({ error: null as unknown }));
const mockVerifyOtp = jest.fn(async (..._a: unknown[]): Promise<{ data: unknown; error: unknown }> => ({ data: { session: { user: { id: 'u1' } } }, error: null }));
const mockRpc = jest.fn(async (..._a: unknown[]) => ({ data: { user_id: 'u1', profile_complete: true }, error: null as unknown }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({ auth: { signInWithOtp: mockSignInWithOtp, verifyOtp: mockVerifyOtp }, rpc: mockRpc }),
}));
jest.mock('../SessionProvider', () => ({
  accountStateKey: (id: string) => ['account-state', id],
  useSession: () => ({ userId: null }),
  useAccountState: () => ({ data: undefined }),
}));
const mockOpenExternalUrl = jest.fn();
jest.mock('../../../lib/links', () => ({ openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args) }));
jest.mock('../../../lib/database.types', () => ({ accountStateSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) } }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}>{ui}</QueryClientProvider>
  </SafeAreaProvider>
);
const nav = () => ({ navigate: jest.fn(), replace: jest.fn(), popTo: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) });
const asProps = (n: ReturnType<typeof nav>): { navigation: never; route: never } => ({ navigation: n, route: { key: 'k', name: 'AuthOtp' } }) as never;

beforeEach(() => { jest.clearAllMocks(); otpFlow.clear(); });

describe('otpFlow memory', () => {
  it('holds the normalised e-mail until cleared', () => {
    expect(otpFlow.email()).toBeNull();
    otpFlow.begin('  Ada@Example.com ');
    expect(otpFlow.email()).toBe('ada@example.com');
    otpFlow.clear();
    expect(otpFlow.email()).toBeNull();
  });
});

describe('AuthEmailScreen', () => {
  it('navigates to AuthOtp without params and remembers the e-mail in memory only', async () => {
    const n = nav();
    await render(wrap(<AuthEmailScreen {...asProps(n)} />));
    await fireEvent.changeText(screen.getByPlaceholderText('ornek@eposta.com'), 'ada@example.com');
    await fireEvent.press(screen.getByText('Kodu gönder'));
    await act(async () => {});
    expect(n.navigate).toHaveBeenCalledWith('AuthOtp');
    expect(otpFlow.email()).toBe('ada@example.com');
  });
});

describe('AuthEmailScreen · closed sign-up (Before User Created hook)', () => {
  it('a new address refused by the hook → the "not open yet" sentence + "Bize yaz", and no navigation to the code screen', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: { name: 'AuthApiError', status: 403, code: 'hook_rejected',
      message: 'Kayıtlar henüz açık değil. Pilot ekibindeysen bize yaz: techapp.intechne.com.tr/destek' } });
    const n = nav();
    await render(wrap(<AuthEmailScreen {...asProps(n)} />));
    await fireEvent.changeText(screen.getByPlaceholderText('ornek@eposta.com'), 'yeni@example.com');
    await fireEvent.press(screen.getByText('Kodu gönder'));
    await act(async () => {});
    expect(screen.getByText('Kayıtlar henüz açık değil. Pilot ekibindeysen bize yaz: techapp.intechne.com.tr/destek')).toBeTruthy();
    expect(n.navigate).not.toHaveBeenCalled();
    expect(otpFlow.email()).toBeNull();
    await fireEvent.press(screen.getByText('Bize yaz'));
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://techapp.intechne.com.tr/destek', expect.any(Function));
  });
});

describe('AuthOtpScreen', () => {
  it('goes back to AuthEmail and never verifies when there is no e-mail in memory', async () => {
    const n = nav();
    await render(wrap(<AuthOtpScreen {...asProps(n)} />));
    expect(n.replace).toHaveBeenCalledWith('AuthEmail');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it('verifies exactly once when a 6-digit code is pasted, and clears the e-mail on success', async () => {
    otpFlow.begin('ada@example.com');
    const n = nav();
    await render(wrap(<AuthOtpScreen {...asProps(n)} />));
    const field = screen.getByLabelText('Doğrulama kodu');
    await fireEvent.changeText(field, '123456');
    await fireEvent.changeText(field, '123456');
    await act(async () => {});
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'ada@example.com', token: '123456', type: 'email' });
    expect(n.popTo).toHaveBeenCalledWith('Main');
    expect(otpFlow.email()).toBeNull();
    expect(n.replace).not.toHaveBeenCalled();
  });

  it('a wrong code shows the honest copy but keeps the resend cooldown until the countdown ends', async () => {
    jest.useFakeTimers();
    // Focus-after-interactions is not what this test is about and its scheduler does not survive the fake/real clock swap.
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    try {
      otpFlow.begin('ada@example.com');
      // Supabase answers otp_expired for a wrong code too.
      mockVerifyOtp.mockResolvedValueOnce({ data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid', status: 403 } });
      const n = nav();
      await render(wrap(<AuthOtpScreen {...asProps(n)} />));
      await fireEvent.changeText(screen.getByLabelText('Doğrulama kodu'), '123456');
      await act(async () => { await jest.advanceTimersByTimeAsync(10); }); // TanStack notifies via setTimeout(0)
      expect(screen.getByText('Kod hatalı ya da süresi dolmuş. Kontrol edip tekrar dene ya da yeni kod iste.')).toBeTruthy();
      const cooling = screen.getByRole('button', { name: /^Yeni kod iste \(\d+ sn\)$/ });
      expect(cooling.props.accessibilityState?.disabled).toBe(true);
      await fireEvent.press(cooling);
      expect(mockSignInWithOtp).not.toHaveBeenCalled();
      for (let i = 0; i < 60; i += 1) await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
      const resend = screen.getByRole('button', { name: 'Yeni kod iste' });
      expect(resend.props.accessibilityState?.disabled ?? false).toBe(false);
      expect(otpFlow.email()).toBe('ada@example.com');
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears the e-mail from memory when the screen unmounts without success', async () => {
    otpFlow.begin('ada@example.com');
    await render(wrap(<AuthOtpScreen {...asProps(nav())} />));
    expect(otpFlow.email()).toBe('ada@example.com');
    await screen.unmount();
    expect(otpFlow.email()).toBeNull();
  });
});
