import React, { useCallback, useState } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '../tokens';
import { useReducedMotion } from '../useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** Press-in scale; defaults to motion.pressScale. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

/**
 * Pressable with spring press feedback. The scale lives in a shared value and runs on the UI thread, so a press
 * never costs a React re-render for the animation; the spring is retargeted from its current value, so a quick
 * second press interrupts cleanly instead of queueing. With reduced motion, or when disabled, nothing scales.
 * Scrolling is untouched: Pressable cancels press-in when a parent scroll view claims the gesture, which springs back.
 */
export function PressableScale({ scaleTo = motion.pressScale, disabled, style, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animate = !reduced && !disabled;

  const handleIn = useCallback((e: GestureResponderEvent) => {
    setPressed(true);
    if (animate) scale.set(withSpring(scaleTo, motion.spring.snappy));
    onPressIn?.(e);
  }, [animate, scale, scaleTo, onPressIn]);

  const handleOut = useCallback((e: GestureResponderEvent) => {
    setPressed(false);
    if (animate) scale.set(withSpring(1, motion.spring.snappy));
    onPressOut?.(e);
  }, [animate, scale, onPressOut]);

  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable {...rest} disabled={disabled} onPressIn={handleIn} onPressOut={handleOut} style={[resolved, animated]} />
  );
}
