import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { colors } from './tokens';
import { iconPaths, type TechIconName } from './icons.generated';

export type { TechIconName };

interface Props {
  name: TechIconName;
  size?: number;
  color?: string;
  /** Filled variant for toggled states (e.g. saved bookmark). */
  filled?: boolean;
}

/** The single icon API. 24×24 grid, 1.75 stroke, round caps/joins. Decorative by default. */
export function TechIcon({ name, size = 24, color = colors.ink, filled = false }: Props) {
  const xml = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`,
    [name, color, filled],
  );
  return <SvgXml xml={xml} width={size} height={size} accessibilityElementsHidden importantForAccessibility="no" />;
}
