import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Semantic haptics: call sites say what happened (selection / success / warning / error), never which motor pattern.
 * Fire-and-forget, never throws, silent on web. The on/off flag is owned by PrefsProvider (localPrefs.haptics), which
 * pushes it here whenever prefs load or change; toggling goes through usePrefs().update({ haptics }).
 * Fails closed: until prefs have loaded the flag is off, so a vibration the person disabled can never fire.
 */
let enabled = false;

/** Called by PrefsProvider only. */
export function setHapticsEnabledFromPrefs(on: boolean): void {
  enabled = on;
}

function fire(run: () => Promise<void>): void {
  if (!enabled || Platform.OS === 'web') return;
  try { run().catch(() => {}); } catch { /* haptics are decoration; never break a flow */ }
}

export const haptics = {
  selection: () => fire(() => Haptics.selectionAsync()),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
