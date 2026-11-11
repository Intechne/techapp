import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';
import { haptics, setHapticsEnabledFromPrefs } from '../haptics';

const setOS = (os: string) => { (Platform as { OS: string }).OS = os; };

describe('haptics', () => {
  beforeEach(() => { jest.clearAllMocks(); setOS('ios'); setHapticsEnabledFromPrefs(true); });
  afterAll(() => setOS('ios'));

  it('maps semantic calls to expo-haptics', () => {
    haptics.selection(); haptics.success(); haptics.warning(); haptics.error();
    expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(ExpoHaptics.notificationAsync).toHaveBeenNthCalledWith(1, ExpoHaptics.NotificationFeedbackType.Success);
    expect(ExpoHaptics.notificationAsync).toHaveBeenNthCalledWith(2, ExpoHaptics.NotificationFeedbackType.Warning);
    expect(ExpoHaptics.notificationAsync).toHaveBeenNthCalledWith(3, ExpoHaptics.NotificationFeedbackType.Error);
  });

  it('is silent when disabled', () => {
    setHapticsEnabledFromPrefs(false);
    haptics.selection(); haptics.success();
    expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('is a no-op on web', () => {
    setOS('web');
    haptics.selection(); haptics.success(); haptics.warning(); haptics.error();
    expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('never throws, sync or async', async () => {
    (ExpoHaptics.selectionAsync as jest.Mock).mockImplementationOnce(() => { throw new Error('sync'); });
    (ExpoHaptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('async'));
    expect(() => haptics.selection()).not.toThrow();
    expect(() => haptics.error()).not.toThrow();
    await Promise.resolve();
  });
});
