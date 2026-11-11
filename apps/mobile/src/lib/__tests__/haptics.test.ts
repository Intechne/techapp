/* eslint-disable @typescript-eslint/no-require-imports -- modules are re-required after jest.resetModules() to simulate app restarts */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

const setOS = (os: string) => { (Platform as { OS: string }).OS = os; };

describe('haptics', () => {
  let h: typeof import('../haptics');
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    setOS('ios');
    h = require('../haptics');
  });
  afterAll(() => setOS('ios'));

  it('maps semantic calls to expo-haptics', async () => {
    await h.initHaptics();
    const eh = require('expo-haptics') as typeof ExpoHaptics;
    h.haptics.selection(); h.haptics.success(); h.haptics.warning(); h.haptics.error();
    expect(eh.selectionAsync).toHaveBeenCalledTimes(1);
    expect(eh.notificationAsync).toHaveBeenNthCalledWith(1, eh.NotificationFeedbackType.Success);
    expect(eh.notificationAsync).toHaveBeenNthCalledWith(2, eh.NotificationFeedbackType.Warning);
    expect(eh.notificationAsync).toHaveBeenNthCalledWith(3, eh.NotificationFeedbackType.Error);
  });

  it('is silent when disabled, and the choice persists through localPrefs', async () => {
    const { loadPrefs } = require('../localPrefs') as typeof import('../localPrefs');
    await h.setHapticsEnabled(false);
    const eh = require('expo-haptics') as typeof ExpoHaptics;
    h.haptics.selection(); h.haptics.success();
    expect(eh.selectionAsync).not.toHaveBeenCalled();
    expect(eh.notificationAsync).not.toHaveBeenCalled();
    expect((await loadPrefs()).haptics).toBe(false);
    // app restart: a fresh module registry reads the stored preference at init
    const stored = JSON.stringify(await loadPrefs());
    jest.resetModules();
    const AS2 = require('@react-native-async-storage/async-storage') as typeof AsyncStorage;
    await AS2.setItem('techapp:prefs', stored);
    const h2 = require('../haptics') as typeof import('../haptics');
    await h2.initHaptics();
    h2.haptics.selection();
    expect((require('expo-haptics') as typeof ExpoHaptics).selectionAsync).not.toHaveBeenCalled();
  });

  it('is a no-op on web', async () => {
    setOS('web');
    const eh = require('expo-haptics') as typeof ExpoHaptics;
    h.haptics.selection(); h.haptics.success(); h.haptics.warning(); h.haptics.error();
    expect(eh.selectionAsync).not.toHaveBeenCalled();
    expect(eh.notificationAsync).not.toHaveBeenCalled();
  });

  it('never throws, sync or async', async () => {
    const eh = require('expo-haptics') as typeof ExpoHaptics;
    (eh.selectionAsync as jest.Mock).mockImplementationOnce(() => { throw new Error('sync'); });
    (eh.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('async'));
    expect(() => h.haptics.selection()).not.toThrow();
    expect(() => h.haptics.error()).not.toThrow();
    await Promise.resolve();
  });
});
