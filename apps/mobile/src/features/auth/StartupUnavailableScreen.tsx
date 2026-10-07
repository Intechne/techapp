import React from 'react';
import { View } from 'react-native';
import { Button, Screen, TechIcon, Text, colors, space } from '../../design-system';
import type { UnavailableReason } from '../../lib/sessionRestore';

const COPY: Record<UnavailableReason, { title: string; body: string }> = {
  offline: {
    title: 'İnternet bağlantın yok gibi görünüyor.',
    body: 'Bağlantını kontrol edip tekrar deneyebilirsin.',
  },
  unreachable: {
    title: "TechApp'e şu anda bağlanamıyoruz.",
    body: 'İnternet bağlantını kontrol edip tekrar deneyebilirsin.',
  },
  server_error: {
    title: "TechApp'e şu anda bağlanamıyoruz.",
    body: 'Bizim tarafta geçici bir sorun var. Birazdan tekrar deneyebilirsin.',
  },
};

/** Shown when the launch-time session restore cannot reach the backend. No debug details, one clear action. */
export function StartupUnavailableScreen({ reason, onRetry, retrying = false }: { reason: UnavailableReason; onRetry: () => void; retrying?: boolean }) {
  const copy = COPY[reason];
  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: space[3] }} accessibilityRole="alert">
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <TechIcon name="link" size={26} color={colors.ink} />
        </View>
        <Text variant="title">{copy.title}</Text>
        <Text variant="body" color="textSecondary">{copy.body}</Text>
        <Button label="Tekrar Dene" onPress={onRetry} loading={retrying} style={{ marginTop: space[3] }} />
      </View>
    </Screen>
  );
}
