import React from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import { layout, radius, semantic, space, tones, type, type Tone } from '../../tokens';
import { Text } from '../../Text';
import { TechIcon, type TechIconName } from '../../TechIcon';
import { Tag } from '../Chips';
import type { StatusView } from '../Status';
import { CardBase, CardSkeletonFrame, SkeletonLine } from './CardBase';
import { BookmarkButton } from './BookmarkButton';
import { DEMO_SPOKEN, DemoTag } from './DemoTag';
import { cardLabel, keepNumbersTogether, keepTogether, metaJoin, spoken } from './label';
import { cardLayout, cardMetrics } from './metrics';

const sem = semantic.light;

export interface PosterCardProps {
  title: string;
  /** Category in capitals (eyebrow role), e.g. "HACKATHON". */
  typeLabel: string;
  availability?: StatusView;
  dateLabel: string;
  placeLabel: string;
  audienceLabel?: string;
  feeLabel?: string;
  /** Storage path + blurhash of the cover. Rendered once expo-image lands (Faz 3b Task 4); until then the fallback shows. */
  cover: { path: string | null; blurhash: string | null };
  /** Open Circuit poster used when there is no (loadable) cover: tone ground, type badge, circuit trace, poster line. */
  fallback: { tone: Tone; icon: TechIconName; line: string };
  isDemo?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
  onPress: () => void;
}

/**
 * Trace variants (right inset of the elbow × drop), picked from the poster line so neighbouring cards do not repeat the
 * same drawing. Drops stay within `circuitArtHeight`.
 */
const TRACES: { right: DimensionValue; drop: number }[] = [
  { right: '44%', drop: space[6] }, { right: '18%', drop: space[4] }, { right: '30%', drop: space[6] },
  { right: '52%', drop: space[4] }, { right: '24%', drop: space[6] },
];
const pick = (seed: string) => TRACES[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TRACES.length]!;

/**
 * Fallback art, the Open Circuit signature at poster scale: the content type's icon sits in a ring (a circuit pad), one
 * trace leaves it, turns once and ends in a node. Tone ground + the poster line set in Manrope carry the rest.
 * Fills its parent (absolute layers); the parent decides the size.
 */
/** Height of the drawing below the inset (badge centre → trace drop → node), for layouts that must keep text clear of it. */
export const circuitArtHeight = cardLayout.badge / 2 - cardLayout.trace / 2 + space[6] + cardLayout.trace + cardLayout.node / 2;

export function CircuitArt({ tone, icon, seed, inset = cardLayout.pad }: { tone: Tone; icon: TechIconName; seed: string; inset?: number }) {
  const fg = tones[tone].fg;
  const B = cardLayout.badge, T = cardLayout.trace, N = cardLayout.node, R = radius.control;
  const variant = pick(seed);
  const drop = variant.drop + T;
  return (
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.badge, { top: inset, left: inset, width: B, height: B, borderRadius: B / 2, borderWidth: T, borderColor: fg }]}>
        <TechIcon name={icon} size={22} color={fg} />
      </View>
      <View style={[styles.trace, { top: inset + B / 2 - T / 2, left: inset + B, right: variant.right }]}>
        <View style={{ flex: 1, height: T, backgroundColor: fg }} />
        <View style={{ width: R, height: drop + N / 2 }}>
          <View style={{ width: R, height: R, borderTopWidth: T, borderRightWidth: T, borderTopRightRadius: R, borderColor: fg }} />
          <View style={{ alignSelf: 'flex-end', width: T, height: drop - R, backgroundColor: fg }} />
          <View style={{ alignSelf: 'flex-end', marginRight: (T - N) / 2, marginTop: -N / 2, width: N, height: N, borderRadius: N / 2, backgroundColor: fg }} />
        </View>
      </View>
    </View>
  );
}

function Cover({ fallback }: Pick<PosterCardProps, 'cover' | 'fallback'>) {
  // expo-image arrives in Faz 3b Task 4: it will render `cover.path` (with `cover.blurhash` as placeholder) above this
  // fallback and drop back to it on error. Same box either way, so a missing or broken cover never changes the height.
  const t = tones[fallback.tone];
  return (
    <View testID="poster-cover" style={[styles.cover, { backgroundColor: t.bg }]}>
      <CircuitArt tone={fallback.tone} icon={fallback.icon} seed={fallback.line} />
      <Text variant="section" numberOfLines={3} style={[styles.coverLine, { color: t.fg }]}>{fallback.line}</Text>
    </View>
  );
}

