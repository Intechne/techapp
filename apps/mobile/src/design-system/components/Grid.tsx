import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '../tokens';
import { useLayout } from '../useLayout';

/** Lays children out in 1–4 equal columns depending on the size class. On phones it is a plain vertical stack. */
export function ResponsiveGrid({ children, gap = space[3], maxColumns = 4, style }: { children: React.ReactNode; gap?: number; maxColumns?: number; style?: StyleProp<ViewStyle> }) {
  const { columns } = useLayout();
  const n = Math.min(columns, maxColumns);
  const items = React.Children.toArray(children);
  if (n === 1) return <View style={[{ gap }, style]}>{items}</View>;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2, rowGap: gap }, style]}>
      {items.map((child, i) => <View key={i} style={{ width: `${100 / n}%`, paddingHorizontal: gap / 2 }}>{child}</View>)}
    </View>
  );
}

/** Centers content and caps its width on large screens. `reading` uses the narrower, text-friendly limit (forms, details). */
export function ContentWidth({ children, reading, style }: { children: React.ReactNode; reading?: boolean; style?: StyleProp<ViewStyle> }) {
  const { contentMaxWidth, readingMaxWidth } = useLayout();
  return <View style={[{ width: '100%', maxWidth: reading ? readingMaxWidth : contentMaxWidth, alignSelf: 'center' }, style]}>{children}</View>;
}
