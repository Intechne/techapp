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
  // The markup carries role="presentation" (the glyph itself is never the accessible node); the wrapper props below decide hidden vs labelled image.
  // No aria-hidden in the markup: react-native-svg camelCases it to `ariaHidden` on the DOM <svg> (React warning). The wrapper props below hide decorative icons.
  const xml = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" role="presentation" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${((filled && iconFillPaths[name]) || iconPaths[name]).replaceAll('currentColor', color)}</svg>`,
    [name, color, filled],
  );
  // Labelled icons stay exposed as images. Decorative ones are hidden from screen readers on every target:
  // native props are not valid DOM attributes on web, where react-native-web maps `aria-hidden` instead.
  const a11y = accessibilityLabel
    ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel } as const)
    : Platform.OS === 'web'
      ? ({ 'aria-hidden': true } as const)
      : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
  // Keyed by fill state: react-native-svg (Android) keeps a path's old fill when the attribute disappears, so a saved bookmark that is
  // un-saved would stay a solid glyph. A fresh native view per state draws exactly the markup it is given.
  return <SvgXml key={filled ? 'filled' : 'outline'} xml={xml} width={size} height={size} {...a11y} />;
}
