import React, { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { AppHeader, Button, Card, MetadataRow, Screen, Tag, TechIcon, Text, colors, radius, space } from '../../design-system';
import { formatDateRange, formatLastUpdated } from '../../lib/dates';
import type { UnavailableReason } from '../../lib/sessionRestore';
import type { SavedCard } from '../events/offlineCard';
import { ParticipationCardView } from '../events/ParticipationCardView';
import { placeLabel } from '../events/labels';
import { loadStartupOfflineCards } from '../events/startupOfflineCards';

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

interface Props {
  reason: UnavailableReason;
  onRetry: () => void;
  retrying?: boolean;
  /** Saved cards of the session stored on this device (see events/startupOfflineCards). Injectable for tests. */
  loadSavedCards?: () => Promise<SavedCard[]>;
}

/**
 * Shown when the launch-time session restore cannot reach the backend. No debug details, one clear action.
 * The navigator is not mounted here, so participation cards already saved on this device for the stored session's user are
 * listed (and opened read-only) right on this screen: the venue case, no signal and an access token older than an hour.
 */
export function StartupUnavailableScreen({ reason, onRetry, retrying = false, loadSavedCards = loadStartupOfflineCards }: Props) {
  const copy = COPY[reason];
  const [saved, setSaved] = useState<SavedCard[]>([]);
  const [open, setOpen] = useState<SavedCard | null>(null);

  const [load] = useState(() => loadSavedCards); // read once per mount; the list does not depend on retries
  useEffect(() => {
    let cancelled = false;
    load().then((cards) => { if (!cancelled) setSaved(cards); }, () => {});
    return () => { cancelled = true; };
  }, [load]);

  // No navigator yet: Android back returns from the card to this screen instead of leaving the app.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(null); return true; });
    return () => sub.remove();
  }, [open]);

  if (open) {
    return (
      <Screen header={<AppHeader onBack={() => setOpen(null)} title="Katılım kartı" />}>
        <ParticipationCardView card={open.card} cachedAt={open.savedAt} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: space[3] }} accessibilityRole="alert">
        <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <TechIcon name="link" size={26} color={colors.ink} />
        </View>
        <Text variant="title">{copy.title}</Text>
        <Text variant="body" color="textSecondary">{copy.body}</Text>
      </View>
      <Button label="Tekrar Dene" onPress={onRetry} loading={retrying} style={{ marginTop: space[6] }} />
      {saved.length > 0 && (
        <View style={{ gap: space[3], marginTop: space[8] }}>
          <Text variant="section">Çevrimdışı · kayıtlı kartların</Text>
          <Text variant="bodySmall" color="textSecondary">Daha önce açtığın katılım kartları bu cihazda duruyor. Girişte görevliye gösterebilirsin.</Text>
          {saved.map((s) => (
            <Card key={s.registrationId} onPress={() => setOpen(s)} style={{ gap: space[2] }} accessibilityLabel={`${s.card.event.title}, kayıtlı katılım kartı`}>
              <Tag tone="apricot" icon="clock" label={`Son güncelleme: ${formatLastUpdated(s.savedAt)}`} />
              <Text variant="cardTitle">{s.card.event.title}</Text>
              <MetadataRow icon="event">{formatDateRange(s.card.event.starts_at, s.card.event.ends_at)} · {placeLabel(s.card.event)}</MetadataRow>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
