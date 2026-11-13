import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { LARGE_TEXT_FONT_SCALE, colors, radius, semantic, space } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { TextButton } from './Button';
import { COVER_SCRIM, CoverFill } from './CoverImage';

const sem = semantic.light;

interface CardProps extends ViewProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ onPress, padded = true, style, children, ...rest }: CardProps) {
  const body = [styles.card, padded && { padding: space[4] }, style];
  if (!onPress) return <View {...rest} style={body}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} {...rest} style={({ pressed }) => [body, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

interface HeroCardProps {
  /** Category or status only ("HACKATHON", "ÖNE ÇIKAN"), set in capitals. Names and places (city, organiser) go in `meta`; they are never eyebrows. */
  category: string;
  title: string;
  /** Words rendered in lime inside the title. */
  accent?: string;
  meta?: string;
  cta?: string;
  /** Event cover (full size) behind the text, under an ink scrim. No cover or a failed load = the plain Iris block with its orbit. */
  cover?: { path: string | null; blurhash: string | null };
  onPress?: () => void;
}

/** Spoken label for the hero: sentences are joined with one full stop even when the poster line already ends in punctuation. */
export function heroAccessibilityLabel(title: string, meta?: string): string {
  const strip = (t: string) => t.trim().replace(/[\s.!?…]+$/u, '');
  return [title, meta].map((t) => strip(t ?? '')).filter(Boolean).join('. ');
}

/** The hero is one campaign line, not an article: a longer title or meta is clipped (the spoken label keeps all of it). */
export const HERO_TITLE_LINES = 4;
export const HERO_META_LINES = 2;

/** Above this system font scale the decorative orbit steps aside (CTA and meta grow into its corner). */
export const HERO_ORBIT_MAX_FONT_SCALE = 1.3;

/** Decorative orbit sized from the card width and tucked into the bottom-right corner, beside the CTA (never under the meta line). */
export function HeroOrbit({ cardWidth, fontScale }: { cardWidth: number; fontScale: number }) {
  // Large text grows the CTA and meta into the corner: the ring is purely decorative, so it steps aside.
  if (cardWidth <= 0 || fontScale > HERO_ORBIT_MAX_FONT_SCALE) return null;
  const s = Math.round(Math.max(72, Math.min(cardWidth * 0.28, 112)));
  const inner = Math.round(s * 0.58), orb = Math.round(s * 0.16);
  return (
    <View style={styles.orbitLayer} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.orbit, { right: -s * 0.24, bottom: -s * 0.16, width: s, height: s, borderRadius: s / 2, borderWidth: Math.max(8, Math.round(s * 0.07)) }]} />
      <View style={[styles.orbitInner, { right: -s * 0.03, bottom: s * 0.04, width: inner, height: inner, borderRadius: inner / 2, borderWidth: Math.max(6, Math.round(s * 0.053)) }]} />
      <View style={[styles.orb, { right: s * 0.18, bottom: s * 0.24, width: orb, height: orb, borderRadius: orb / 2 }]} />
    </View>
  );
}

/** Campaign hero: the one place where a full Iris colour block is allowed. */
export function HeroCard({ category, title, accent, meta, cta, cover, onPress }: HeroCardProps) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const parts = accent && title.includes(accent) ? title.split(accent) : [title];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={heroAccessibilityLabel(title, meta)} onPress={onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.hero, pressed && { backgroundColor: sem.action.primaryPressed }]}>
      <HeroOrbit cardWidth={width} fontScale={fontScale} />
      {cover && <CoverFill path={cover.path} blurhash={cover.blurhash} size="full" scrim={COVER_SCRIM} />}
      <View style={styles.heroRule}><View style={styles.rule} /><Text variant="eyebrow" color="white">{category}</Text></View>
      <Text variant="title" color="white" breakStrategy="words" numberOfLines={HERO_TITLE_LINES} accessibilityRole="text" style={{ marginTop: space[6], maxWidth: '78%' }}>
        {parts[0]}{accent && parts.length > 1 && <Text variant="title" color="lime" accessibilityRole="text">{accent}</Text>}{parts[1]}
      </Text>
      {meta && <Text variant="caption" color="white" numberOfLines={HERO_META_LINES} style={{ marginTop: space[3], opacity: 0.85 }}>{meta}</Text>}
      {cta && (
        <View style={styles.heroCta}>
          <Text variant="label" color="ink">{cta}</Text><TechIcon name="arrow" size={18} />
        </View>
      )}
    </Pressable>
  );
}

export function Divider({ spacing = space[5] }: { spacing?: number }) {
  return <View style={{ height: 1, backgroundColor: sem.border.default, marginVertical: spacing }} />;
}

/** Below this window width, or from this font scale, the action drops under the title instead of squeezing it (approved D1). */
export const SECTION_STACK_BELOW = 360;
export const SECTION_STACK_FONT_SCALE = LARGE_TEXT_FONT_SCALE;

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < SECTION_STACK_BELOW || fontScale >= SECTION_STACK_FONT_SCALE;
  return (
    <View testID="section-header" style={[styles.sectionHeader, stacked && styles.sectionHeaderStacked]}>
      <Text variant="section" style={stacked ? undefined : { flex: 1 }}>{title}</Text>
      {actionLabel && onAction && <TextButton label={actionLabel} iconRight="arrow" onPress={onAction} />}
    </View>
  );
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';
export const noticeTones: Record<NoticeTone, { bg: string; fg: string; icon: TechIconName }> = {
  info: { bg: sem.status.infoSoft, fg: sem.status.info, icon: 'spark' },
  success: { bg: sem.status.successSoft, fg: sem.status.success, icon: 'check' },
  warning: { bg: sem.status.warningSoft, fg: sem.status.warning, icon: 'warning' },
  danger: { bg: sem.status.dangerSoft, fg: sem.status.danger, icon: 'error' },
};

// `Daha önce {email} adresine…` arrives as an array, not a string: it still has to be wrapped in <Text>
// (a bare string outside <Text> crashes on native and falls back to the browser serif on web).
const isPlainText = (children: React.ReactNode) =>
  React.Children.toArray(children).every((c) => typeof c === 'string' || typeof c === 'number');

export function Notice({ tone = 'info', title, children }: { tone?: NoticeTone; title?: string; children?: React.ReactNode }) {
  const t = noticeTones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <TechIcon name={t.icon} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title && <Text variant="label" style={{ color: t.fg }}>{title}</Text>}
        {isPlainText(children) ? <Text variant="bodySmall" style={{ color: t.fg }}>{children}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: sem.bg.surface, borderRadius: radius.card, borderWidth: 1, borderColor: sem.border.default, overflow: 'hidden' },
  hero: { backgroundColor: sem.action.primary, borderRadius: radius.hero, padding: space[5], minHeight: 236, overflow: 'hidden' },
  heroRule: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rule: { width: 24, height: 1, backgroundColor: colors.white, opacity: 0.7 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start', marginTop: space[5],
    backgroundColor: sem.action.lime, borderRadius: radius.pill, paddingHorizontal: space[4], minHeight: 44,
  },
  orbitLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  orbit: { position: 'absolute', borderColor: colors.lime, opacity: 0.9, transform: [{ scaleY: 0.78 }, { rotate: '-18deg' }] },
  orbitInner: { position: 'absolute', borderColor: sem.decor.irisMuted },
  orb: { position: 'absolute', backgroundColor: colors.apricot },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: space[7], marginBottom: space[3], gap: space[2] },
  sectionHeaderStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: space[1] },
  notice: { flexDirection: 'row', gap: space[3], borderRadius: radius.control, padding: space[4] },
});
