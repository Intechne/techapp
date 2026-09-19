import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { TextButton } from './Button';

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
  eyebrow: string;
  title: string;
  /** Words rendered in lime inside the title. */
  accent?: string;
  meta?: string;
  cta?: string;
  onPress?: () => void;
}

/** Campaign hero: the one place where a full Iris colour block is allowed. */
export function HeroCard({ eyebrow, title, accent, meta, cta, onPress }: HeroCardProps) {
  const parts = accent && title.includes(accent) ? title.split(accent) : [title];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta ?? ''}`} onPress={onPress}
      style={({ pressed }) => [styles.hero, pressed && { backgroundColor: colors.primaryPressed }]}>
      <View style={styles.orbit} /><View style={styles.orbitInner} /><View style={styles.orb} />
      <View style={styles.heroRule}><View style={styles.rule} /><Text variant="eyebrow" color="white">{eyebrow}</Text></View>
      <Text variant="title" color="white" accessibilityRole="text" style={{ marginTop: space[6], maxWidth: '78%' }}>
        {parts[0]}{accent && parts.length > 1 && <Text variant="title" color="lime" accessibilityRole="text">{accent}</Text>}{parts[1]}
      </Text>
      {meta && <Text variant="caption" color="white" style={{ marginTop: space[3], opacity: 0.85 }}>{meta}</Text>}
      {cta && (
        <View style={styles.heroCta}>
          <Text variant="label" color="ink">{cta}</Text><TechIcon name="arrow" size={18} />
        </View>
      )}
    </Pressable>
  );
}

export function Divider({ spacing = space[5] }: { spacing?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing }} />;
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="section" style={{ flex: 1 }}>{title}</Text>
      {actionLabel && onAction && <TextButton label={actionLabel} iconRight="arrow" onPress={onAction} />}
    </View>
  );
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger';
const noticeTones: Record<NoticeTone, { bg: string; fg: string; icon: TechIconName }> = {
  info: { bg: colors.primarySoft, fg: '#4A4583', icon: 'spark' },
  success: { bg: colors.mossSoft, fg: colors.moss, icon: 'check' },
  warning: { bg: '#FFF1E9', fg: '#763C2C', icon: 'clock' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'shield' },
};

export function Notice({ tone = 'info', title, children }: { tone?: NoticeTone; title?: string; children?: React.ReactNode }) {
  const t = noticeTones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <TechIcon name={t.icon} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title && <Text variant="label" style={{ color: t.fg }}>{title}</Text>}
        {typeof children === 'string' ? <Text variant="bodySmall" style={{ color: t.fg }}>{children}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  hero: { backgroundColor: colors.primary, borderRadius: radius.hero, padding: space[5], minHeight: 236, overflow: 'hidden' },
  heroRule: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rule: { width: 24, height: 1, backgroundColor: colors.white, opacity: 0.7 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start', marginTop: space[5],
    backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: space[4], minHeight: 44,
  },
  orbit: { position: 'absolute', right: -46, bottom: -30, width: 190, height: 190, borderRadius: 95, borderWidth: 14, borderColor: colors.lime, opacity: 0.9, transform: [{ scaleY: 0.78 }, { rotate: '-18deg' }] },
  orbitInner: { position: 'absolute', right: -6, bottom: 8, width: 110, height: 110, borderRadius: 55, borderWidth: 10, borderColor: '#7C78E8' },
  orb: { position: 'absolute', right: 34, bottom: 46, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.apricot },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: space[7], marginBottom: space[3], gap: space[2] },
  notice: { flexDirection: 'row', gap: space[3], borderRadius: radius.control, padding: space[4] },
});
