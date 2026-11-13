import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Notice, OfflineLabel, RowCard, Text, colors, layout, registrationStatusView, space, teamAwareRegistrationView, teamMemberStepView, type RowLines } from '../../design-system';
import { formatDateRange, formatDateTime, formatLastUpdated } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import { features } from '../../lib/features';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { eventKeys, fetchMyRegistrations } from './api';
import { dropCards, isNetworkClassError, listCards } from './offlineCard';
import { placeLabel } from './labels';
import { fetchMyTeamInvites, fetchTeamStatuses, teamRegistrationKeys } from '../teamRegistration/api';

const SLOW_LOAD_MS = 3000;
/** A Katılımlarım row: two-line title, date · place, status under the text on phones (approved Q6). */
export const MY_REGISTRATION_ROW_LINES: RowLines = { title: 2, secondary: 1, footnote: 'none', status: true };
const Separator = () => <View style={{ height: space[3] }} />;

export function MyRegistrationsScreen({ navigation }: NativeStackScreenProps<SharedEventParamList, 'MyRegistrations'>) {
  const { userId } = useSession();
  const q = useQuery({ queryKey: eventKeys.myRegistrations(userId), queryFn: () => fetchMyRegistrations(userId!), enabled: !!userId });
  // Team invites (flag on only): the section exists only while there is one. A failed read shows nothing here; the invite stays reachable from its notification.
  const invites = useQuery({ queryKey: teamRegistrationKeys.invites(userId), queryFn: fetchMyTeamInvites, enabled: features.teamRegistration && !!userId, retry: false });
  const pendingInvites = features.teamRegistration ? invites.data ?? [] : [];
  // Own registrations that belong to a team registration: the team's status decides whether "confirmed" may be shown (one cached read for the list).
  const teamIds = features.teamRegistration ? [...new Set((q.data ?? []).filter((r) => r.status === 'confirmed' && r.team_registration_id).map((r) => r.team_registration_id!))].sort() : [];
  const teamStatuses = useQuery({ queryKey: teamRegistrationKeys.statuses(teamIds.join(',')), queryFn: () => fetchTeamStatuses(teamIds), enabled: teamIds.length > 0 });
  // Registrations the server lists as not confirmed must not keep an offline card (cancelled elsewhere, rejected, expired).
  const notConfirmed = (q.data ?? []).filter((r) => r.status !== 'confirmed').map((r) => r.id).join(',');
  useEffect(() => {
    if (userId && notConfirmed) void dropCards(userId, notConfirmed.split(',')).catch(() => {});
  }, [userId, notConfirmed]);

  // Saved cards must not wait for the query to fail: on a weak network each attempt burns the fetch timeout (x retries).
  // With nothing to show, they appear once loading passes SLOW_LOAD_MS or as soon as a network-class error arrives (this user's only).
  // With stale data the list stays and a small notice says it may be out of date. When the live list arrives it replaces them.
  const networkError = q.isError && isNetworkClassError(q.error);
  const staleOffline = networkError && !!q.data;
  const waiting = !!userId && q.isPending;
  // slow / wasOffline live in one state keyed by user; they are adjusted during render (no setState in an effect).
  // wasOffline survives a retry (a refetch without data flips the query back to pending) until data arrives or the user changes.
  const [mem, setMem] = useState({ user: userId, slow: false, wasOffline: false });
  const offline = networkError && !q.data;
  let cur = mem;
  if (mem.user !== userId) cur = { user: userId, slow: false, wasOffline: false };
  else {
    // wasOffline is cleared by data or by a non-network error (the real error must show, never a stale "Bağlantı yok").
    const nextOffline = offline || (mem.wasOffline && !q.data && !q.isError);
    const nextSlow = waiting ? mem.slow : false;
    if (nextOffline !== mem.wasOffline || nextSlow !== mem.slow) cur = { ...mem, slow: nextSlow, wasOffline: nextOffline };
  }
  if (cur !== mem) setMem(cur);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setMem((m) => (m.user === userId ? { ...m, slow: true } : m)), SLOW_LOAD_MS);
    return () => clearTimeout(t);
  }, [waiting, userId]);
  const wantSaved = !!userId && !q.data && (offline || cur.wasOffline || (waiting && cur.slow));
  const saved = useQuery({ queryKey: ['cards', 'offline', userId], queryFn: () => listCards(userId!), enabled: !!userId && wantSaved, staleTime: 0, gcTime: 0 });
  const savedCards = saved.data ?? [];
  const showSaved = wantSaved && savedCards.length > 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <AppHeader onBack={navigation.goBack} title="Katılımlarım" />
      <FlatList
        data={showSaved ? [] : q.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: space[8] }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={<View style={{ marginBottom: space[4], gap: space[3] }}><Text variant="title">Attığın adımlar.</Text>{staleOffline && <Notice tone="info">Bağlantı yok. Liste en son yüklendiği hâliyle duruyor.</Notice>}
          {pendingInvites.length > 0 && (
            <View style={{ gap: space[3], marginTop: space[2] }}>
              <Text variant="section">Takım davetleri</Text>
              {pendingInvites.map((inv) => (
                <RowCard key={inv.member_id} leading={{ kind: 'icon', icon: 'team' }} title={inv.event.title}
                  secondary={`${inv.team.name} · ${formatDateTime(inv.event.starts_at)}`}
                  trailing={{ kind: 'status', view: teamMemberStepView.invited }}
                  onPress={() => navigation.navigate('TeamInvite', { memberId: inv.member_id })} />
              ))}
            </View>
          )}</View>}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <RowCard leading={{ kind: 'icon', icon: 'ticket' }} title={item.event.title}
            secondary={`${formatDateRange(item.event.starts_at, item.event.ends_at)} · ${placeLabel(item.event)}`}
            trailing={{ kind: 'status', view: features.teamRegistration && item.team_registration_id ? teamAwareRegistrationView(item.status, teamStatuses.data?.[item.team_registration_id]) : registrationStatusView[item.status] }} isDemo={item.event.is_demo}
            onPress={() => navigation.navigate('RegistrationStatus', { registrationId: item.id })} />
        )}
        ListEmptyComponent={
          showSaved ? (
            <View style={{ gap: space[3] }}>
              <Text variant="section">{offline || cur.wasOffline ? 'Çevrimdışı · kayıtlı kartların' : 'Kayıtlı kartların'}</Text>
              <Notice tone="info">{offline || cur.wasOffline ? 'Bağlantı yok. Daha önce açtığın katılım kartları bu cihazda duruyor.' : 'Liste yükleniyor. Daha önce açtığın katılım kartları bu cihazda duruyor.'}</Notice>
              {savedCards.map(({ registrationId, card, savedAt }) => (
                <Card key={registrationId} onPress={() => navigation.navigate('ParticipationCard', { registrationId })} style={{ gap: space[2] }}
                  accessibilityLabel={`${card.event.title}, kayıtlı katılım kartı`}>
                  <OfflineLabel label={`Son güncelleme: ${formatLastUpdated(savedAt)}`} />
                  <Text variant="cardTitle">{card.event.title}</Text>
                  <MetadataRow icon="event">{formatDateRange(card.event.starts_at, card.event.ends_at)} · {placeLabel(card.event)}</MetadataRow>
                </Card>
              ))}
              {offline || cur.wasOffline ? <Button kind="secondary" label="Tekrar dene" onPress={() => void q.refetch()} /> : <LoadingSkeleton variant="row" rowLines={MY_REGISTRATION_ROW_LINES} />}
            </View>
          ) : !userId ? <EmptyState icon="ticket" title="Katılımların burada görünecek" body="Bir etkinliğe katıldığında kayıt durumunu ve katılım kartını burada bulursun." />
            : q.isPending ? <LoadingSkeleton variant="row" rowLines={MY_REGISTRATION_ROW_LINES} />
              : q.isError && offline && saved.isPending ? <LoadingSkeleton variant="row" rowLines={MY_REGISTRATION_ROW_LINES} />
              : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
                : <EmptyState icon="ticket" title="Henüz bir katılımın yok" body="İlgini çeken bir etkinlik bul, ilk adımı at." actionLabel="Etkinlikleri keşfet" onAction={navigation.goBack} />
        }
      />
    </SafeAreaView>
  );
}
