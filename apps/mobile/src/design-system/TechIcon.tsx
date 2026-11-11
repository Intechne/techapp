import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from './tokens';
import { iconFillPaths, iconPaths, type TechIconName } from './icons.generated';

export type { TechIconName };

interface Props {
  name: TechIconName;
  size?: number;
  color?: string;
  /** Active/selected state (focused tab, saved bookmark). Falls back to the outline when an icon has no fill state. */
  filled?: boolean;
}

/** The single icon API. Open Circuit v2: 24×24 grid, 1.75 stroke, round caps/joins. Decorative by default. */
export function TechIcon({ name, size = 24, color = colors.ink, filled = false }: Props) {
  const xml = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${((filled && iconFillPaths[name]) || iconPaths[name]).replaceAll('currentColor', color)}</svg>`,
    [name, color, filled],
  );
  // Decorative: hidden from screen readers (native props are not valid DOM attributes on the dev web target).
  const hidden = Platform.OS === 'web' ? {} : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const);
  return <SvgXml xml={xml} width={size} height={size} {...hidden} />;
}
