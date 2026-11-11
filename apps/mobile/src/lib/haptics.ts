import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { loadPrefs, savePrefs } from './localPrefs';

/**
 * Semantic haptics: call sites say what happened (selection / success / warning / error), never which motor pattern.
 * Fire-and-forget, never throws, silent on web and when the person turned haptics off (localPrefs.haptics).
 */
let enabled = true;

/** Load the stored preference once at startup; until then haptics default to on. */
export async function initHaptics(): Promise<void> {
  enabled = (await loadPrefs()).haptics;
}

export async function setHapticsEnabled(on: boolean): Promise<void> {
  enabled = on;
  await savePrefs({ ...(await loadPrefs()), haptics: on });
}

export function hapticsEnabled(): boolean { return enabled; }

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
