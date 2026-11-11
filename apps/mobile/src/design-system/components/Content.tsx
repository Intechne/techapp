import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, space, tones, type Tone } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { Card } from './Surface';
import { CircuitArt, circuitArtHeight } from './cards/PosterCard';

/**
 * Detail-screen poster: the same Open Circuit fallback art as PosterCard (type badge + one circuit trace) on the tone
 * ground, with the brand line and the poster line set at the bottom. `brand` is shown as written: organisation names are
 * never upper-cased here, only the category part arrives in capitals.
 */
export function Poster({ tone, icon, brand, line, large }: { tone: Tone; icon: TechIconName; brand: string; line: string; large?: boolean }) {
  const t = tones[tone];
  const inset = large ? space[5] : space[4];
  return (
    <View style={[styles.poster, { backgroundColor: t.bg, minHeight: large ? 196 : 148, padding: inset, paddingTop: inset + circuitArtHeight + space[3] }, large && { borderRadius: radius.card }]}>
      <CircuitArt tone={tone} icon={icon} seed={line} inset={inset} />
      <Text variant="eyebrow" style={{ color: t.fg }} numberOfLines={2}>{brand}</Text>
      <Text variant={large ? 'title' : 'section'} style={{ color: t.fg, maxWidth: '86%', marginTop: space[2] }} numberOfLines={3}>{line}</Text>
    </View>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
          {verified && <TechIcon name="verified" size={16} color={colors.moss} />}
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

const styles = StyleSheet.create({
  poster: { justifyContent: 'flex-end', overflow: 'hidden' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  organizer: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  orgLogo: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
