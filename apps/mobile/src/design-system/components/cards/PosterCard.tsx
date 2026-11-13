import React from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, semantic, space, type, type Tone } from '../../tokens';
import { Text } from '../../Text';
import type { TechIconName } from '../../TechIcon';
import { Tag } from '../Chips';
import { CoverImage } from '../CoverImage';
import type { StatusView } from '../Status';
import { CardBase, CardSkeletonFrame, SkeletonLine } from './CardBase';
import { BookmarkButton } from './BookmarkButton';
import { DEMO_SPOKEN, DemoTag } from './DemoTag';
import { cardLabel, keepNumbersTogether, keepTogether, metaJoin, spoken } from './label';
import { cardLayout, cardMetrics } from './metrics';

export { CircuitArt, circuitArtHeight } from './CircuitArt';

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
  /** Storage path + blurhash of the cover; the list shows the 640 px copy. No path (or a failed load) = the fallback poster. */
  cover: { path: string | null; blurhash: string | null };
  /** Open Circuit poster used when there is no (loadable) cover: tone ground, type badge, circuit trace, poster line. */
  fallback: { tone: Tone; icon: TechIconName; line: string };
  isDemo?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
  onPress: () => void;
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
      <CoverImage testID="poster-cover" path={p.cover.path} blurhash={p.cover.blurhash} size="thumb" aspect={cardMetrics.poster.coverAspect} fallback={p.fallback} />
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
