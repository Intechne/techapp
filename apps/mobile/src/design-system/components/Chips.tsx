import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LARGE_TEXT_FONT_SCALE, colors, fonts, layout, radius, space, tones, type as typeScale } from '../tokens';
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
export const tagTones: Record<TagTone, { bg: string; fg: string }> = {
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

/** Average glyph advance of the semibold 14 pt label, as a fraction of the font size (Turkish text, measured on the shipped font). */
const SEGMENT_GLYPH_EM = 0.58;
/** Segment chrome: container padding 4 + 4, gap 4 between segments, segment horizontal padding 4 + 4. */
const SEGMENT_CHROME = { container: 8, gap: 4, padding: 8 } as const;

/**
 * Stacked (one column) only when it is needed: at large text (>= LARGE_TEXT_FONT_SCALE) AND the longest word of any label
 * no longer fits its equal-width segment. A long word ("Deneyimler" in three tiles, or any word on a 320 dp window) would
 * split mid-word; two short labels ("Takımlar" / "Topluluklar") keep fitting side by side, and so do tablets.
 */
export function segmentsShouldStack(options: readonly string[], width: number, fontScale: number): boolean {
  if (fontScale < LARGE_TEXT_FONT_SCALE || options.length < 2) return false;
  const inner = width - 2 * layout.gutter - SEGMENT_CHROME.container - SEGMENT_CHROME.gap * (options.length - 1);
  const segment = inner / options.length - SEGMENT_CHROME.padding;
  const longestWord = Math.max(...options.flatMap((o) => o.split(/\s+/)).map((w) => w.length));
  return longestWord * typeScale.label.fontSize * SEGMENT_GLYPH_EM * fontScale > segment;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  const { fontScale, width } = useWindowDimensions();
  return (
    <View testID="segmented" style={[styles.segmented, segmentsShouldStack(options, width, fontScale) && styles.segmentedStacked]} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)}
          style={[styles.segment, o === value && styles.segmentActive]}>
          <Text variant="label" center breakStrategy="words" color="ink">{o}</Text>
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
