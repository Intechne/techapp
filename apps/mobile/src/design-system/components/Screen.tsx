import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as ReactNavigation from '@react-navigation/native';
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

/** Focus of the enclosing navigation screen; true outside a navigator (tests, previews). */
const NO_NAVIGATION = React.createContext<{ isFocused(): boolean; addListener(e: 'focus' | 'blur', f: () => void): () => void } | undefined>(undefined);
function useScreenFocused(): boolean {
  const navigation = useContext((ReactNavigation as { NavigationContext?: typeof NO_NAVIGATION }).NavigationContext ?? NO_NAVIGATION);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return undefined;
    const subs = [navigation.addListener('focus', () => setFocused(true)), navigation.addListener('blur', () => setFocused(false))];
    return () => subs.forEach((u) => u());
  }, [navigation]);
  return focused;
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
  // Only the focused screen's footer counts: a screen kept mounted underneath (stack) or an inactive tab must not lift toasts.
  const focused = useScreenFocused();
  const footerHeight = useRef(0);
  const measure = useCallback(() => {
    const height = footerHeight.current;
    if (!focused || height <= 0) { reportFooter(owner, 0); return; }
    reportFooter(owner, height);
    footerRef.current?.measureInWindow((_x, y) => { if (Number.isFinite(y) && y > 0) reportFooter(owner, Math.max(height, windowHeight - y)); });
  }, [focused, owner, reportFooter, windowHeight]);
  // Re-measured when focus, the footer or the keyboard lift changes, so the inset follows a lifted footer.
  useEffect(() => {
    if (!footer) footerHeight.current = 0;
    measure();
    return () => reportFooter(owner, 0);
  }, [measure, footer, kbOverlap, reportFooter, owner]);
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
        {footer && <View ref={footerRef} collapsable={false} onLayout={(e) => { footerHeight.current = e.nativeEvent.layout.height; measure(); }} style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: kbOverlap > 0 ? space[4] : Math.max(insets.bottom, space[4]), marginBottom: kbOverlap }]}><View style={[bounded, { maxWidth: readingMaxWidth, gap: space[2] }]}>{footer}</View></View>}
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
