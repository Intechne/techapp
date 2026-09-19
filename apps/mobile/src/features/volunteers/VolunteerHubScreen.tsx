import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Card, Divider, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Notice, ResponsiveGrid, Screen, Tag, Text, colors, radius, space, tones } from '../../design-system';
import { formatDate, formatDateRange, formatTime, formatTimeRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchVolunteerBrief, volunteerKeys } from './api';

/** The approved volunteer's view of an event: duty, programme, volunteer announcements, team names and head counts. Nothing personal about participants. */
export function VolunteerHubScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'VolunteerHub'>) {
  const { eventId } = route.params;
  const { userId } = useSession();
  const brief = useQuery({ queryKey: volunteerKeys.brief(eventId), queryFn: () => fetchVolunteerBrief(eventId), enabled: !!userId, retry: false });
  const header = <AppHeader onBack={navigation.goBack} title="Gönüllü alanı" />;

  if (!userId) return <Screen header={header}><EmptyState icon="leaf" title="Gönüllü alanı giriş ister" body="Onaylı gönüllüler giriş yaptığında etkinlik bilgilerini burada görür." actionLabel="Giriş yap" onAction={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} /></Screen>;
  if (brief.isPending) return <Screen header={header}><LoadingSkeleton cards={2} /></Screen>;
  if (brief.isError) {
    const err = toAppError(brief.error);
    return (
      <Screen header={header}>
        {err.code === 'volunteer_not_approved'
          ? <EmptyState icon="shield" title="Bu alan onaylı gönüllülere açık" body="Başvurun düzenleyen ekip tarafından onaylandığında görevin, program ve gönüllü duyuruları burada görünür." actionLabel="Etkinlik sayfasına dön" onAction={() => navigation.replace('EventDetail', { eventId })} />
          : <ErrorState error={err} onRetry={() => void brief.refetch()} />}
      </Screen>
    );
  }

  const { event, my_duty: duty, sessions, announcements, teams, stats } = brief.data;
  const place = [event.format === 'online' ? 'Çevrim içi' : event.city, event.venue].filter(Boolean).join(' · ');
  const figures: [string, string][] = [
    ['Onaylı katılımcı', stats.capacity ? `${stats.confirmed} / ${stats.capacity}` : String(stats.confirmed)], ['Giriş yapan', String(stats.checked_in)], ['Gönüllü', String(stats.volunteers)],
  ];

  return (
    <Screen wide header={header} refreshing={brief.isRefetching} onRefresh={() => void brief.refetch()}>
      <View style={styles.hero}>
        <Text variant="eyebrow" style={{ color: tones.moss.fg }}>GÖNÜLLÜ EKİP{event.organizer ? ` · ${event.organizer.toLocaleUpperCase('tr')}` : ''}</Text>
        <Text variant="title" style={{ color: tones.moss.fg, marginTop: space[2] }}>{event.title}</Text>
        <View style={styles.duty}><Text variant="caption" color="textSecondary">GÖREVİN</Text><Text variant="cardTitle">{duty ?? 'Henüz belirtilmedi'}</Text>
          {!duty && <Text variant="caption" color="textSecondary">Düzenleyen ekip görevini etkinlikten önce bildirecek.</Text>}</View>
      </View>

      <View style={{ gap: space[3], marginTop: space[5] }}>
        <MetadataRow icon="event" strong>{formatDateRange(event.starts_at, event.ends_at)} · {formatTimeRange(event.starts_at, event.ends_at)}</MetadataRow>
        {!!place && <MetadataRow icon="location" strong>{place}</MetadataRow>}
        {!!event.support_contact && <MetadataRow icon="link" strong>Ekip iletişimi: {event.support_contact}</MetadataRow>}
      </View>

      <View style={styles.stats} accessible accessibilityLabel={figures.map(([l, v]) => `${l}: ${v}`).join(', ')}>
        {figures.map(([label, value]) => <View key={label} style={{ flex: 1, alignItems: 'center' }}><Text variant="section">{value}</Text><Text variant="caption" color="textSecondary" center>{label}</Text></View>)}
      </View>

      <Text variant="section">Duyurular</Text>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {announcements.length === 0 ? <Text variant="bodySmall" color="textSecondary">Henüz duyuru yok. Düzenleyen ekip paylaştığında burada görünür.</Text> : (
          <ResponsiveGrid maxColumns={2}>{announcements.map((a) => (
            <Card key={a.id} style={[{ gap: space[2] }, a.pinned && { borderColor: colors.primary }]}>
              {a.pinned && <View style={{ flexDirection: 'row' }}><Tag label="SABİTLENDİ" /></View>}
              <Text variant="cardTitle">{a.title}</Text><Text variant="bodySmall" color="textSecondary">{a.body}</Text>
              <Text variant="caption" color="textSecondary">{formatDate(a.created_at)} · {formatTime(a.created_at)}</Text>
            </Card>))}</ResponsiveGrid>
        )}
      </View>

      {sessions.length > 0 && (<><Divider /><Text variant="section">Program</Text>
        <View style={{ gap: space[3], marginTop: space[3] }}>{sessions.map((s, i) => (
          <View key={`${s.starts_at}-${i}`} style={{ flexDirection: 'row', gap: space[3] }}>
            <Text variant="label" color="primary" style={{ width: 96 }}>{formatTime(s.starts_at)}</Text>
            <View style={{ flex: 1 }}><Text variant="bodySmall">{s.title}</Text>{!!s.location_note && <Text variant="caption" color="textSecondary">{s.location_note}</Text>}</View>
          </View>))}</View></>)}

      <Divider />
      <Text variant="section">Katılan takımlar</Text>
      {teams.length === 0 ? <Text variant="bodySmall" color="textSecondary" style={{ marginTop: space[3] }}>Bu etkinlikte kaydı onaylanmış bir takım henüz yok.</Text> : (
        <ResponsiveGrid style={{ marginTop: space[3] }}>{teams.map((t) => (
          <Card key={t.name} style={{ gap: 2 }}><Text variant="label">{t.name}</Text>{!!t.category && <Text variant="caption" color="textSecondary">{t.category}</Text>}</Card>))}</ResponsiveGrid>
      )}

      <View style={{ marginTop: space[6] }}><Notice tone="info" title="Neden bu kadarını görüyorsun?">Gönüllü alanı işini yapman için gerekenle sınırlıdır: program, gönüllü duyuruları, takım adları ve sayılar. Katılımcıların adları, yaşları ve iletişim bilgileri yalnızca düzenleyen ekipte kalır.</Notice></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: tones.moss.bg, borderRadius: radius.hero, padding: space[5] },
  duty: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space[4], marginTop: space[4], gap: 2 },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, paddingVertical: space[4], marginVertical: space[5] },
});
