import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { colors, radius, space } from '../tokens';
import { Text } from '../Text';
import { TechIcon, type TechIconName } from '../TechIcon';
import { Button } from './Button';
import { useReducedMotion } from '../useReducedMotion';
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
      <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}><TechIcon name={offline ? 'link' : 'shield'} size={26} color={colors.danger} /></View>
      <Text variant="cardTitle" center>{offline ? 'Bağlantı yok gibi görünüyor' : 'Bir şey ters gitti'}</Text>
      <Text variant="bodySmall" color="textSecondary" center>{error.message}</Text>
      {error.retryable && onRetry && <Button kind="secondary" label="Tekrar dene" onPress={onRetry} style={{ marginTop: space[2], alignSelf: 'stretch' }} />}
      {error.requestId && <Text variant="caption" color="textSecondary">Destek kodu: {error.requestId}</Text>}
    </View>
  );
}

export function Skeleton({ width = '100%', height = 16, rounded = radius.small }: { width?: DimensionValue; height?: number; rounded?: number }) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return <Animated.View style={{ width, height, borderRadius: rounded, backgroundColor: colors.surfaceSunken, opacity }} />;
}

export function LoadingSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <View accessibilityLabel="Yükleniyor" accessibilityRole="progressbar" style={{ gap: space[4] }}>
      {Array.from({ length: cards }, (_, i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton height={148} rounded={0} />
          <View style={{ padding: space[4], gap: space[3] }}>
            <Skeleton width="30%" height={20} /><Skeleton width="85%" height={20} /><Skeleton width="55%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function OfflineBanner() {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <TechIcon name="link" size={16} color={colors.white} />
      <Text variant="caption" color="white">Çevrim dışısın. Gördüklerin güncel olmayabilir.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space[3], paddingVertical: space[8], paddingHorizontal: space[4] },
  badge: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space[1] },
  skeletonCard: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  offline: { flexDirection: 'row', gap: space[2], alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, paddingVertical: space[2], paddingHorizontal: space[4] },
});
