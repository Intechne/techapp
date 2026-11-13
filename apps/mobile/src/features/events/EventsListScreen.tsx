import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, LoadingSkeleton, PosterCard, PosterCardSkeleton, Text, TextButton, colors, layout, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { EventsStackParamList } from '../../navigation/types';
import { useBookmarks } from '../saved/useBookmarks';
import { eventKeys, fetchEventsPage, type EventCursor } from './api';
import { CLEARED_LIST_PARAMS, activeFilterCount, filterButtonLabel, readListFilters, toListParams, toQueryFilters } from './filters';
import { EVENT_TYPE_FILTERS, toEventPoster, type EventWithOrg } from './labels';

const Separator = () => <View style={{ height: space[3] }} />;

/**
 * Filters live in this screen's route params (the root-stack filter sheet sets them); the native stack keeps the
 * screen mounted while a detail is open, so "filter → detail → back" returns to the same filters and scroll offset.
 */
export function EventsListScreen({ navigation, route }: NativeStackScreenProps<EventsStackParamList, 'EventsList'>) {
  const params = route.params;
  const listFilters = useMemo(() => readListFilters(params), [params]);
  const filters = useMemo(() => toQueryFilters(listFilters), [listFilters]);
  const active = activeFilterCount(listFilters);

  const query = useInfiniteQuery({
    queryKey: eventKeys.list(filters),
    queryFn: ({ pageParam }) => fetchEventsPage(filters, pageParam),
    initialPageParam: null as EventCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const saves = useBookmarks('event');
  const clear = () => navigation.setParams(CLEARED_LIST_PARAMS);

  const renderItem = useCallback(({ item }: { item: EventWithOrg }) => (
    <PosterCard {...toEventPoster(item)} saved={saves.ids.has(item.id)} onToggleSave={() => saves.toggle(item.id)} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />
  ), [navigation, saves.ids, saves.toggle]);

  // Tab root: one display headline, no slogan eyebrow (eyebrow is for categories and status only).
  const header = (
    <View style={{ paddingBottom: space[4] }}>
      <Text variant="display">Bir araya gel.{'\n'}Yeni bir şey başlat.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: space[4], marginTop: space[3] }}>
        <TextButton icon="ticket" label="Katılımlarım" onPress={() => navigation.navigate('MyRegistrations')} />
        <TextButton icon="filter" label={filterButtonLabel(active)}
          accessibilityHint={active > 0 ? `${active} filtre etkin` : undefined}
          onPress={() => navigation.getParent()?.getParent()?.navigate('EventFilters', { ...toListParams(listFilters), listKey: route.key, stackKey: navigation.getState().key })} />
      </View>
      <ChipRail>
        {EVENT_TYPE_FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={listFilters.type === f.value}
            onPress={() => navigation.setParams({ type: f.value === 'all' ? undefined : f.value })} />
        ))}
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
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: space[8] }}
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          query.isPending ? <LoadingSkeleton variant="poster" />
            : query.isError ? <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
              : active > 0 ? <EmptyState icon="filter" title="Bu filtrelerle sonuç yok" body="Filtreleri gevşetip tekrar bakabilirsin." actionLabel="Filtreleri temizle" onAction={clear} />
                : <EmptyState icon="event" title="Yakında burası dolacak" body="Şu an yayında etkinlik yok. Yeni etkinlikler eklendiğinde burada göreceksin." />
        }
        // Next page: the same poster skeleton under the list (no spinner, no "Hepsi bu kadar").
        ListFooterComponent={query.isFetchingNextPage ? <View testID="list-next-skeleton" style={{ marginTop: space[3] }}><PosterCardSkeleton /></View> : null}
        initialNumToRender={4}
        windowSize={7}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}
