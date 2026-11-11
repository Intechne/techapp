import React from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, semantic, space, type } from '../../tokens';
import { Text } from '../../Text';
import { TechIcon, type TechIconName } from '../../TechIcon';
import { Tag } from '../Chips';
import type { StatusView } from '../Status';
import { CardBase, CardSkeletonFrame, SkeletonLine } from './CardBase';
import { BookmarkButton } from './BookmarkButton';
import { DEMO_SPOKEN, DemoTag } from './DemoTag';
import { useLayout } from '../../useLayout';
import { cardLabel, clipForSpeech, keepNumbersTogether, keepTogether, spoken } from './label';
import { cardLayout, cardMetrics, rowCardHeight, type RowLines } from './metrics';

const sem = semantic.light;

/** Window width (dp) under which a trailing status moves below the text. */
const STACK_STATUS_BELOW = 360;

export type RowCardLeading =
  | { kind: 'icon'; icon: TechIconName }
  /** Logo / cover thumb. Rendered once expo-image lands (Faz 3b Task 4); until then the fallback icon tile shows. */
  | { kind: 'image'; path: string | null; fallbackIcon: TechIconName };

/** One trailing slot, one meaning: navigate, show a status, or save. */
export type RowCardTrailing =
  | { kind: 'chevron' }
  | { kind: 'status'; view: StatusView }
  | { kind: 'bookmark'; saved: boolean; onToggle: () => void; labels?: { save: string; unsave: string } };

export interface RowCardProps {
  leading: RowCardLeading;
  title: string;
  secondary?: string;
  footnote?: string;
  /** Small status tag leading the footnote row (a deadline: "SON 3 GÜN"). The trailing slot stays free for save / chevron. */
  footnoteTag?: StatusView;
  trailing?: RowCardTrailing;
  isDemo?: boolean;
  onPress?: () => void;
}

function LeadingTile({ leading }: { leading: RowCardLeading }) {
  const icon = leading.kind === 'icon' ? leading.icon : leading.fallbackIcon;
  return <View style={styles.tile}><TechIcon name={icon} color={sem.action.primary} /></View>;
}

/**
 * Opportunity, team, organisation, registration, application, notification, search result.
 * 46 px tile → title (≤2 lines) + secondary (≤2 lines) + footnote row ([tag] text) → one trailing element.
 * Footnote: the tag (deadline) on its own tag row, the footnote text below — stacked, so the height is predictable.
 * ÖRNEK (family rule) joins a tag-only row — PosterCard's status row, RowCard's footnote tag row — or, when the card
 * has none, gets its own last line; it never sits beside wrapping text. Numbers never break away from their unit.
 */
export const RowCard = React.memo(function RowCard({ leading, title, secondary, footnote, footnoteTag, trailing, isDemo, onPress }: RowCardProps) {
  const { width } = useLayout();
  const status = trailing?.kind === 'status' ? trailing.view : undefined;
  // 320 px phones: a status in the trailing slot leaves the text ~80 px and breaks its words, so it moves under the text.
  const stacked = !!status && width < STACK_STATUS_BELOW;
  const label = cardLabel([title, clipForSpeech(secondary), spoken(footnoteTag?.label), footnote, spoken(status?.label), isDemo ? DEMO_SPOKEN : null]);
  const bookmark = trailing?.kind === 'bookmark'
    ? <View style={styles.bookmarkLayer}><BookmarkButton saved={trailing.saved} onToggle={trailing.onToggle} labels={trailing.labels} /></View>
    : undefined;
  return (
    <CardBase label={label} onPress={onPress} accessory={bookmark}>
      <View testID="row-body" style={[styles.body, !!bookmark && styles.bodyWithSave]}>
        <LeadingTile leading={leading} />
        <View style={styles.text}>
          <Text variant="cardTitle" numberOfLines={2}>{title}</Text>
          {!!secondary && <Text testID="row-secondary" variant="bodySmall" color={sem.text.secondary} numberOfLines={2} style={styles.secondary}>{keepNumbersTogether(secondary)}</Text>}
          {(!!footnote || !!footnoteTag) && (
            <View testID="row-foot" style={styles.foot}>
              {footnoteTag && (
                <View style={styles.tagRow}>
                  <Tag label={keepTogether(footnoteTag.label)} tone={footnoteTag.tone} icon={footnoteTag.icon} />
                  {isDemo && <DemoTag />}
                </View>
              )}
              {!!footnote && <Text testID="row-footnote" variant="caption" color={sem.text.secondary} numberOfLines={2} style={styles.footnote}>{keepNumbersTogether(footnote)}</Text>}
            </View>
          )}
          {stacked && status && <View style={styles.demoLine}><Tag label={keepNumbersTogether(status.label)} tone={status.tone} icon={status.icon} /></View>}
          {isDemo && !footnoteTag && <View style={styles.demoLine}><DemoTag /></View>}
        </View>
        {trailing?.kind === 'chevron' && <View style={styles.chevron}><TechIcon name="chevron" size={18} color={sem.text.secondary} /></View>}
        {status && !stacked && <View style={styles.status}><Tag label={keepNumbersTogether(status.label)} tone={status.tone} icon={status.icon} /></View>}
      </View>
    </CardBase>
  );
});

