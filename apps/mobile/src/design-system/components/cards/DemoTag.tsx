import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, semantic, space } from '../../tokens';
import { Text } from '../../Text';

const sem = semantic.light;

/** The single source of the "ÖRNEK" mark. Names in seed data may say "(örnek)"; code never adds it to a name. */
export const DEMO_LABEL = 'ÖRNEK';
/** Spoken at the end of a card label when the content is demo data. */
export const DEMO_SPOKEN = 'Örnek içerik';

/** Outlined, quiet: demo is provenance, not a status, so it never competes with availability tags. */
export function DemoTag() {
  return (
    <View style={styles.tag}>
      <Text variant="eyebrow" color={sem.text.secondary} maxFontSizeMultiplier={1.4}>{DEMO_LABEL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1, borderColor: sem.border.strong, borderRadius: radius.small,
    paddingHorizontal: space[2], paddingVertical: space[1] / 2,
  },
});
