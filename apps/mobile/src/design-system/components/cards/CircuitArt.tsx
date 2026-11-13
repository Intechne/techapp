import React from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import { radius, space, tones, type Tone } from '../../tokens';
import { TechIcon, type TechIconName } from '../../TechIcon';
import { cardLayout } from './metrics';

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
    <View testID="circuit-art" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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

const styles = StyleSheet.create({
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  trace: { position: 'absolute', flexDirection: 'row' },
});
