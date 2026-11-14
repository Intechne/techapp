import { Easing, ReduceMotion, withRepeat, withTiming, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';
import { motion } from './tokens';

/** Entrances and exits: fast start, soft landing. There is no ease-in in this app. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Movement that stays on screen (a shake, a swap). */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export type TimingKind = 'fast' | 'standard' | 'exit';
export type SpringKind = 'snappy' | 'gentle';

/** `withTiming(value, timing('fast'))`: duration from tokens.motion, ease-out, and the system reduce-motion setting wins. */
export function timing(kind: TimingKind): WithTimingConfig {
  return { duration: motion[kind], easing: EASE_OUT, reduceMotion: ReduceMotion.System };
}

/** `withSpring(value, spring('snappy'))`: damping and stiffness from tokens.motion; retargets from the current value. */
export function spring(kind: SpringKind): WithSpringConfig {
  return { ...motion.spring[kind], reduceMotion: ReduceMotion.System };
}

/** Skeleton pulse: one calm, slow opacity breath (the only loop in the app; skeletons are not a tab or list entrance). */
export const SKELETON_PULSE_MS = 900;
export const SKELETON_PULSE_TO = 0.55;

/** `opacity.set(skeletonPulse())`: 1 to 0.55 and back, forever; the system reduce-motion setting resolves it to the end value. */
export function skeletonPulse() {
  return withRepeat(
    withTiming(SKELETON_PULSE_TO, { duration: SKELETON_PULSE_MS, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System }),
    -1, true, undefined, ReduceMotion.System,
  );
}
