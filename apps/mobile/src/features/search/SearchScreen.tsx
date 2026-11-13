import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppHeader, Chip, EmptyState, LoadingSkeleton, Notice, RowCard, Screen, SearchInput, SectionHeader, Text, TextButton, formatCount, metaJoin, space, useLayout } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { formatDateRange } from '../../lib/dates';
import type { DiscoverStackParamList, MainTabParamList } from '../../navigation/types';
import { EVENT_TYPE_ICON, EVENT_TYPE_LABEL, placeLabel } from '../events/labels';
import { OPPORTUNITY_ROW_LINES, toOpportunityRow } from '../opportunities/labels';
import { categoryIcon } from '../teams/categoryIcon';
import { courseMeta } from '../learning/labels';
import { EXPANDED_LIMIT, GROUP_LIMIT, SEARCH_GROUPS, useSearchGroups, type EventSearchRow, type SearchGroupKey, type SearchHits } from './api';
import { normalizeQuery, SEARCH_DEBOUNCE_MS, toTurkishLower } from './query';
import { useDebouncedValue } from './useDebouncedValue';

const TITLE: Record<SearchGroupKey, string> = { events: 'Etkinlikler', opportunities: 'Fırsatlar', teams: 'Takımlar', courses: 'Eğitimler' };
const HINT = 'En az 2 harf yaz; etkinlik, fırsat, takım ve eğitimlerde ararız.';
const MEMBER = { one: 'üye', other: 'üye' };
const CHEVRON = { kind: 'chevron' } as const;
/** The poster's type label is capitals ("YARIŞMA"); a row reads it like the opportunity rows do ("Yarışma"). */
const sentenceCase = (s: string) => s.charAt(0) + toTurkishLower(s.slice(1));

/**
 * Keşfet > Arama: one field (focused on arrival, no recent searches — decision), results grouped as Etkinlikler,
 * Fırsatlar, Takımlar, Eğitimler, at most 5 each. A group with more gets "Tümünü gör", which opens this screen again for
 * that group alone (up to 30): none of the list screens can filter by text, so sending the query there would be ignored.
 * Each group is its own request: one failing says so inline and the others still show.
 */
