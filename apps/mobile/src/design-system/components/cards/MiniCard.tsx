import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { radius, semantic, space } from '../../tokens';
import { Text } from '../../Text';
import { TechIcon, type TechIconName } from '../../TechIcon';
import { CardBase } from './CardBase';
import { cardLabel, clipForSpeech, keepNumbersTogether } from './label';
import { MINI_SINGLE_COLUMN_BELOW, MINI_SINGLE_COLUMN_FONT_SCALE, cardLayout, cardMetrics } from './metrics';

const sem = semantic.light;

export interface MiniCardProps { icon: TechIconName; title: string; body?: string; onPress?: () => void }

/** Keşfet rails (team, course): two per row, fixed minimum height, title and body two lines each. Grows to the row's height. */
export function MiniCard({ icon, title, body, onPress }: MiniCardProps) {
  return (
    <CardBase label={cardLabel([title, clipForSpeech(body)])} onPress={onPress} style={styles.frame}>
      <View testID="mini-body" style={styles.body}>
        <View style={styles.tile}><TechIcon name={icon} color={sem.action.primary} /></View>
        <Text variant="cardTitle" breakStrategy="words" numberOfLines={2} style={styles.title}>{title}</Text>
        {!!body && <Text variant="caption" color={sem.text.secondary} numberOfLines={2} style={styles.text}>{keepNumbersTogether(body)}</Text>}
      </View>
    </CardBase>
  );
}

/** One column when two cards no longer fit a readable line: a narrow window (< 360 dp) or large text (font scale ≥ 1.5). */
export function miniColumns(width: number, fontScale: number): 1 | 2 {
  return width < MINI_SINGLE_COLUMN_BELOW || fontScale >= MINI_SINGLE_COLUMN_FONT_SCALE ? 1 : 2;
}

/**
 * Lays MiniCards out in pairs (equal-height cells, an odd last card keeps its half width) and drops to one full-width
 * column on narrow windows or at large font scale (approved Q13). Screens never decide the column count themselves.
 */
export function MiniCardGrid({ children }: { children: React.ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  const items = React.Children.toArray(children);
  const n = miniColumns(width, fontScale);
  const rows = Array.from({ length: Math.ceil(items.length / n) }, (_, i) => items.slice(i * n, i * n + n));
  return (
    <View testID="mini-grid" style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} testID="mini-row" style={styles.pair}>
          {row.map((child, j) => <View key={j} style={styles.cell}>{child}</View>)}
          {n === 2 && row.length === 1 && <View style={styles.cell} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space[3] },
  pair: { flexDirection: 'row', gap: space[3], alignItems: 'stretch' },
  cell: { flex: 1, minWidth: 0 },
  frame: { flex: 1 },
  body: { flexGrow: 1, padding: cardLayout.pad, minHeight: cardMetrics.mini.minHeight },
  tile: {
    width: cardLayout.leadingTile, height: cardLayout.leadingTile, borderRadius: radius.control,
    backgroundColor: sem.action.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  title: { marginTop: space[3] },
  text: { marginTop: space[1] },
});
