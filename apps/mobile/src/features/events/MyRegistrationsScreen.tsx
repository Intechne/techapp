import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Card, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, RegistrationStatus, Text, colors, layout, space } from '../../design-system';
import { formatDateRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { eventKeys, fetchMyRegistrations } from './api';
import { placeLabel } from './labels';

export function MyRegistrationsScreen({ navigation }: NativeStackScreenProps<SharedEventParamList, 'MyRegistrations'>) {
  const { userId } = useSession();
  const q = useQuery({ queryKey: eventKeys.myRegistrations(userId), queryFn: fetchMyRegistrations, enabled: !!userId });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <AppHeader onBack={navigation.goBack} title="Katılımlarım" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: space[8], gap: space[3] }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={<View style={{ marginBottom: space[2] }}><Text variant="display">Attığın adımlar.</Text></View>}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('RegistrationStatus', { registrationId: item.id })} style={{ gap: space[2] }}
            accessibilityLabel={`${item.event.title}, kayıt durumu`}>
            <RegistrationStatus status={item.status} />
            <Text variant="cardTitle">{item.event.title}</Text>
            <MetadataRow icon="event">{formatDateRange(item.event.starts_at, item.event.ends_at)} · {placeLabel(item.event)}</MetadataRow>
          </Card>
        )}
        ListEmptyComponent={
          !userId ? <EmptyState icon="ticket" title="Katılımların burada görünecek" body="Bir etkinliğe katıldığında kayıt durumunu ve katılım kartını burada bulursun." />
            : q.isPending ? <LoadingSkeleton />
              : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
                : <EmptyState icon="ticket" title="Henüz bir katılımın yok" body="İlgini çeken bir etkinlik bul, ilk adımı at." actionLabel="Etkinlikleri keşfet" onAction={navigation.goBack} />
        }
      />
    </SafeAreaView>
  );
}
