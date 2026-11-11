import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Notice, RegistrationStatus, Tag, Text, colors, layout, space } from '../../design-system';
import { formatDateRange, formatLastUpdated } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { eventKeys, fetchMyRegistrations } from './api';
import { dropCards, isNetworkClassError, listCards } from './offlineCard';
import { placeLabel } from './labels';

const SLOW_LOAD_MS = 3000;

export function MyRegistrationsScreen({ navigation }: NativeStackScreenProps<SharedEventParamList, 'MyRegistrations'>) {
  const { userId } = useSession();
  const q = useQuery({ queryKey: eventKeys.myRegistrations(userId), queryFn: () => fetchMyRegistrations(userId!), enabled: !!userId });
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
  else if ((!waiting && mem.slow) || (offline && !mem.wasOffline) || (!!q.data && mem.wasOffline)) cur = { ...mem, slow: waiting ? mem.slow : false, wasOffline: offline || (mem.wasOffline && !q.data) };
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
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: space[8], gap: space[3] }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={<View style={{ marginBottom: space[2], gap: space[3] }}><Text variant="display">Attığın adımlar.</Text>{staleOffline && <Notice tone="info">Bağlantı yok. Liste en son yüklendiği hâliyle duruyor.</Notice>}</View>}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('RegistrationStatus', { registrationId: item.id })} style={{ gap: space[2] }}
            accessibilityLabel={`${item.event.title}, kayıt durumu`}>
            <RegistrationStatus status={item.status} />
            <Text variant="cardTitle">{item.event.title}</Text>
            <MetadataRow icon="event">{formatDateRange(item.event.starts_at, item.event.ends_at)} · {placeLabel(item.event)}</MetadataRow>
          </Card>
        )}
        ListEmptyComponent={
          showSaved ? (
            <View style={{ gap: space[3] }}>
              <Text variant="section">{offline || cur.wasOffline ? 'Çevrimdışı · kayıtlı kartların' : 'Kayıtlı kartların'}</Text>
              <Notice tone="info">{offline || cur.wasOffline ? 'Bağlantı yok. Daha önce açtığın katılım kartları bu cihazda duruyor.' : 'Liste yükleniyor. Daha önce açtığın katılım kartları bu cihazda duruyor.'}</Notice>
              {savedCards.map(({ registrationId, card, savedAt }) => (
                <Card key={registrationId} onPress={() => navigation.navigate('ParticipationCard', { registrationId })} style={{ gap: space[2] }}
                  accessibilityLabel={`${card.event.title}, kayıtlı katılım kartı`}>
                  <Tag tone="apricot" icon="clock" label={`Son güncelleme: ${formatLastUpdated(savedAt)}`} />
                  <Text variant="cardTitle">{card.event.title}</Text>
                  <MetadataRow icon="event">{formatDateRange(card.event.starts_at, card.event.ends_at)} · {placeLabel(card.event)}</MetadataRow>
                </Card>
              ))}
              {offline || cur.wasOffline ? <Button kind="secondary" label="Tekrar dene" onPress={() => void q.refetch()} /> : <LoadingSkeleton />}
            </View>
          ) : !userId ? <EmptyState icon="ticket" title="Katılımların burada görünecek" body="Bir etkinliğe katıldığında kayıt durumunu ve katılım kartını burada bulursun." />
            : q.isPending ? <LoadingSkeleton />
              : q.isError && offline && saved.isPending ? <LoadingSkeleton />
              : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
                : <EmptyState icon="ticket" title="Henüz bir katılımın yok" body="İlgini çeken bir etkinlik bul, ilk adımı at." actionLabel="Etkinlikleri keşfet" onAction={navigation.goBack} />
        }
      />
    </SafeAreaView>
  );
}
