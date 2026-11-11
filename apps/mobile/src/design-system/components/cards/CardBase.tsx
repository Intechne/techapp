import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { motion, radius, semantic } from '../../tokens';
import { useReducedMotion } from '../../useReducedMotion';
import { cardLayout } from './metrics';

const sem = semantic.light;

interface CardBaseProps {
  /** One stop for screen readers: build it with `cardLabel(parts)`. */
  label: string;
  onPress?: () => void;
  children: React.ReactNode;
  /**
   * Interactive layer above the card (the bookmark). It is a sibling of the press target, never a child, so it stays its
   * own screen-reader stop and its presses never reach `onPress`. The layer fills the card; position the content inside.
   */
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Base of every card: surface, hairline border, `radius.card`, one press target. Press feedback is a small spring scale
 * of the whole card (accessory included) on the UI thread plus a canvas-tinted background while pressed, which is the
 * only cue under reduced motion. A card without `onPress` is still one labelled element, just not a button.
 */
export function CardBase({ label, onPress, children, accessory, style, testID }: CardBaseProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pressIn = useCallback(() => { if (!reduced) scale.set(withSpring(cardLayout.pressScale, motion.spring.snappy)); }, [reduced, scale]);
  const pressOut = useCallback(() => { if (!reduced) scale.set(withSpring(1, motion.spring.snappy)); }, [reduced, scale]);

  return (
    <Animated.View testID={testID} style={[styles.frame, style, animated]}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
          pressRetentionOffset={12} style={({ pressed }) => [styles.fill, pressed && styles.pressed]}>
          {children}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={styles.fill}>{children}</View>
      )}
      {accessory && <View style={styles.accessoryLayer}>{accessory}</View>}
    </Animated.View>
  );
}

/** Skeleton frame: the same surface as CardBase with one calm opacity pulse for the whole placeholder (static with reduced motion). */
export function CardSkeletonFrame({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) { cancelAnimation(opacity); opacity.set(1); return; }
    opacity.set(withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <View testID={testID} style={[styles.frame, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fill, animated]}>{children}</Animated.View>
    </View>
  );
}

/** Placeholder bar centred inside a line box of the real text's line height, so skeleton rows measure exactly like content. */
export function SkeletonLine({ lineHeight, width, barHeight }: { lineHeight: number; width: ViewStyle['width']; barHeight?: number }) {
  const h = barHeight ?? Math.round(lineHeight * 0.62);
  return (
    <View style={{ width: '100%', height: lineHeight, justifyContent: 'center' }}>
      <View style={{ width, height: h, borderRadius: radius.small, backgroundColor: sem.bg.sunken }} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: sem.bg.surface, borderRadius: radius.card, borderWidth: 1, borderColor: sem.border.default, overflow: 'hidden' },
  fill: { flexGrow: 1 },
  pressed: { backgroundColor: sem.bg.canvas },
  accessoryLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'box-none' },
});
