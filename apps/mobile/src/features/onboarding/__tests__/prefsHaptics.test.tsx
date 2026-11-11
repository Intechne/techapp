import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { PrefsProvider, usePrefs } from '../PrefsProvider';
import { haptics, setHapticsEnabledFromPrefs } from '../../../lib/haptics';

const wrapper = ({ children }: { children: React.ReactNode }) => <PrefsProvider>{children}</PrefsProvider>;
const stored = async () => JSON.parse((await AsyncStorage.getItem('techapp:prefs')) as string);
const buzz = () => { (ExpoHaptics.selectionAsync as jest.Mock).mockClear(); haptics.selection(); return (ExpoHaptics.selectionAsync as jest.Mock).mock.calls.length; };

describe('PrefsProvider owns the haptics flag', () => {
  beforeEach(async () => { await AsyncStorage.clear(); setHapticsEnabledFromPrefs(false); });

  it('stored haptics:false -> silent before and after load', async () => {
    await AsyncStorage.setItem('techapp:prefs', JSON.stringify({ version: 1, onboarded: true, educationStage: null, interestSlugs: [], haptics: false }));
    const { result } = await renderHook(() => usePrefs(), { wrapper });
    expect(buzz()).toBe(0);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(buzz()).toBe(0);
  });

  it('fails closed until loaded, then default (nothing stored) is on', async () => {
    expect(buzz()).toBe(0); // before any provider has mounted/loaded
    const { result } = await renderHook(() => usePrefs(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(buzz()).toBe(1);
  });

  it('update({haptics:false}) then an unrelated update keeps it off and persisted', async () => {
    const { result } = await renderHook(() => usePrefs(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { result.current.update({ haptics: false }); });
    expect(buzz()).toBe(0);
    await act(async () => { result.current.update({ interestSlugs: ['robotik'] }); });
    expect(buzz()).toBe(0);
    expect((await stored()).haptics).toBe(false);
    expect((await stored()).interestSlugs).toEqual(['robotik']);
  });
});
