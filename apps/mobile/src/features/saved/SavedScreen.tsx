import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, Text, TextButton, space, useToast, type TechIconName } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchSaved, savedKeys, type BookmarkType, type SavedItem } from './api';
import { useBookmarkRemoval } from './useBookmarks';

const TYPE_LABEL: Record<BookmarkType, string> = { event: 'Etkinlik', opportunity: 'Fırsat', team: 'Takım', course: 'Eğitim' };
const TYPE_ICON: Record<BookmarkType, TechIconName> = { event: 'event', opportunity: 'opportunity', team: 'team', course: 'learn' };
const EMPTY_TITLE: Record<BookmarkType, string> = { event: 'Kayıtlı etkinlik yok', opportunity: 'Kayıtlı fırsat yok', team: 'Kayıtlı takım yok', course: 'Kayıtlı eğitim yok' };
const FILTER_ORDER: BookmarkType[] = ['event', 'opportunity', 'team', 'course'];
const GONE_TOAST = 'Bu içerik artık yayında değil. İstersen listeden çıkarabilirsin.';

/**
 * Profil > Kaydedilenler. One list for every kind, newest first. A target that is no longer published keeps its row
 * (dimmed, "Artık yayında değil") with the one action that makes sense: take it off the list. Nothing here opens a 404.
 * "Eğitim" is offered only while a course is saved (a course's save control lives on its cards and detail), so a person
 * who never saved one is not shown a filter for it.
 */
export function SavedScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'Saved'>) {
  const { userId } = useSession();
  const toast = useToast();
  const { remove } = useBookmarkRemoval();
  const [filter, setFilter] = useState<BookmarkType | 'all'>('all');
  const q = useQuery({ queryKey: savedKeys.list(userId), queryFn: () => fetchSaved(userId!), enabled: !!userId });

  const items = q.data ?? [];
  const present = FILTER_ORDER.filter((t) => t !== 'course' || items.some((i) => i.type === 'course'));
  const shown = filter === 'all' ? items : items.filter((i) => i.type === filter);
  const tabs = navigation.getParent();

  const open = (i: SavedItem) => {
    if (!i.available) { toast.show(GONE_TOAST); return; }
    if (i.type === 'event') navigation.navigate('EventDetail', { eventId: i.id });
    else if (i.type === 'opportunity') tabs?.navigate('OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: i.id }, initial: false });
    else if (i.type === 'team') tabs?.navigate('CommunityTab', { screen: 'TeamDetail', params: { teamId: i.id }, initial: false });
    else navigation.navigate('CourseDetail', { courseId: i.id });
  };

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Kaydedilenler" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="title" style={{ marginBottom: space[4] }}>Sonra dönmek için.</Text>
      {!userId ? <EmptyState icon="bookmark" title="Kaydettiklerini görmek için giriş yap" />
        : q.isPending ? <LoadingSkeleton variant="row" rowLines={{ title: 2, secondary: 1, footnote: 'none' }} />
          : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
            : items.length === 0 ? <EmptyState icon="bookmark" title="Henüz kaydettiğin bir şey yok" body="Etkinlik, fırsat ve takımlardaki yer imine dokun; burada toplanır." />
              : (
                <>
                  <View style={{ marginBottom: space[4] }}>
                    <ChipRail>
                      <Chip label="Tümü" selected={filter === 'all'} onPress={() => setFilter('all')} />
                      {present.map((t) => <Chip key={t} label={TYPE_LABEL[t]} selected={filter === t} onPress={() => setFilter(t)} />)}
                    </ChipRail>
                  </View>
                  {shown.length === 0 ? (
                    <EmptyState icon="filter" title={EMPTY_TITLE[filter as BookmarkType]} body="Bu türde kaydettiğin bir şey yok." actionLabel="Tümünü göster" onAction={() => setFilter('all')} />
                  ) : (
                    <ResponsiveGrid>
                      {shown.map((i) => i.available ? (
                        <RowCard key={`${i.type}:${i.id}`} leading={{ kind: 'icon', icon: TYPE_ICON[i.type] }} title={i.title ?? TYPE_LABEL[i.type]} secondary={TYPE_LABEL[i.type]}
                          trailing={{ kind: 'bookmark', saved: true, onToggle: () => void remove(i.type, i.id) }} onPress={() => open(i)} />
                      ) : (
                        <View key={`${i.type}:${i.id}`} style={styles.gone}>
                          <View testID="saved-row-gone" style={styles.dim}>
                            <RowCard leading={{ kind: 'icon', icon: TYPE_ICON[i.type] }} title={`${TYPE_LABEL[i.type]} kaydı`} secondary="Artık yayında değil" onPress={() => open(i)} />
                          </View>
                          <TextButton icon="trash" label="Listeden çıkar" onPress={() => void remove(i.type, i.id)} />
                        </View>
                      ))}
                    </ResponsiveGrid>
                  )}
                </>
              )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gone: { gap: space[1], alignItems: 'flex-start' },
  dim: { opacity: 0.55, alignSelf: 'stretch' },
});
