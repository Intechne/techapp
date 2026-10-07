import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSONAL_PREFS_RESET, defaultPrefs, loadPrefs, savePrefs } from '../localPrefs';

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
  it('account deletion forgets personal choices but does not send the next person through onboarding again', () => {
    expect({ ...defaultPrefs, onboarded: true, educationStage: 'high_school', interestSlugs: ['robotik'], ...PERSONAL_PREFS_RESET })
      .toEqual({ ...defaultPrefs, onboarded: true });
  });
  it('round-trips valid prefs', async () => {
    await savePrefs({ ...defaultPrefs, onboarded: true, interestSlugs: ['robotik'] });
    expect(await loadPrefs()).toEqual({ ...defaultPrefs, onboarded: true, interestSlugs: ['robotik'] });
  });
});
