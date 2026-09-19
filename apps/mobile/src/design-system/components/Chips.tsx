import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, layout, radius, space } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';

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
  onDark: { bg: 'rgba(255,255,255,0.86)', fg: colors.ink },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  apricot: { bg: '#FFE8DD', fg: '#763C2C' },
};

export function Tag({ label, tone = 'iris', icon }: { label: string; tone?: TagTone; icon?: TechIconName }) {
  const t = tagTones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      {icon && <TechIcon name={icon} size={14} color={t.fg} />}
      <Text variant="caption" style={{ color: t.fg, fontFamily: 'DMSans_700Bold', letterSpacing: 0.4 }}>{label}</Text>
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

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)}
          style={[styles.segment, o === value && styles.segmentActive]}>
          <Text variant="label" color={o === value ? 'ink' : 'textSecondary'}>{o}</Text>
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
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.small, paddingHorizontal: space[2], paddingVertical: 5 },
  segmented: { flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.control, padding: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surface },
});
