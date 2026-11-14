import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics } from '../../../lib/haptics';
import { spring } from '../../motion';
import { layout, radius, semantic } from '../../tokens';
import { TechIcon } from '../../TechIcon';

const sem = semantic.light;

interface BookmarkButtonProps {
  saved: boolean;
  onToggle: () => void;
  /** Domain wording when "save" means something more specific (follow a deadline). Defaults: Kaydet / Kaydedildi; `selected` carries the state for screen readers. */
  labels?: { save: string; unsave: string };
}

/**
 * The one save control on cards: a full 44×44 target, filled glyph when saved, its own screen-reader stop.
 * Feedback: the glyph dips to 0.9 on press and springs back to 1 on release (`snappy`); one `selection` haptic per tap.
 * Both ends are springs retargeted from the glyph's current scale, so rapid taps continue the motion instead of restarting it,
 * and the look afterwards is whatever `saved` says (the server's answer), never a count of taps. Reduced motion: no scale.
 */
export function BookmarkButton({ saved, onToggle, labels = { save: 'Kaydet', unsave: 'Kaydedildi' } }: BookmarkButtonProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={saved ? labels.unsave : labels.save} accessibilityState={{ selected: saved }}
      onPressIn={() => scale.set(withSpring(0.9, spring('snappy')))}
      onPressOut={() => scale.set(withSpring(1, spring('snappy')))}
      onPress={() => { haptics.selection(); onToggle(); }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Animated.View style={animated}>
        <TechIcon name="bookmark" size={22} filled={saved} color={saved ? sem.action.primary : sem.text.primary} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: layout.touchTarget, height: layout.touchTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: sem.action.primarySoft },
});
