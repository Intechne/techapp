import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card, Divider, MetadataRow, Notice, OfflineLabel, Tag, Text, colors, radius, space } from '../../design-system';
import { formatDateRange, formatLastUpdated, formatTime, formatTimeRange } from '../../lib/dates';
import type { ParticipationCard } from '../../lib/database.types';
import { placeLabel } from './labels';

/**
 * The card itself, with no data fetching and no navigation: used by ParticipationCardScreen and by the startup
 * offline view (before the navigator exists). `cachedAt` set = this is a saved copy, shown with its freshness label.
 * The QR is an opaque server-signed token (registration id + HMAC). It carries no personal data and is verified on the server.
 */
/** QR: 208 px at ECL M; with the white plate's padding plus this quiet zone the margin is ≥ 4 modules for any token (≥ version 3). */
const QR_SIZE = 208;
/** Short code tracking: one spacing step between characters so it reads aloud and by eye at the gate. */
const SHORT_CODE_TRACKING = space[1];

export function ParticipationCardView({ card: c, cachedAt }: { card: ParticipationCard; cachedAt: string | null }) {
  return (
    <>
      <Text variant="title">Görüşmek üzere.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>Girişte bu kodu görevliye göster.</Text>
      {cachedAt ? <View style={{ marginTop: space[4] }}><OfflineLabel label={`Son güncelleme: ${formatLastUpdated(cachedAt)} · çevrimdışı`} /></View> : null}
      <Card style={{ marginTop: space[5], padding: space[5] }}>
        {c.checked_in_at ? <Tag tone="moss" icon="check" label={`GİRİŞ YAPILDI · ${formatTime(c.checked_in_at)}`} /> : <Tag label="KATILIM KARTI" icon="ticket" />}
        <Text variant="section" style={{ marginTop: space[4] }}>{c.event.title}</Text>
        <View style={{ gap: space[2], marginTop: space[2] }}>
          <MetadataRow icon="event">{formatDateRange(c.event.starts_at, c.event.ends_at)} · {formatTimeRange(c.event.starts_at, c.event.ends_at)}</MetadataRow>
          <MetadataRow icon="location">{[placeLabel(c.event), c.event.venue].filter(Boolean).join(' · ')}</MetadataRow>
        </View>
        <Divider />
        <Text variant="eyebrow" color="textSecondary">KATILIMCI</Text>
        <Text variant="cardTitle" breakStrategy="words" style={{ marginTop: space[1] }}>{c.holder_name ?? '—'}</Text>
        <View accessible accessibilityRole="image" accessibilityLabel={`Katılım QR kodu. Kısa kod: ${c.short_code.split('').join(' ')}`} style={styles.plate}>
          <QRCode value={c.qr_payload} size={QR_SIZE} quietZone={space[3]} color={colors.ink} backgroundColor={colors.white} ecl="M" />
          <Text testID="short-code" variant="title" accessibilityRole="text" style={styles.shortCode}>{c.short_code}</Text>
        </View>
        <Text variant="caption" color="textSecondary" style={{ marginTop: space[3], textAlign: 'center' }}>Ekran parlaklığını artırırsan kod daha hızlı okunur.</Text>
      </Card>
      <View style={{ marginTop: space[3] }}>
        <Notice tone="info">Giriş kontrolü etkinlikten 3 saat önce açılır. Kod sana özeldir; kaydını iptal edersen geçersiz olur.</Notice>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Plain white plate, high contrast, no decoration on the card screen.
  plate: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, padding: space[5], marginTop: space[5], gap: space[2] },
  shortCode: { color: colors.ink, letterSpacing: SHORT_CODE_TRACKING, fontVariant: ['tabular-nums'], textAlign: 'center' },
});
