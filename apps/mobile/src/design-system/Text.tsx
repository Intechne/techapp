import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type, type TypeVariant } from './tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: keyof typeof colors | (string & {});
  center?: boolean;
}

const HEADINGS: TypeVariant[] = ['display', 'title', 'section'];

/** Typography primitive. Dynamic Type is on; headings are capped so critical CTAs stay reachable. */
export function Text({ variant = 'body', color = 'ink', center, style, ...rest }: TextProps) {
  const resolved = (colors as Record<string, string>)[color] ?? color;
  return (
    <RNText
      accessibilityRole={HEADINGS.includes(variant) ? 'header' : rest.accessibilityRole}
      maxFontSizeMultiplier={HEADINGS.includes(variant) ? 1.4 : 1.8}
      {...rest}
      style={[type[variant], { color: resolved }, center && { textAlign: 'center' }, style]}
    />
  );
}
