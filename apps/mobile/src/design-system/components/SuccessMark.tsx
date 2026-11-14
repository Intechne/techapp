import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { timing } from '../motion';
import { colors } from '../tokens';
import { TechIcon, type TechIconName } from '../TechIcon';
import { useReducedMotion } from '../useReducedMotion';

type Tone = 'moss' | 'apricot' | 'danger';
const PALETTE: Record<Tone, { soft: string; fg: string }> = {
  moss: { soft: colors.mossSoft, fg: colors.moss },
  apricot: { soft: colors.apricot, fg: colors.ink },
  danger: { soft: colors.dangerSoft, fg: colors.danger },
};

interface SuccessMarkProps {
  tone: Tone;
  icon: TechIconName;
  /** Plate diameter / glyph size. Defaults: the 40 px badge with a 24 px glyph. */
  size?: number;
  glyph?: number;
  /** `white`: a white plate (sits on a toned card); `soft`: the tone's own soft plate. */
  plate?: 'white' | 'soft';
  rounded?: number;
  testID?: string;
  /** testID of the glyph itself (tests assert which glyph a result shows). */
  iconTestID?: string;
}

/**
 * The state mark of a result (check-in outcome, registration confirmed). It plays once, when it appears: scale 0.96 to 1 and
 * opacity 0 to 1 over `standard` with ease-out, on the UI thread. Reduced motion: opacity only. The glyph is an SVG with no
 * role of its own; the screen says what happened in words (and announces it once).
 */
export function SuccessMark({ tone, icon, size = 40, glyph = 24, plate = 'white', rounded, testID = 'success-mark', iconTestID }: SuccessMarkProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, timing('standard')));
    return () => cancelAnimation(progress);
  }, [progress]);
  const animated = useAnimatedStyle(() => (reduced
    ? { opacity: progress.get() }
    : { opacity: progress.get(), transform: [{ scale: 0.96 + 0.04 * progress.get() }] }));
  const p = PALETTE[tone];
  const shape: ViewStyle = { width: size, height: size, borderRadius: rounded ?? size / 2, backgroundColor: plate === 'white' ? colors.white : p.soft };
  return (
    <Animated.View testID={testID} style={[styles.plate, shape, animated]}>
      <View testID={iconTestID}><TechIcon name={icon} size={glyph} color={p.fg} /></View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ plate: { alignItems: 'center', justifyContent: 'center' } });
