import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { EASE_IN_OUT } from '../motion';
import { colors, fonts, radius, space } from '../tokens';
import { keepNumbersTogether } from './cards/label';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { Button } from './Button';
import { useReducedMotion } from '../useReducedMotion';
import { PosterCardSkeleton } from './cards/PosterCard';
import { RowCardSkeleton } from './cards/RowCard';
import type { RowLines } from './cards/metrics';
import type { AppError } from '../../lib/errors';

interface EmptyProps { icon?: TechIconName; title: string; body?: string; actionLabel?: string; onAction?: () => void }

export function EmptyState({ icon = 'discover', title, body, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.center}>
      <View style={styles.badge}><TechIcon name={icon} size={26} color={colors.primary} /></View>
      <Text variant="cardTitle" center>{title}</Text>
      {body && <Text variant="bodySmall" color="textSecondary" center>{body}</Text>}
      {actionLabel && onAction && <Button kind="secondary" label={actionLabel} onPress={onAction} style={{ marginTop: space[2], alignSelf: 'stretch' }} />}
    </View>
  );
}

/** Tells the truth about what failed. Retry only when the error is retryable. */
export function ErrorState({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  const offline = error.code === 'network_unreachable';
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}><TechIcon name={offline ? 'offline' : 'warning'} size={26} color={colors.danger} /></View>
      <Text variant="cardTitle" center>{offline ? 'Bağlantı yok gibi görünüyor' : 'Bir şey ters gitti'}</Text>
      <Text variant="bodySmall" color="textSecondary" center>{error.message}</Text>
      {error.retryable && onRetry && <Button kind="secondary" label="Tekrar dene" onPress={onRetry} style={{ marginTop: space[2], alignSelf: 'stretch' }} />}
      {error.requestId && <Text variant="caption" color="textSecondary">Destek kodu: {error.requestId}</Text>}
    </View>
  );
}

/** Standalone placeholder bar (non-card content). One calm opacity pulse on the UI thread; static with reduced motion. */
export function Skeleton({ width = '100%', height = 16, rounded = radius.small }: { width?: DimensionValue; height?: number; rounded?: number }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) { cancelAnimation(opacity); opacity.set(1); return; }
    opacity.set(withRepeat(withTiming(0.55, { duration: 900, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System }), -1, true, undefined, ReduceMotion.System));
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: reduced ? 1 : opacity.get() }));
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.surfaceSunken }, animated]} />;
}

/**
 * Loading state of a list: the skeleton variant of the card the list will show, so nothing jumps when data arrives.
 * `poster` for events/courses, `row` for opportunities, teams, registrations, applications; `rowLines` is the list's
 * typical row shape so the skeleton measures like the rows that replace it.
 */
export function LoadingSkeleton({ cards = 2, variant = 'poster', rowLines }: { cards?: number; variant?: 'poster' | 'row'; rowLines?: RowLines }) {
  return (
    <View accessibilityLabel="Yükleniyor" accessibilityRole="progressbar" style={{ gap: space[3] }}>
      {Array.from({ length: cards }, (_, i) => (variant === 'row' ? <RowCardSkeleton key={i} lines={rowLines} /> : <PosterCardSkeleton key={i} />))}
    </View>
  );
}

export function OfflineBanner() {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <TechIcon name="offline" size={16} color={colors.white} />
      <Text variant="caption" color="white">Çevrim dışısın. Gördüklerin güncel olmayabilir.</Text>
    </View>
  );
}

/**
 * "This is a saved copy" label (participation card, saved cards): the same neutral tone as OfflineBanner — ink ground,
 * white text, offline glyph (approved Q1). Apricot stays reserved for deadlines.
 */
export function OfflineLabel({ label }: { label: string }) {
  return (
    <View testID="offline-label" style={styles.offlineLabel}>
      <View testID="offline-label-icon-offline" style={styles.offlineIcon}><TechIcon name="offline" size={14} color={colors.white} /></View>
      <Text variant="caption" color="white" style={styles.offlineText}>{keepNumbersTogether(label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  offlineLabel: { flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.ink, borderRadius: radius.small, paddingHorizontal: space[2], paddingVertical: 5 },
  offlineIcon: { flexShrink: 0 },
  offlineText: { flexShrink: 1, minWidth: 0, fontFamily: fonts.bodyBold },
  center: { alignItems: 'center', gap: space[3], paddingVertical: space[8], paddingHorizontal: space[4] },
  badge: { width: 64, height: 64, borderRadius: radius.card, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space[1] },
  offline: { flexDirection: 'row', gap: space[2], alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, paddingVertical: space[2], paddingHorizontal: space[4] },
});
