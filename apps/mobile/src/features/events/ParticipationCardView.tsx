import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Card, Divider, MetadataRow, Notice, Tag, Text, colors, fonts, radius, space } from '../../design-system';
import { formatDateRange, formatLastUpdated, formatTime, formatTimeRange } from '../../lib/dates';
import type { ParticipationCard } from '../../lib/database.types';
import { placeLabel } from './labels';

/**
 * The card itself, with no data fetching and no navigation: used by ParticipationCardScreen and by the startup
 * offline view (before the navigator exists). `cachedAt` set = this is a saved copy, shown with its freshness label.
 * The QR is an opaque server-signed token (registration id + HMAC). It carries no personal data and is verified on the server.
 */
export function ParticipationCardView({ card: c, cachedAt }: { card: ParticipationCard; cachedAt: string | null }) {
  return (
    <>
      <Text variant="display">Görüşmek üzere.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>Girişte bu kodu görevliye göster.</Text>
      {cachedAt ? <View style={{ marginTop: space[4], alignSelf: 'flex-start' }}><Tag tone="apricot" icon="clock" label={`Son güncelleme: ${formatLastUpdated(cachedAt)} · çevrimdışı`} /></View> : null}
      <Card style={{ marginTop: space[5], padding: space[5] }}>
        {c.checked_in_at ? <Tag tone="moss" icon="check" label={`GİRİŞ YAPILDI · ${formatTime(c.checked_in_at)}`} /> : <Tag label="KATILIM KARTI" icon="ticket" />}
        <Text variant="section" style={{ marginTop: space[4] }}>{c.event.title}</Text>
        <View style={{ gap: space[2], marginTop: space[2] }}>
          <MetadataRow icon="event">{formatDateRange(c.event.starts_at, c.event.ends_at)} · {formatTimeRange(c.event.starts_at, c.event.ends_at)}</MetadataRow>
          <MetadataRow icon="location">{[placeLabel(c.event), c.event.venue].filter(Boolean).join(' · ')}</MetadataRow>
        </View>
        <Divider />
        <Text variant="eyebrow" color="textSecondary">KATILIMCI</Text>
        <Text variant="cardTitle" style={{ marginTop: space[1] }}>{c.holder_name ?? '—'}</Text>
        <View accessible accessibilityRole="image" accessibilityLabel={`Giriş kodu. Kısa kod: ${c.short_code.split('').join(' ')}`}
          style={{ alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, padding: space[5], marginTop: space[5], gap: space[3] }}>
          <QRCode value={c.qr_payload} size={208} color={colors.ink} backgroundColor={colors.white} ecl="M" />
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, letterSpacing: 4, color: colors.ink }}>{c.short_code}</Text>
        </View>
        <Text variant="caption" color="textSecondary" style={{ marginTop: space[3], textAlign: 'center' }}>Ekran parlaklığını artırırsan kod daha hızlı okunur.</Text>
      </Card>
      <View style={{ marginTop: space[3] }}>
        <Notice tone="info">Giriş kontrolü etkinlikten 3 saat önce açılır. Kod sana özeldir; kaydını iptal edersen geçersiz olur.</Notice>
      </View>
    </>
  );
}
