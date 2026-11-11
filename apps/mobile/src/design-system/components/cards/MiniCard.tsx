import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, semantic, space } from '../../tokens';
import { Text } from '../../Text';
import { TechIcon, type TechIconName } from '../../TechIcon';
import { CardBase } from './CardBase';
import { cardLabel, clipForSpeech } from './label';
import { cardLayout, cardMetrics } from './metrics';

const sem = semantic.light;

export interface MiniCardProps { icon: TechIconName; title: string; body?: string; onPress?: () => void }

/** Keşfet rails (team, course): two per row, fixed minimum height, title and body two lines each. Grows to the row's height. */
export function MiniCard({ icon, title, body, onPress }: MiniCardProps) {
  return (
    <CardBase label={cardLabel([title, clipForSpeech(body)])} onPress={onPress} style={styles.frame}>
      <View testID="mini-body" style={styles.body}>
        <View style={styles.tile}><TechIcon name={icon} color={sem.action.primary} /></View>
        <Text variant="cardTitle" numberOfLines={2} style={styles.title}>{title}</Text>
        {!!body && <Text variant="caption" color={sem.text.secondary} numberOfLines={2} style={styles.text}>{body}</Text>}
      </View>
    </CardBase>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  body: { flexGrow: 1, padding: cardLayout.pad, minHeight: cardMetrics.mini.minHeight },
  tile: {
    width: cardLayout.leadingTile, height: cardLayout.leadingTile, borderRadius: radius.control,
    backgroundColor: sem.action.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  title: { marginTop: space[3] },
  text: { marginTop: space[1] },
});
