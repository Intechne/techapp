import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProfileBootstrapScreen } from '../ProfileBootstrapScreen';
import { parseBirthDate } from '../../../lib/dates';

jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ rpc: jest.fn() }) }));
jest.mock('../authService', () => ({ signOut: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }), useAccountState: () => ({ data: undefined }) }));
jest.mock('../../onboarding/PrefsProvider', () => ({ usePrefs: () => ({ prefs: { educationStage: null, interestSlugs: [] } }) }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const NAME_ERR = 'Adın en az 2 karakter olmalı.';
const STAGE_ERR = 'Bir seçenek işaretle.';

const open = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = { navigation: { popTo: jest.fn() } } as unknown as React.ComponentProps<typeof ProfileBootstrapScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ProfileBootstrapScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
  await fireEvent.press(screen.getByText('Devam et'));
};

describe('ProfileBootstrap field errors clear as the user fixes them', () => {
  it('typing a valid name removes only the name error', async () => {
    await open();
    expect(screen.getByText(NAME_ERR)).toBeTruthy();
    expect(screen.getByText(STAGE_ERR)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Ad soyad'), 'Ada');
    expect(screen.queryByText(NAME_ERR)).toBeNull();
    expect(screen.getByText(STAGE_ERR)).toBeTruthy();
  });
  it('typing in the birth date clears the birth error; choosing a stage clears the stage error', async () => {
    await open();
    const birthErr = (parseBirthDate('') as { error: string }).error;
    expect(screen.getByText(birthErr)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Doğum tarihi'), '01.01.2000');
    expect(screen.queryByText(birthErr)).toBeNull();
    await fireEvent.press(screen.getByText('Lise'));
    expect(screen.queryByText(STAGE_ERR)).toBeNull();
    expect(screen.getByText(NAME_ERR)).toBeTruthy();
  });
});
