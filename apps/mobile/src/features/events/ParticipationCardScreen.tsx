import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Card, Divider, ErrorState, LoadingSkeleton, MetadataRow, Notice, Screen, Tag, Text, colors, fonts, radius, space } from '../../design-system';
import { formatDateRange, formatTime, formatTimeRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { eventKeys, fetchParticipationCard } from './api';
import { placeLabel } from './labels';

/** The QR is an opaque server-signed token (registration id + HMAC). It carries no personal data and is verified on the server. */
export function ParticipationCardScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'ParticipationCard'>) {
  const { registrationId } = route.params;
  const card = useQuery({ queryKey: eventKeys.card(registrationId), queryFn: () => fetchParticipationCard(registrationId), staleTime: 0 });

  if (card.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (card.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(card.error)} onRetry={() => void card.refetch()} /></Screen>;
  const c = card.data;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Katılım kartı" />} refreshing={card.isRefetching} onRefresh={() => void card.refetch()}>
      <Text variant="display">Görüşmek üzere.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>Girişte bu kodu görevliye göster.</Text>
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
      </Card>
      <View style={{ marginTop: space[3] }}>
        <Notice tone="info">Giriş kontrolü etkinlikten 3 saat önce açılır. Kod sana özeldir; kaydını iptal edersen geçersiz olur.</Notice>
      </View>
    </Screen>
  );
}
