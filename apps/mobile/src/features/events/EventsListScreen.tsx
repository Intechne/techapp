import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, BottomSheet, Button, Checkbox, Chip, ChipRail, EmptyState, ErrorState, EventCard, LoadingSkeleton, Text, TextButton, colors, layout, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { EventType } from '../../lib/database.types';
import type { EventsStackParamList } from '../../navigation/types';
import { eventKeys, fetchEventsPage, type EventCursor, type EventFilters } from './api';
import { EVENT_TYPE_FILTERS, toEventCardModel, type EventWithOrg } from './labels';

/**
 * Filter state lives in this screen and the native stack keeps it mounted while a detail is open,
 * so "Robotik filter → detail → back" returns to the same filter and scroll offset.
 */
export function EventsListScreen({ navigation }: NativeStackScreenProps<EventsStackParamList, 'EventsList'>) {
  const [type, setType] = useState<EventType | 'all'>('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [draftOnline, setDraftOnline] = useState(false);
  const filters: EventFilters = useMemo(() => ({ type, onlineOnly }), [type, onlineOnly]);

  const query = useInfiniteQuery({
    queryKey: eventKeys.list(filters),
    queryFn: ({ pageParam }) => fetchEventsPage(filters, pageParam),
    initialPageParam: null as EventCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const filtered = type !== 'all' || onlineOnly;

  const renderItem = useCallback(({ item }: { item: EventWithOrg }) => (
    <EventCard model={toEventCardModel(item)} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />
  ), [navigation]);

  const header = (
    <View style={{ paddingBottom: space[4] }}>
      <Text variant="eyebrow" color="textSecondary">MERAKINI HAREKETE GEÇİR</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Bir araya gel.{'\n'}Yeni bir şey başlat.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space[3] }}>
        <TextButton icon="ticket" label="Katılımlarım" onPress={() => navigation.navigate('MyRegistrations')} />
        <TextButton icon="filter" label={onlineOnly ? 'Filtre · 1' : 'Filtrele'} onPress={() => { setDraftOnline(onlineOnly); setSheet(true); }} />
      </View>
      <ChipRail>
        {EVENT_TYPE_FILTERS.map((f) => <Chip key={f.value} label={f.label} selected={type === f.value} onPress={() => setType(f.value)} />)}
      </ChipRail>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <AppHeader brand />
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: space[8] }}
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          query.isPending ? <LoadingSkeleton />
            : query.isError ? <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
              : filtered ? <EmptyState icon="filter" title="Bu filtrede etkinlik yok" body="Filtreleri gevşetip tekrar bakabilirsin." actionLabel="Filtreleri temizle" onAction={() => { setType('all'); setOnlineOnly(false); }} />
                : <EmptyState icon="event" title="Yakında burası dolacak" body="Şu an yayında etkinlik yok. Yeni etkinlikler eklendiğinde burada göreceksin." />
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginTop: space[4] }} /> : null}
        initialNumToRender={4}
        windowSize={7}
        removeClippedSubviews
      />
      <BottomSheet visible={sheet} title="Katılım biçimi" onClose={() => setSheet(false)}>
        <Checkbox label="Yalnızca çevrim içi katılabileceklerim" description="Çevrim içi ve hibrit etkinlikler" checked={draftOnline} onChange={setDraftOnline} />
        <Button label="Filtreyi uygula" onPress={() => { setOnlineOnly(draftOnline); setSheet(false); }} />
        <Button kind="secondary" label="Tüm filtreleri temizle" onPress={() => { setOnlineOnly(false); setType('all'); setSheet(false); }} />
      </BottomSheet>
    </SafeAreaView>
  );
}
