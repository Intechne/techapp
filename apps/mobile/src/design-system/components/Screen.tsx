import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, space } from '../tokens';
import { Text } from '../Text';
import { IconButton } from './Button';

interface ScreenProps extends ScrollViewProps {
  header?: React.ReactNode;
  /** Pinned below the scroll area (primary CTA). Stays visible with large fonts and the keyboard. */
  footer?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

/** Page scaffold: safe areas, gutter, keyboard avoidance, optional pull-to-refresh and sticky footer. */
export function Screen({ header, footer, scroll = true, refreshing, onRefresh, children, contentContainerStyle, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
            {...rest} contentContainerStyle={[styles.content, contentContainerStyle]}>
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
        {footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const SafeScreen = Screen;

interface HeaderProps { title?: string; onBack?: () => void; right?: React.ReactNode; brand?: boolean }

export function AppHeader({ title, onBack, right, brand }: HeaderProps) {
  return (
    <View style={styles.header}>
      {onBack && <IconButton icon="back" accessibilityLabel="Geri" onPress={onBack} style={{ marginLeft: -space[2] }} />}
      {brand ? (
        <View style={styles.brand} accessible accessibilityLabel="TechApp">
          <Text variant="section" color="primary">T.</Text><Text variant="section"> techapp</Text>
        </View>
      ) : (
        <Text variant="label" numberOfLines={1} style={{ flex: 1, textAlign: onBack ? 'center' : 'left' }}>{title}</Text>
      )}
      <View style={styles.headerRight}>{right ?? (onBack ? <View style={{ width: layout.touchTarget - space[2] }} /> : null)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space[8], paddingTop: space[2] },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space[3], backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.border, gap: space[2] },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.gutter, gap: space[1] },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'baseline' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
});
