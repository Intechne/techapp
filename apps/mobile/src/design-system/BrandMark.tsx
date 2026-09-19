import React from 'react';
import { Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { brandMarkXml } from './brandMark.generated';

/** The TechApp emblem (tilted tile with the "T." punched through). Decorative: the wordmark next to it carries the name. */
export function BrandMark({ size = 28 }: { size?: number }) {
  const hidden = Platform.OS === 'web' ? {} : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const);
  return <SvgXml xml={brandMarkXml} width={size} height={size} {...hidden} />;
}
