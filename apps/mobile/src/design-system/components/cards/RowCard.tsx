import React from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, semantic, space, type } from '../../tokens';
import { Text } from '../../Text';
import { TechIcon, type TechIconName } from '../../TechIcon';
import { Tag } from '../Chips';
import type { StatusView } from '../Status';
import { CardBase, CardSkeletonFrame, SkeletonLine } from './CardBase';
import { BookmarkButton } from './BookmarkButton';
import { DEMO_SPOKEN, DEMO_TAG_HEIGHT, DemoTag } from './DemoTag';
import { cardLabel, clipForSpeech, spoken } from './label';
import { cardLayout, cardMetrics } from './metrics';

const sem = semantic.light;

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
 * 46 px tile → title (≤2 lines) + secondary (≤2 lines) + footnote → one trailing element.
 */
export const RowCard = React.memo(function RowCard({ leading, title, secondary, footnote, trailing, isDemo, onPress }: RowCardProps) {
  const status = trailing?.kind === 'status' ? trailing.view : undefined;
  const label = cardLabel([title, clipForSpeech(secondary), footnote, spoken(status?.label), isDemo ? DEMO_SPOKEN : null]);
  const bookmark = trailing?.kind === 'bookmark'
    ? <View style={styles.bookmarkLayer}><BookmarkButton saved={trailing.saved} onToggle={trailing.onToggle} labels={trailing.labels} /></View>
    : undefined;
  return (
    <CardBase label={label} onPress={onPress} accessory={bookmark}>
      <View testID="row-body" style={[styles.body, !!bookmark && styles.bodyWithSave]}>
        <LeadingTile leading={leading} />
        <View style={styles.text}>
          <Text variant="cardTitle" numberOfLines={2}>{title}</Text>
          {!!secondary && <Text variant="bodySmall" color={sem.text.secondary} numberOfLines={2} style={styles.secondary}>{secondary}</Text>}
          {(!!footnote || isDemo) && (
            <View style={styles.footRow}>
              {isDemo && <DemoTag />}
              {!!footnote && <Text variant="caption" color={sem.text.secondary} style={[styles.footnote, isDemo && styles.footnoteBesideTag]}>{footnote}</Text>}
            </View>
          )}
        </View>
        {trailing?.kind === 'chevron' && <View style={styles.chevron}><TechIcon name="chevron" size={18} color={sem.text.secondary} /></View>}
        {status && <View style={styles.status}><Tag label={status.label} tone={status.tone} icon={status.icon} /></View>}
      </View>
    </CardBase>
  );
});

/** Loading state of RowCard: same padding, same tile, title / secondary / footnote bars in their real line boxes. */
export function RowCardSkeleton() {
  return (
    <CardSkeletonFrame testID="row-skeleton">
      <View testID="row-body" style={styles.body}>
        <View style={[styles.tile, { backgroundColor: sem.bg.sunken }]} />
        <View style={styles.text}>
          <SkeletonLine lineHeight={type.cardTitle.lineHeight} width="72%" />
          <View style={styles.secondary}><SkeletonLine lineHeight={type.bodySmall.lineHeight} width="88%" /></View>
          <View style={styles.footSkeleton}><SkeletonLine lineHeight={type.caption.lineHeight} width="44%" /></View>
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
  secondary: { marginTop: space[1] / 2 },
  footSkeleton: { marginTop: space[2] },
  // ÖRNEK stays on the footnote's first line; a long footnote wraps in its own column beside it.
  footRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2], marginTop: space[2] },
  footnote: { flex: 1, fontVariant: ['tabular-nums'] },
  footnoteBesideTag: { paddingTop: (DEMO_TAG_HEIGHT - type.caption.lineHeight) / 2 },
  chevron: { alignSelf: 'center' },
  status: { alignSelf: 'center', maxWidth: '42%' },
  bookmarkLayer: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'box-none', alignItems: 'flex-end', justifyContent: 'center',
    paddingRight: cardLayout.pad - BOOKMARK_GLYPH_INSET,
  },
});
