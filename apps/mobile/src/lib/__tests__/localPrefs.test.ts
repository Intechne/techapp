import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalData, defaultPrefs, loadPrefs, savePrefs } from '../localPrefs';

describe('local prefs', () => {
  beforeEach(() => AsyncStorage.clear());
  it('falls back to defaults on corrupt JSON, wrong shape or old version instead of crashing startup', async () => {
    for (const raw of ['{not json', JSON.stringify({ version: 0, onboarded: true }), JSON.stringify({ version: 1, onboarded: 'yes', educationStage: null, interestSlugs: [] })]) {
      await AsyncStorage.setItem('techapp:prefs', raw);
      expect(await loadPrefs()).toEqual(defaultPrefs);
    }
  });
  it('survives storage IO failures', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    expect(await loadPrefs()).toEqual(defaultPrefs);
  });
  it('clearLocalData leaves nothing behind (no stale state is written back)', async () => {
    await savePrefs({ ...defaultPrefs, onboarded: true, interestSlugs: ['robotik'] });
    await clearLocalData();
    expect(await loadPrefs()).toEqual(defaultPrefs);
  });
});
