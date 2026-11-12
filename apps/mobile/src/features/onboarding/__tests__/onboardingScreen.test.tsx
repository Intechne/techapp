import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '../OnboardingScreen';

const mockUpdate = jest.fn();
jest.mock('../PrefsProvider', () => ({ usePrefs: () => ({ update: mockUpdate, prefs: {}, ready: true }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () => render(<SafeAreaProvider initialMetrics={metrics}><OnboardingScreen /></SafeAreaProvider>);
beforeEach(() => mockUpdate.mockClear());

describe('OnboardingScreen: three steps with a text progress', () => {
  it('step 1 is "1/3", step 2 "2/3", step 3 "3/3": the count is in the accessibility label, no dots', async () => {
    await open();
    expect(screen.getByLabelText(/^Adım 1\/3/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Başlayalım'));
    expect(screen.getByLabelText(/^Adım 2\/3/)).toBeTruthy();
    expect(screen.getByText(/^2\/3/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Lise'));
    await fireEvent.press(screen.getByText('Devam et'));
    expect(screen.getByLabelText(/^Adım 3\/3/)).toBeTruthy();
  });

  it('"Şimdilik geç" is on every step and finishes onboarding with whatever was chosen so far', async () => {
    await open();
    await fireEvent.press(screen.getByText('Şimdilik geç'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ onboarded: true, educationStage: null, interestSlugs: [] });
    await fireEvent.press(screen.getByText('Başlayalım'));
    expect(screen.getByText('Şimdilik geç')).toBeTruthy();
    await fireEvent.press(screen.getByText('Lise'));
    await fireEvent.press(screen.getByText('Devam et'));
    expect(screen.getByText('Şimdilik geç')).toBeTruthy();
    // Step 3: skipping keeps the confirmed stage, drops the interests tapped so far.
    await fireEvent.press(screen.getAllByRole('button').find((b) => b.props.accessibilityState?.selected === false)!);
    await fireEvent.press(screen.getByText('Şimdilik geç'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ onboarded: true, educationStage: 'high_school', interestSlugs: [] });
  });

  it('interests are stored exactly as before: onboarded + stage + the chosen slugs', async () => {
    await open();
    await fireEvent.press(screen.getByText('Başlayalım'));
    await fireEvent.press(screen.getByText('Lise'));
    await fireEvent.press(screen.getByText('Devam et'));
    await fireEvent.press(screen.getAllByRole('button', { name: /./ }).find((b) => b.props.accessibilityState?.selected === false)!);
    await fireEvent.press(screen.getByText('Keşfetmeye başla'));
    const arg = mockUpdate.mock.calls.at(-1)![0];
    expect(arg.onboarded).toBe(true);
    expect(arg.educationStage).not.toBeNull();
    expect(arg.interestSlugs).toHaveLength(1);
  });
});