export function SearchScreen({ navigation, route }: NativeStackScreenProps<DiscoverStackParamList, 'Search'>) {
  const group = route.params?.group;
  const [text, setText] = useState(route.params?.query ?? '');
  const typed = normalizeQuery(text);
  const q = normalizeQuery(useDebouncedValue(text, SEARCH_DEBOUNCE_MS));
  const groups = group ? [group] : SEARCH_GROUPS;
  const limit = group ? EXPANDED_LIMIT : GROUP_LIMIT;
  const results = useSearchGroups(q, groups, limit);
  const { gutter, readingMaxWidth } = useLayout();
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const open = {
    events: (id: string) => navigation.navigate('EventDetail', { eventId: id }),
    opportunities: (id: string) => tabs?.navigate('OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: id }, initial: false }),
    teams: (id: string) => tabs?.navigate('CommunityTab', { screen: 'TeamDetail', params: { teamId: id }, initial: false }),
    courses: (id: string) => navigation.navigate('CourseDetail', { courseId: id }),
  };
  const browse = [
    { label: 'Etkinliklere göz at', go: () => navigation.getParent()?.navigate('EventsTab') },
    { label: 'Fırsatlara göz at', go: () => navigation.getParent()?.navigate('OpportunitiesTab') },
    { label: 'Takımlara göz at', go: () => navigation.getParent()?.navigate('CommunityTab') },
    { label: 'Eğitimlere göz at', go: () => navigation.navigate('CourseList') },
  ];

  const settled = !!q && results.every((r) => !r.isPending);
  const noResults = settled && results.every((r) => r.isSuccess && r.data.hits.length === 0);

  const row = (g: SearchGroupKey, hit: SearchHits[SearchGroupKey]) => {
    const onPress = () => open[g](hit.id);
    if (g === 'events') {
      const e = hit as EventSearchRow;
      return <RowCard key={e.id} leading={e.cover_path ? { kind: 'image', path: e.cover_path, blurhash: e.cover_blurhash, fallbackIcon: EVENT_TYPE_ICON[e.type] } : { kind: 'icon', icon: EVENT_TYPE_ICON[e.type] }}
        title={e.title} secondary={metaJoin([sentenceCase(EVENT_TYPE_LABEL[e.type]), placeLabel(e)])} footnote={formatDateRange(e.starts_at, e.ends_at)} isDemo={e.is_demo} trailing={CHEVRON} onPress={onPress} />;
    }
    if (g === 'opportunities') return <RowCard key={hit.id} {...toOpportunityRow(hit as SearchHits['opportunities'])} trailing={CHEVRON} onPress={onPress} />;
    if (g === 'teams') {
      const t = hit as SearchHits['teams'];
      return <RowCard key={t.id} leading={{ kind: 'icon', icon: categoryIcon(t.category_key, t.kind) }} title={t.name} secondary={t.tagline ?? undefined}
        footnote={metaJoin([formatCount(t.member_count, MEMBER), t.category, t.city])} isDemo={t.is_demo} trailing={CHEVRON} onPress={onPress} />;
    }
    const c = hit as SearchHits['courses'];
    return <RowCard key={c.id} leading={{ kind: 'icon', icon: 'learn' }} title={c.title} secondary={courseMeta(c)} isDemo={c.is_demo} trailing={CHEVRON} onPress={onPress} />;
  };

  return (
    <Screen header={(
      <>
        <AppHeader onBack={navigation.goBack} title={group ? TITLE[group] : 'Ara'} />
        <View style={{ paddingHorizontal: gutter, paddingBottom: space[2] }}>
          <View style={{ width: '100%', maxWidth: readingMaxWidth, alignSelf: 'center' }}>
            <SearchInput autoFocus placeholder="Etkinlik, fırsat, takım ara" value={text} onChangeText={setText} clearButtonMode="while-editing" />
          </View>
        </View>
      </>
    )}>
      {!typed ? (
        <Text variant="bodySmall" color="textSecondary" style={{ marginTop: space[3] }}>{HINT}</Text>
      ) : !q ? (
        <LoadingSkeleton variant="row" cards={2} />
      ) : noResults ? (
        <View style={{ marginTop: space[5], gap: space[2] }}>
          <EmptyState icon="search" title={`“${q}” için sonuç yok`} body="Daha kısa ya da farklı bir sözcük dene, ya da şunlara göz at:" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] }}>{browse.map((b) => <Chip key={b.label} label={b.label} onPress={b.go} />)}</View>
        </View>
      ) : (
        groups.map((g, i) => {
          const r = results[i]!;
          const header = (action?: { actionLabel: string; onAction: () => void }) => (group ? null : <SectionHeader title={TITLE[g]} {...action} />);
          if (r.isPending) {
            return <View key={g}>{header()}<LoadingSkeleton variant="row" cards={group ? 3 : 2} rowLines={g === 'opportunities' ? OPPORTUNITY_ROW_LINES : undefined} /></View>;
          }
          if (r.isError) {
            const error = toAppError(r.error);
            return (
              <View key={g}>
                {header()}
                <View style={{ gap: space[2], alignItems: 'flex-start', marginTop: group ? space[3] : 0 }}>
                  <Notice tone="warning" title={`${TITLE[g]} yüklenemedi`}>{error.message}</Notice>
                  {error.retryable && <TextButton label="Tekrar dene" onPress={() => void r.refetch()} />}
                </View>
              </View>
            );
          }
          if (r.data.hits.length === 0) return null;
          const more = r.data.hasMore && !group ? { actionLabel: 'Tümünü gör', onAction: () => navigation.push('Search', { query: q, group: g }) } : undefined;
          return (
            <View key={g}>
              {header(more)}
              <View style={{ gap: space[3], marginTop: group ? space[3] : 0 }}>{r.data.hits.map((h) => row(g, h))}</View>
              {group && r.data.hasMore && (
                <Text variant="caption" color="textSecondary" style={{ marginTop: space[3] }}>İlk {EXPANDED_LIMIT} sonuç gösteriliyor; aramanı daraltabilirsin.</Text>
              )}
            </View>
          );
        })
      )}
    </Screen>
  );
}