/** Default skeleton shape: one-line title and secondary, no footnote. Lists pass their own typical row shape. */
const DEFAULT_ROW_LINES: RowLines = { title: 1, secondary: 1, footnote: 'none' };
const TITLE_BARS = ['78%', '52%'] as const;
const SECONDARY_BARS = ['92%', '64%'] as const;

/**
 * Loading state of RowCard, shaped like the list's typical row (`lines`): same padding and tile, one bar per text line in
 * the real line boxes, and the same gaps. Its height is `rowCardHeight(lines)`.
 */
export function RowCardSkeleton({ lines = DEFAULT_ROW_LINES }: { lines?: RowLines }) {
  return (
    <CardSkeletonFrame testID="row-skeleton">
      <View testID="row-body" style={[styles.body, { minHeight: rowCardHeight(lines) }]}>
        <View style={[styles.tile, { backgroundColor: sem.bg.sunken }]} />
        <View style={styles.text}>
          {TITLE_BARS.slice(0, lines.title).map((w) => <SkeletonLine key={w} lineHeight={type.cardTitle.lineHeight} width={w} />)}
          {lines.secondary > 0 && (
            <View style={styles.secondary}>
              {SECONDARY_BARS.slice(0, lines.secondary).map((w) => <SkeletonLine key={w} lineHeight={type.bodySmall.lineHeight} width={w} />)}
            </View>
          )}
          {lines.footnote !== 'none' && (
            <View style={styles.foot}>
              {lines.footnote === 'tag' && <SkeletonLine lineHeight={cardLayout.tag} width="44%" barHeight={cardLayout.tag} />}
              <SkeletonLine lineHeight={type.caption.lineHeight} width="56%" />
            </View>
          )}
          {lines.demo && lines.footnote !== 'tag' && <View style={styles.demoLine}><SkeletonLine lineHeight={cardLayout.demoTag} width="24%" barHeight={cardLayout.demoTag} /></View>}
        </View>
      </View>
    </CardSkeletonFrame>
  );
}

const BOOKMARK_GLYPH_INSET = (layout.touchTarget - 22) / 2;

const styles = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: cardLayout.pad, minHeight: cardMetrics.row.minHeight },
  // Text stays clear of the bookmark's whole 44 px target, not just its glyph.
  bodyWithSave: { paddingRight: layout.touchTarget + cardLayout.pad - BOOKMARK_GLYPH_INSET + space[1] },
  tile: {
    width: cardLayout.leadingTile, height: cardLayout.leadingTile, borderRadius: radius.control,
    backgroundColor: sem.action.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  secondary: { marginTop: cardLayout.secondaryGap },
  foot: { marginTop: cardLayout.footGap, gap: cardLayout.footTagGap },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  footnote: { fontVariant: ['tabular-nums'] },
  demoLine: { flexDirection: 'row', marginTop: cardLayout.footGap },
  chevron: { alignSelf: 'center' },
  status: { alignSelf: 'center', maxWidth: '42%' },
  bookmarkLayer: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'box-none', alignItems: 'flex-end', justifyContent: 'center',
    paddingRight: cardLayout.pad - BOOKMARK_GLYPH_INSET,
  },
});
