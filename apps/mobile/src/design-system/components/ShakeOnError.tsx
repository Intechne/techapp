import React, { useEffect, useRef } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming, ReduceMotion } from 'react-native-reanimated';
import { haptics } from '../../lib/haptics';
import { EASE_IN_OUT } from '../motion';
import { useReducedMotion } from '../useReducedMotion';

/** Three left-right swings of 6 px, 280 ms in all (seven 40 ms legs, ending at rest). */
const SWING = 6;
const LEG_MS = 40;
const LEGS = [-SWING, SWING, -SWING, SWING, -SWING, SWING, 0];

/**
 * Wraps a field: when `trigger` (the error key, usually the message) changes to a new non-empty value the field shakes once and
 * the error haptic fires. Same value again, a cleared error, and the first render do nothing. Reduced motion: no transform at all;
 * the message and its live-region announcement (in the field shell) carry the news, and the haptic still fires.
 */
export function ShakeOnError({ trigger, children, testID = 'shake' }: { trigger: string | number | null | undefined; children: React.ReactNode; testID?: string }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const last = useRef(trigger);
  useEffect(() => {
    if (last.current === trigger) return;
    last.current = trigger;
    if (trigger === null || trigger === undefined || trigger === '') return;
    haptics.error();
    if (reduced) return;
    x.set(withSequence(...LEGS.map((to) => withTiming(to, { duration: LEG_MS, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System }))));
  }, [trigger, reduced, x]);
  useEffect(() => () => cancelAnimation(x), [x]);
  const animated = useAnimatedStyle(() => (reduced ? {} : { transform: [{ translateX: x.get() }] }));
  return <Animated.View testID={testID} style={animated}>{children}</Animated.View>;
}