/** Event / course card: 16:10 cover → status row (type, availability, ÖRNEK, save) → title (≤3 lines, one reserved) → two meta lines. */
export const PosterCard = React.memo(function PosterCard(p: PosterCardProps) {
  // Everything visible is spoken, in reading order after the title: type, date, place, audience, fee, availability, demo.
  const label = cardLabel([p.title, spoken(p.typeLabel), p.dateLabel, p.placeLabel, p.audienceLabel, p.feeLabel, spoken(p.availability?.label), p.isDemo ? DEMO_SPOKEN : null]);
  const second = metaJoin([p.audienceLabel, p.feeLabel]);
  const bookmark = p.onToggleSave
    ? (
      <View style={styles.bookmarkLayer}>
        <View style={styles.coverSpacer} />
        <View style={styles.bookmarkRow}><BookmarkButton saved={!!p.saved} onToggle={p.onToggleSave} /></View>
      </View>
    )
    : undefined;
  return (
    <CardBase label={label} onPress={p.onPress} accessory={bookmark}>
      <Cover cover={p.cover} fallback={p.fallback} />
      <View testID="poster-body" style={styles.body}>
        <View style={[styles.status, !!p.onToggleSave && styles.statusWithSave]}>
          <Text variant="eyebrow" color={sem.action.primary}>{p.typeLabel}</Text>
          {p.availability && <Tag label={keepTogether(p.availability.label)} tone={p.availability.tone} icon={p.availability.icon} />}
          {p.isDemo && <DemoTag />}
        </View>
        <Text variant="cardTitle" breakStrategy="words" numberOfLines={3} style={styles.title}>{p.title}</Text>
        <Text testID="poster-meta" variant="caption" numberOfLines={2} style={styles.metaStrong}>{keepNumbersTogether(metaJoin([p.dateLabel, p.placeLabel]))}</Text>
        {!!second && <Text testID="poster-meta" variant="caption" color={sem.text.secondary} numberOfLines={2} style={styles.metaSecond}>{keepNumbersTogether(second)}</Text>}
      </View>
    </CardBase>
  );
});

/** Loading state of PosterCard: same cover box, same body box (one title line reserved), bars sitting in the real line boxes. */
export function PosterCardSkeleton() {
  return (
    <CardSkeletonFrame testID="poster-skeleton">
      <View testID="poster-cover" style={[styles.cover, { backgroundColor: sem.bg.sunken }]} />
      <View testID="poster-body" style={styles.body}>
        <View style={styles.status}><SkeletonLine lineHeight={cardLayout.statusRow} width="28%" barHeight={type.eyebrow.lineHeight} /></View>
        <View style={styles.title}>
          <SkeletonLine lineHeight={type.cardTitle.lineHeight} width="82%" />
        </View>
        <View style={styles.metaStrong}><SkeletonLine lineHeight={type.caption.lineHeight} width="64%" /></View>
        <View style={styles.metaSecond}><SkeletonLine lineHeight={type.caption.lineHeight} width="46%" /></View>
      </View>
    </CardSkeletonFrame>
  );
}

const BOOKMARK_GLYPH_INSET = (layout.touchTarget - 22) / 2;

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: cardMetrics.poster.coverAspect, overflow: 'hidden' },
  coverLine: { position: 'absolute', left: cardLayout.pad, bottom: cardLayout.pad, maxWidth: '82%' },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  trace: { position: 'absolute', flexDirection: 'row' },
  body: { padding: cardLayout.pad, minHeight: cardMetrics.poster.bodyMinHeight },
  status: { minHeight: cardLayout.statusRow, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[2], rowGap: space[1] },
  // Keeps tags clear of the 44 px bookmark, whose glyph lines up with the body's right edge.
  statusWithSave: { paddingRight: layout.touchTarget - BOOKMARK_GLYPH_INSET + space[1] },
  title: { marginTop: cardLayout.titleGap },
  metaStrong: { marginTop: cardLayout.metaGap, color: sem.text.primary, fontVariant: ['tabular-nums'] },
  metaSecond: { marginTop: cardLayout.metaLineGap, fontVariant: ['tabular-nums'] },
  bookmarkLayer: { pointerEvents: 'box-none' },
  coverSpacer: { width: '100%', aspectRatio: cardMetrics.poster.coverAspect, pointerEvents: 'none' },
  bookmarkRow: {
    pointerEvents: 'box-none', alignItems: 'flex-end',
    paddingTop: cardLayout.pad + (cardLayout.statusRow - layout.touchTarget) / 2, paddingRight: cardLayout.pad - BOOKMARK_GLYPH_INSET,
  },
});
