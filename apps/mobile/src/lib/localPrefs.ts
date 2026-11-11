import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

/**
 * Non-sensitive, device-local UI preferences (guest onboarding choices). Never an authority for anything.
 * Versioned + schema-validated: corrupt or outdated data falls back to defaults instead of breaking startup.
 */
const KEY = 'techapp:prefs';
const VERSION = 1;

const schema = z.object({
  version: z.literal(VERSION),
  onboarded: z.boolean(),
  educationStage: z.enum(['middle_school', 'high_school', 'university', 'graduate', 'other']).nullable(),
  interestSlugs: z.array(z.string()).max(20),
  // Added after v1 shipped: older stored prefs lack it and must keep parsing (default on).
  haptics: z.boolean().default(true),
});
export type LocalPrefs = z.infer<typeof schema>;

export const defaultPrefs: LocalPrefs = { version: VERSION, onboarded: false, educationStage: null, interestSlugs: [], haptics: true };

export async function loadPrefs(): Promise<LocalPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultPrefs;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
}

export async function savePrefs(prefs: LocalPrefs): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* preference loss is acceptable */ }
}

/**
 * What account deletion forgets on this device: the person's own choices. "onboarded" stays true so the next person
 * is not sent through onboarding again. Sign-out keeps all of it (device preferences, not account data).
 * Applied through PrefsProvider.update so the in-memory copy and storage never disagree.
 */
export const PERSONAL_PREFS_RESET: Partial<Omit<LocalPrefs, 'version'>> = { onboarded: true, educationStage: null, interestSlugs: [] };
