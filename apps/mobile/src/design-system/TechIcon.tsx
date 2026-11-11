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
  /** When set the icon carries meaning on its own (role image); otherwise it is decorative and hidden from assistive tech. */
  accessibilityLabel?: string;
}

/** The single icon API. Open Circuit v2: 24×24 grid, 1.75 stroke, round caps/joins. Decorative by default. */
export function TechIcon({ name, size = 24, color = colors.ink, filled = false, accessibilityLabel }: Props) {
  // Web renders this SVG as DOM: only decorative icons carry aria-hidden in the markup, labelled ones must stay exposed.
  const hiddenAttr = accessibilityLabel ? '' : ' aria-hidden="true"';
  const xml = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg"${hiddenAttr} viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${((filled && iconFillPaths[name]) || iconPaths[name]).replaceAll('currentColor', color)}</svg>`,
    [name, color, filled, hiddenAttr],
  );
  // Labelled icons stay exposed as images. Decorative ones are hidden from screen readers on every target:
  // native props are not valid DOM attributes on web, where react-native-web maps `aria-hidden` instead.
  const a11y = accessibilityLabel
    ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel } as const)
    : Platform.OS === 'web'
      ? ({ 'aria-hidden': true } as const)
      : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
  return <SvgXml xml={xml} width={size} height={size} {...a11y} />;
}
