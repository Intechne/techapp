import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, fonts, layout, radius, space, tones } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { keepNumbersTogether } from './cards/label';

interface ChipProps { label: string; selected?: boolean; icon?: TechIconName; onPress?: () => void }

/** Selectable pill. Visual height 40, touch height 44 via hitSlop. */
export function Chip({ label, selected = false, icon, onPress }: ChipProps) {
  const fg = selected ? colors.white : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} hitSlop={{ top: 2, bottom: 2 }} onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      {icon && <TechIcon name={icon} size={16} color={fg} />}
      <Text variant="label" style={{ color: fg }}>{label}</Text>
    </Pressable>
  );
}
export const FilterChip = Chip;

/** Horizontal chip rail that bleeds to the screen edges. */
export function ChipRail({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -layout.gutter, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: space[2], paddingVertical: space[1] }}>
      {children}
    </ScrollView>
  );
}

type TagTone = 'iris' | 'moss' | 'neutral' | 'onDark' | 'danger' | 'apricot';
const tagTones: Record<TagTone, { bg: string; fg: string }> = {
  iris: { bg: colors.primarySoft, fg: colors.primary },
  moss: { bg: colors.mossSoft, fg: colors.moss },
  neutral: { bg: colors.surfaceSunken, fg: colors.ink },
  onDark: { bg: colors.onDarkChip, fg: colors.ink },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  apricot: { bg: tones.apricot.bg, fg: tones.apricot.fg },
};

export function Tag({ label, tone = 'iris', icon }: { label: string; tone?: TagTone; icon?: TechIconName }) {
  const t = tagTones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      {icon && <View style={styles.tagIcon}><TechIcon name={icon} size={14} color={t.fg} /></View>}
      <Text variant="caption" breakStrategy="words" style={{ flexShrink: 1, minWidth: 0, color: t.fg, fontFamily: fonts.bodyBold, letterSpacing: 0.4 }}>{keepNumbersTogether(label)}</Text>
    </View>
  );
}
export const Badge = Tag;

/** Provenance of an experience: the difference must always be visible. */
export function VerificationBadge({ verified, by }: { verified: boolean; by?: string }) {
  return verified
    ? <Tag tone="moss" icon="verified" label={by ? `DOĞRULANDI · ${by}` : 'DOĞRULANDI'} />
    : <Tag tone="neutral" label="KENDİ BEYANI" />;
}

/** From this font scale the segments stack in one column: three equal tiles cannot hold a long word ("Deneyimler") at 200% without splitting it. */
export const SEGMENTS_STACK_FONT_SCALE = 1.5;

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View testID="segmented" style={[styles.segmented, fontScale >= SEGMENTS_STACK_FONT_SCALE && styles.segmentedStacked]} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)}
          style={[styles.segment, o === value && styles.segmentActive]}>
          <Text variant="label" center breakStrategy="words" color={o === value ? 'ink' : 'textSecondary'}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40, paddingHorizontal: space[4], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: space[1],
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.small, paddingHorizontal: space[2], paddingVertical: 5 },
  /** A wrapping label must never squeeze the glyph (a long status in a narrow slot). */
  tagIcon: { flexShrink: 0 },
  segmented: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.control, padding: 4 },
  // A long label wraps between words onto a second line and the segment grows with it (all segments stretch to the tallest).
  segment: { flex: 1, minHeight: 40, minWidth: 0, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center', paddingVertical: space[2], paddingHorizontal: space[1] },
  segmentActive: { backgroundColor: colors.surface },
  segmentedStacked: { flexDirection: 'column' },
});
