import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReportSheetScreen } from '../ReportSheet';

let mockUser: string | null = 'u1';
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
jest.mock('../api', () => ({ ...jest.requireActual('../api'), submitReport: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const goBack = jest.fn(); const replace = jest.fn();
const open = () => {
  const props = { navigation: { goBack, replace }, route: { key: 'k', name: 'ReportSheet', params: { targetType: 'event', targetId: 'e1', label: 'Robotik Günü' } } } as unknown as React.ComponentProps<typeof ReportSheetScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={new QueryClient()}><ReportSheetScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
beforeEach(() => { mockUser = 'u1'; goBack.mockClear(); replace.mockClear(); });

describe('Bildir sheet route', () => {
  it('reads the subject from route params, names it as written, offers the server reasons; the header close pops the sheet', async () => {
    await open();
    expect(screen.getByText('İçeriği bildir')).toBeTruthy();
    expect(screen.getByText('Robotik Günü')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(7);
    await fireEvent.press(screen.getByRole('button', { name: 'Kapat' }));
    expect(goBack).toHaveBeenCalled();
  });
  it('a guest gets the sign-in prompt; "Giriş yap" swaps the sheet for the sign-in modal and nothing is queued', async () => {
    mockUser = null;
    await open();
    expect(screen.getByText('Bildirmek için giriş yapman gerekiyor.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(replace).toHaveBeenCalledWith('AuthEmail');
  });
});
