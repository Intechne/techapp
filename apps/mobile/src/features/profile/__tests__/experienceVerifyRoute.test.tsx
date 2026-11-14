import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExperienceVerifyScreen } from '../ExperienceVerifySheet';
import { makeError } from '../../../lib/errors';

const mockRequest = jest.fn(); const mockToast = jest.fn(); let mockOrgs: { id: string; name: string }[] = [];
let mockQuery: { isPending: boolean; isError: boolean; error?: unknown } = { isPending: false, isError: false };
const mockRefetch = jest.fn();
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  useAttestingOrganizations: () => ({ ...mockQuery, data: mockOrgs, refetch: mockRefetch }),
  useRequestAttestation: () => ({ mutate: (id: string, o: { onSuccess: () => void }) => { mockRequest(id); o.onSuccess(); }, isPending: false, error: null, reset: jest.fn() }),
}));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const goBack = jest.fn();
const props = { navigation: { goBack }, route: { key: 'k', name: 'ExperienceVerify', params: { experienceId: 'x1' } } } as unknown as React.ComponentProps<typeof ExperienceVerifyScreen>;
beforeEach(() => { mockQuery = { isPending: false, isError: false }; mockRefetch.mockClear(); mockOrgs = [{ id: 'o1', name: 'Şehit Öğretmen' }]; mockRequest.mockClear(); mockToast.mockClear(); goBack.mockClear(); });

describe('Doğrulama iste sheet route', () => {
  it('the send button waits for an organisation; sending pops the sheet and confirms', async () => {
    await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={new QueryClient()}><ExperienceVerifyScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
    expect(screen.getByText('Doğrulama iste')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'İsteği gönder' }).props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: /Şehit Öğretmen/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'İsteği gönder' }));
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith('o1'));
    expect(goBack).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Doğrulama isteğin kuruma iletildi.', 'success');
  });

  const mount = () => render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={new QueryClient()}><ExperienceVerifyScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
  it('the organisation list failing shows the error with a retry; nothing can be sent', async () => {
    mockQuery = { isPending: false, isError: true, error: makeError('network_unreachable', 0) };
    mockOrgs = [];
    await mount();
    expect(screen.getByText('Bağlantı yok gibi görünüyor')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'İsteği gönder' }).props.accessibilityState?.disabled).toBe(true);
  });
  it('no organisation can attest: says so and keeps the send button disabled', async () => {
    mockOrgs = [];
    await mount();
    expect(screen.getByText('Şu an doğrulama yapabilecek bir kurum yok.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'İsteği gönder' }).props.accessibilityState?.disabled).toBe(true);
  });
});
