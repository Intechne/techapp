import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Notice, RegistrationStatus, Tag, Text, colors, layout, space } from '../../design-system';
import { formatDateRange, formatTime } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { eventKeys, fetchMyRegistrations } from './api';
import { isNetworkClassError, listCards } from './offlineCard';
import { placeLabel } from './labels';

export function MyRegistrationsScreen({ navigation }: NativeStackScreenProps<SharedEventParamList, 'MyRegistrations'>) {
  const { userId } = useSession();
  const q = useQuery({ queryKey: eventKeys.myRegistrations(userId), queryFn: () => fetchMyRegistrations(userId!), enabled: !!userId });

  // Cold start without network: the list needs the server, but a card saved earlier on this device still opens (this user's only).
  // Only when there is nothing to show: with stale data the list stays and a small notice says it may be out of date.
  const networkError = q.isError && isNetworkClassError(q.error);
  const offline = networkError && !q.data;
  const staleOffline = networkError && !!q.data;
  const saved = useQuery({ queryKey: ['cards', 'offline', userId], queryFn: () => listCards(userId!), enabled: !!userId && offline, staleTime: 0, gcTime: 0 });
  const savedCards = saved.data ?? [];
  const showSaved = offline && savedCards.length > 0;

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
              <Text variant="section">Çevrimdışı · kayıtlı kartların</Text>
              <Notice tone="info">Bağlantı yok. Daha önce açtığın katılım kartları bu cihazda duruyor.</Notice>
              {savedCards.map(({ registrationId, card, savedAt }) => (
                <Card key={registrationId} onPress={() => navigation.navigate('ParticipationCard', { registrationId })} style={{ gap: space[2] }}
                  accessibilityLabel={`${card.event.title}, kayıtlı katılım kartı`}>
                  <Tag tone="apricot" icon="clock" label={`Son güncelleme: ${formatTime(savedAt)}`} />
                  <Text variant="cardTitle">{card.event.title}</Text>
                  <MetadataRow icon="event">{formatDateRange(card.event.starts_at, card.event.ends_at)} · {placeLabel(card.event)}</MetadataRow>
                </Card>
              ))}
              <Button kind="secondary" label="Tekrar dene" onPress={() => void q.refetch()} />
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
