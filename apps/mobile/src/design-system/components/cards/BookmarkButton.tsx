import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { layout, radius, semantic } from '../../tokens';
import { TechIcon } from '../../TechIcon';

const sem = semantic.light;

interface BookmarkButtonProps {
  saved: boolean;
  onToggle: () => void;
  /** Domain wording when "save" means something more specific (follow a deadline). Defaults: Kaydet / Kaydedildi; `selected` carries the state for screen readers. */
  labels?: { save: string; unsave: string };
}

/** The one save control on cards: a full 44×44 target, filled glyph when saved, its own screen-reader stop. */
export function BookmarkButton({ saved, onToggle, labels = { save: 'Kaydet', unsave: 'Kaydedildi' } }: BookmarkButtonProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={saved ? labels.unsave : labels.save} accessibilityState={{ selected: saved }} onPress={onToggle}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <TechIcon name="bookmark" size={22} filled={saved} color={saved ? sem.action.primary : sem.text.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: layout.touchTarget, height: layout.touchTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: sem.action.primarySoft },
});
