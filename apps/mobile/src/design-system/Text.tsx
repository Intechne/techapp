import React from 'react';
import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type, type TypeVariant } from './tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: keyof typeof colors | (string & {});
  center?: boolean;
  /**
   * `words`: wrap only between words. Android's default line breaker hyphenates and splits long words ("Doğrulanmı/ş",
   * "Orbit Robotiğ/i"); this selects `textBreakStrategy="simple"` and turns hyphenation off. Set on names (person, team,
   * organisation titles) and short labels (segments, tags, tab labels); running prose keeps the default. A single word
   * wider than the line still breaks, there is nowhere else to go. No effect on iOS or web.
   */
  breakStrategy?: 'words';
}

const HEADINGS: TypeVariant[] = ['display', 'title', 'section'];

/** Typography primitive. Dynamic Type is on; headings are capped so critical CTAs stay reachable. */
export function Text({ variant = 'body', color = 'ink', center, breakStrategy, style, ...rest }: TextProps) {
  const resolved = (colors as Record<string, string>)[color] ?? color;
  const android = breakStrategy === 'words' && Platform.OS === 'android'
    ? { textBreakStrategy: 'simple' as const, android_hyphenationFrequency: 'none' as const }
    : null;
  // Web: an unbroken word longer than the line (a very long name) wraps instead of running off the screen.
  const web = breakStrategy === 'words' && Platform.OS === 'web' ? ({ overflowWrap: 'anywhere' } as object) : null;
  return (
    <RNText
      {...android}
      accessibilityRole={HEADINGS.includes(variant) ? 'header' : rest.accessibilityRole}
      maxFontSizeMultiplier={HEADINGS.includes(variant) ? 1.4 : 1.8}
      {...rest}
      style={[type[variant], { color: resolved }, center && { textAlign: 'center' }, web, style]}
    />
  );
}
