import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, space, tones, type Tone } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { Card } from './Surface';
import { Tag } from './Chips';
import { IconButton } from './Button';

/** Typographic poster: TechApp content never depends on stock imagery to look finished. */
export function Poster({ tone, brand, line, large }: { tone: Tone; brand: string; line: string; large?: boolean }) {
  const t = tones[tone];
  return (
    <View style={[styles.poster, { backgroundColor: t.bg, height: large ? 196 : 148 }, large && { borderRadius: radius.card }]}>
      <View style={[styles.posterArt, { borderColor: t.fg }]} />
      <Text variant="eyebrow" style={{ color: t.fg }} numberOfLines={1}>{brand}</Text>
      <Text variant={large ? 'title' : 'section'} style={{ color: t.fg, maxWidth: '82%' }} numberOfLines={3}>{line}</Text>
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

export interface EventCardModel {
  id: string; title: string; posterLine: string; tone: Tone; typeLabel: string; organizer: string;
  dateLabel: string; placeLabel: string; audienceLabel: string; feeLabel: string; availability?: { label: string; tone: 'moss' | 'apricot' | 'danger' };
}

export const EventCard = React.memo(function EventCard({ model, saved, onPress, onToggleSave }: { model: EventCardModel; saved?: boolean; onPress: () => void; onToggleSave?: () => void }) {
  return (
    <Card padded={false} onPress={onPress} accessibilityLabel={`${model.title}. ${model.dateLabel}, ${model.placeLabel}. ${model.availability?.label ?? ''}`}>
      <Poster tone={model.tone} brand={`${model.organizer.toLocaleUpperCase('tr')} / ${model.typeLabel}`} line={model.posterLine} />
      <View style={{ padding: space[4], gap: space[2] }}>
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', flex: 1 }}>
            <Tag label={model.typeLabel} />
            {model.availability && <Tag label={model.availability.label} tone={model.availability.tone} />}
          </View>
          {onToggleSave && <IconButton icon="bookmark" filled={saved} color={saved ? colors.primary : colors.ink} accessibilityLabel={saved ? 'Kaydı kaldır' : 'Kaydet'} onPress={onToggleSave} />}
        </View>
        <Text variant="cardTitle">{model.title}</Text>
        <MetadataRow icon="event">{model.dateLabel} · {model.placeLabel}</MetadataRow>
        <MetadataRow icon="community">{model.audienceLabel} · {model.feeLabel}</MetadataRow>
      </View>
    </Card>
  );
});

export function MiniCard({ icon, title, body, onPress }: { icon: TechIconName; title: string; body: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={{ flex: 1, minHeight: 136, gap: space[2], borderRadius: 19 }}>
      <View style={styles.orgLogo}><TechIcon name={icon} color={colors.primary} /></View>
      <Text variant="label">{title}</Text>
      <Text variant="caption" color="textSecondary">{body}</Text>
    </Card>
  );
}

export function ListCard({ icon, title, body, footnote, onPress }: { icon: TechIconName; title: string; body?: string; footnote?: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start', borderRadius: 19 }}>
      <View style={styles.orgLogo}><TechIcon name={icon} color={colors.primary} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="cardTitle">{title}</Text>
        {body && <Text variant="bodySmall" color="textSecondary">{body}</Text>}
        {footnote && <Text variant="caption" color="textSecondary" style={{ marginTop: space[1] }}>{footnote}</Text>}
      </View>
      {onPress && <TechIcon name="chevron" size={18} color={colors.textSecondary} />}
    </Card>
  );
}
/** Same anatomy, different semantics: kept as named exports so screens read clearly. */
export const OpportunityCard = ListCard;
export const CommunityCard = ListCard;
export const TeamCard = ListCard;

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
  poster: { padding: space[4], justifyContent: 'space-between', overflow: 'hidden' },
  posterArt: { position: 'absolute', right: -14, top: 22, width: 112, height: 112, borderWidth: 18, borderRadius: 30, opacity: 0.17, transform: [{ rotate: '-25deg' }] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], minHeight: 28 },
  organizer: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  orgLogo: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
