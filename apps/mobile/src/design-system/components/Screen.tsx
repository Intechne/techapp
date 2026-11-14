import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, space } from '../tokens';
import { Text } from '../Text';
import { IconButton } from './Button';
import { BrandMark } from '../BrandMark';
import { useLayout } from '../useLayout';
import { useKeyboardOverlap } from '../useKeyboardOverlap';
import { useToastFooterInset } from './Overlays';

interface ScreenProps extends ScrollViewProps {
  header?: React.ReactNode;
  /** Pinned below the scroll area (primary CTA). Stays visible with large fonts and the keyboard. */
  footer?: React.ReactNode;
  scroll?: boolean;
  /** Grid/list screens may use the wide content limit on tablets and TVs; default is the narrower reading width. */
  wide?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

/** Page scaffold: safe areas, gutter, keyboard avoidance, optional pull-to-refresh and sticky footer. */
export function Screen({ header, footer, scroll = true, wide, refreshing, onRefresh, children, contentContainerStyle, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  // Android: edge-to-edge ignores adjustResize, so lift the footer by however much the keyboard covers it (iOS uses padding behavior).
  const bodyRef = useRef<View>(null);
  const kbOverlap = useKeyboardOverlap(bodyRef, Platform.OS === 'android');
  const { gutter, contentMaxWidth, readingMaxWidth } = useLayout();
  // A pinned footer tells the toast host how tall it is, so toasts rise above it instead of covering the primary action.
  const reportFooter = useToastFooterInset();
  const [owner] = useState(() => ({}));
  const footerRef = useRef<View>(null);
  const windowHeight = useWindowDimensions().height;
  // How far the footer's top edge is from the window's bottom: its own height, plus whatever sits under it (a tab bar). Layout height
  // first (immediate), then the measured window position when the platform answers.
  const onFooterLayout = (height: number) => {
    reportFooter(owner, height);
    footerRef.current?.measureInWindow((_x, y) => { if (Number.isFinite(y) && y > 0) reportFooter(owner, Math.max(height, windowHeight - y)); });
  };
  useEffect(() => () => reportFooter(owner, 0), [reportFooter, owner]);
  useEffect(() => { if (!footer) reportFooter(owner, 0); }, [footer, reportFooter, owner]);
  const bounded = { width: '100%' as const, maxWidth: wide ? contentMaxWidth : readingMaxWidth, alignSelf: 'center' as const };
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      {header}
      <View ref={bodyRef} collapsable={false} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
            {...rest} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }, contentContainerStyle]}>
            <View style={bounded}>{children}</View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
        {footer && <View ref={footerRef} collapsable={false} onLayout={(e) => onFooterLayout(e.nativeEvent.layout.height)} style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: kbOverlap > 0 ? space[4] : Math.max(insets.bottom, space[4]), marginBottom: kbOverlap }]}><View style={[bounded, { maxWidth: readingMaxWidth, gap: space[2] }]}>{footer}</View></View>}
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
export const SafeScreen = Screen;

interface HeaderProps { title?: string; onBack?: () => void; right?: React.ReactNode; brand?: boolean }

export function AppHeader({ title, onBack, right, brand }: HeaderProps) {
  const { gutter, contentMaxWidth } = useLayout();
  return (
    <View style={{ paddingHorizontal: gutter }}>
    <View style={[styles.header, { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }]}>
      {onBack && <IconButton icon="back" accessibilityLabel="Geri" onPress={onBack} style={{ marginLeft: -space[2] }} />}
      {brand ? (
        <View style={styles.brand} accessible accessibilityLabel="TechApp">
          <BrandMark size={28} /><Text variant="section">techapp</Text>
        </View>
      ) : (
        <Text variant="label" numberOfLines={1} style={{ flex: 1, textAlign: onBack ? 'center' : 'left' }}>{title}</Text>
      )}
      <View style={styles.headerRight}>{right ?? (onBack ? <View style={{ width: layout.touchTarget - space[2] }} /> : null)}</View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: space[8], paddingTop: space[2] },
  footer: { paddingTop: space[3], backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.border, gap: space[2] },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space[1] },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
});
