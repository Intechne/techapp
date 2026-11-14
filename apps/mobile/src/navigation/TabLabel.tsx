import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Text } from '../design-system/Text';
import { fonts, space, type } from '../design-system/tokens';

/** "Etkinlikler" (the widest tab label) at the 12 pt caption size, measured: 57 dp at font scale 1. */
export const TAB_LABEL_WIDEST_DP = 57;
/** Upper bound for tab label scaling (system font scale beyond this is clamped). */
export const TAB_LABEL_MAX_SCALE = 1.3;
/** Five bottom tabs share the window width; each item pads 5 dp a side and the label reclaims 4 dp of that (marginHorizontal -space[1]) → 2 dp lost per tab. */
const tabLabelWidth = (windowWidth: number) => windowWidth / 5 - 2;

/**
 * Largest font scale the widest label can take without leaving its tab: 1.3 where there is room (≥ 380 dp), less on very
 * narrow windows (320 dp → ≈1.07) so labels scale with the user's setting but are never clipped (1 dp slack, floored to 2 decimals).
 */
export function tabLabelFontScaleCap(windowWidth: number): number {
  const fit = Math.floor(((tabLabelWidth(windowWidth) - 1) / TAB_LABEL_WIDEST_DP) * 100) / 100;
  return Math.max(1, Math.min(TAB_LABEL_MAX_SCALE, fit));
}

interface TabLabelProps { children: string; color: string; focused: boolean; position?: 'below-icon' | 'beside-icon'; width?: number }

/**
 * Accessible name of a tab. A function `tabBarLabel` stops React Navigation from building "Keşfet, tab, 1 of 5" on iOS, so it is
 * spelled out in Turkish there ("Keşfet, sekme, 1/5"). Android keeps the plain label: its tab item already has role `tab`, and TalkBack
 * announces role and position itself, so a spelled-out name would be read twice.
 */
export function tabAccessibilityLabel(label: string, index: number, total: number, os: string): string {
  return os === 'ios' ? `${label}, sekme, ${index + 1}/${total}` : label;
}

/** Bottom tab label that follows the system font scale (accessibility), clamped so five tabs still fit at 320 dp. */
export function TabLabel({ children, color, position, width }: TabLabelProps) {
  const { width: windowWidth } = useWindowDimensions();
  const bottom = position !== 'beside-icon';
  const cap = bottom ? tabLabelFontScaleCap(width ?? windowWidth) : TAB_LABEL_MAX_SCALE;
  return (
    <Text
      numberOfLines={1}
      allowFontScaling
      maxFontSizeMultiplier={cap}
      style={{
        color, fontFamily: fonts.bodySemibold, fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight,
        ...(bottom ? { alignSelf: 'stretch' as const, textAlign: 'center' as const, marginHorizontal: -space[1] } : null),
      }}
    >
      {children}
    </Text>
  );
}
