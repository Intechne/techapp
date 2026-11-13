import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, tones, type, type Tone, type TypeVariant } from '../tokens';
import { Text } from '../Text';
import { TextButton } from './Button';
import { TechIcon, type TechIconName } from '../TechIcon';
import { Card } from './Surface';
import { CoverImage } from './CoverImage';

/**
 * Detail-screen poster: the cover photo (full size) when there is one; otherwise the same Open Circuit fallback art as PosterCard (type badge + one circuit trace) on the tone
 * ground, with the type label (a category, set in capitals) and the poster line at the bottom. The organiser is not on
 * the poster (approved Q2): a name never becomes an eyebrow; the detail screen's organiser row carries it.
 */
export function Poster({ tone, icon, typeLabel, line, large, cover }: { tone: Tone; icon: TechIconName; typeLabel: string; line: string; large?: boolean; cover?: { path: string | null; blurhash: string | null } }) {
  return (
    <CoverImage detail large={large} path={cover?.path ?? null} blurhash={cover?.blurhash ?? null} size="full" aspect={16 / 10}
      fallback={{ tone, icon, eyebrow: typeLabel, line }} />
  );
}

export function MetadataRow({ icon, children, strong }: { icon: TechIconName; children: React.ReactNode; strong?: boolean }) {
  return (
    <View style={styles.meta}>
      <TechIcon name={icon} size={16} color={colors.textSecondary} />
      <Text variant={strong ? 'label' : 'caption'} color={strong ? 'ink' : 'textSecondary'} style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44, tone = 'iris' }: { name: string | null; size?: number; tone?: Tone }) {
  const initials = (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toLocaleUpperCase('tr')).join('');
  return (
    <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tones[tone].bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="label" style={{ color: tones[tone].fg }}>{initials || '?'}</Text>
    </View>
  );
}

export function OrganizerRow({ name, verified, caption, onPress }: { name: string; verified: boolean; caption?: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={styles.organizer}
      accessibilityLabel={`Düzenleyen: ${name}${verified ? ', doğrulanmış kurum' : ''}`}>
      <View style={styles.orgLogo}><TechIcon name="mark" color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
          {/* The full name wraps (detail screens never cut a name); the badge never shrinks into a dot beside it. */}
          <Text variant="label" breakStrategy="words" style={{ flexShrink: 1 }}>{name}</Text>
          {verified && <View style={styles.badge}><TechIcon name="verified" size={16} color={colors.moss} /></View>}
        </View>
        <Text variant="caption" color="textSecondary">{caption ?? (verified ? 'Doğrulanmış kurum' : 'Düzenleyen')}</Text>
      </View>
      {onPress && <TechIcon name="chevron" size={18} color={colors.textSecondary} />}
    </Pressable>
  );
}

export function ProfileCard({ name, headline, onPress }: { name: string | null; headline?: string | null; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Avatar name={name} size={56} />
      <View style={{ flex: 1 }}>
        <Text variant="cardTitle">{name ?? 'Adını ekle'}</Text>
        {headline && <Text variant="bodySmall" color="textSecondary">{headline}</Text>}
      </View>
    </Card>
  );
}

/** Long descriptions clamp at this many lines on detail screens, with "Devamını oku" (approved Q12). */
export const READ_MORE_LINES = 8;
/** The decision, apart from layout: only text that measured more than `max` lines gets the button. Unknown (null) = no button. */
export const needsReadMore = (lines: number | null, max = READ_MORE_LINES): boolean => lines !== null && lines > max;
/**
 * Clamp only what was measured long and not yet expanded. Unmeasured text is never clamped: if the measurement never
 * arrives (a platform without onTextLayout, an odd layout) the reader still gets the whole text instead of a dead end.
 */
export const readMoreClamp = (lines: number | null, expanded: boolean): boolean => !expanded && needsReadMore(lines);

/**
 * Body text that clamps at READ_MORE_LINES and expands in place. An invisible copy measures the full text (native:
 * onTextLayout line count; web has no onTextLayout, so its height / line height). The measurement is keyed by the text
 * and the system font scale, so a font-size change measures again. Short text gets no button and no clamp.
 */
export function ReadMoreText({ children, variant = 'body', color = 'textSecondary', style }: {
  children: string; variant?: TypeVariant; color?: React.ComponentProps<typeof Text>['color']; style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const key = `${fontScale}|${children}`;
  const [measured, setMeasured] = useState<{ key: string; lines: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const lines = measured?.key === key ? measured.lines : null;
  const lineHeight = type[variant].lineHeight * fontScale;
  return (
    <View style={style}>
      <Text testID="read-more-text" variant={variant} color={color} numberOfLines={readMoreClamp(lines, expanded) ? READ_MORE_LINES : undefined}>{children}</Text>
      {lines === null && (
        <Text testID="read-more-measure" variant={variant} color={color} style={styles.measure} aria-hidden
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          onTextLayout={(e) => setMeasured({ key, lines: e.nativeEvent.lines.length })}
          onLayout={Platform.OS === 'web' ? (e) => setMeasured({ key, lines: Math.round(e.nativeEvent.layout.height / lineHeight) }) : undefined}>
          {children}
        </Text>
      )}
      {!expanded && needsReadMore(lines) && <TextButton label="Devamını oku" onPress={() => setExpanded(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0, pointerEvents: 'none' },
  // Sits on the first line of a wrapped name (label line box 20, glyph 16).
  badge: { flexShrink: 0, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  organizer: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  orgLogo: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
