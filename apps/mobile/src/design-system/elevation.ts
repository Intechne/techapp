import { Platform, type ViewStyle } from 'react-native';
import { colors, elevation, type ElevationLevel } from './tokens';

/** One mapping for all targets: Android uses `elevation`; iOS and web use a soft Ink shadow scaled by the same level. */
export function elevationStyle(level: ElevationLevel): ViewStyle {
  const e = elevation[level];
  if (e === 0) return Platform.OS === 'android' ? { elevation: 0 } : {};
  if (Platform.OS === 'android') return { elevation: e };
  return {
    shadowColor: colors.ink,
    shadowOpacity: Math.min(0.04 + e * 0.012, 0.2),
    shadowRadius: e * 1.5,
    shadowOffset: { width: 0, height: Math.max(1, e / 2) },
  };
}
