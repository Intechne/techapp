import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, SegmentedControl, Text, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { fetchOpportunities, opportunityKeys } from './api';
import { FOLLOW_LABELS, OPPORTUNITY_ROW_LINES, groupByHorizon, toOpportunityRow } from './labels';
import { useBookmarks } from '../saved/useBookmarks';

const SEGMENTS = ['Tüm son tarihler', 'Takip ettiklerim'] as const;
/** Deadline calendar: every open call ordered by its closing date, grouped Bu hafta / Bu ay / Sonra. */
export function DeadlinesScreen({ navigation }: NativeStackScreenProps<OpportunitiesStackParamList, 'Deadlines'>) {
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Tüm son tarihler');
  const q = useQuery({ queryKey: opportunityKeys.list('all'), queryFn: () => fetchOpportunities('all') });
  const follow = useBookmarks('opportunity');
  const groups = useMemo(() => groupByHorizon((q.data ?? []).filter((o) => segment === 'Tüm son tarihler' || follow.ids.has(o.id))), [q.data, segment, follow.ids]);

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Son tarihler" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="title" style={{ marginBottom: space[4] }}>Takvimi kaçırma.</Text>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      <View style={{ height: space[4] }} />
      {q.isPending ? <LoadingSkeleton variant="row" rowLines={OPPORTUNITY_ROW_LINES} /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : groups.length === 0 ? (
          segment === 'Takip ettiklerim'
            ? <EmptyState icon="bookmark" title={follow.requiresAuth ? 'Takip etmek için giriş yap' : 'Henüz takip ettiğin bir çağrı yok'} body="Bir çağrının üzerindeki yer imine dokun; son tarihi burada görünsün." actionLabel="Tüm son tarihleri göster" onAction={() => setSegment('Tüm son tarihler')} />
            : <EmptyState icon="clock" title="Yaklaşan son tarih yok" body="Yeni çağrılar açıldığında burada sıralanacak." />
        ) : groups.map((g, i) => (
          <View key={g.label} style={{ marginTop: i === 0 ? 0 : space[6] }}>
            <Text variant="eyebrow" color="textSecondary" accessibilityRole="header" style={{ marginBottom: space[3] }}>{g.label.toLocaleUpperCase('tr')}</Text>
            <ResponsiveGrid>
              {g.items.map((o) => (
                <RowCard key={o.id} {...toOpportunityRow(o)}
                  trailing={{ kind: 'bookmark', saved: follow.ids.has(o.id), onToggle: () => follow.toggle(o.id), labels: FOLLOW_LABELS }}
                  onPress={() => navigation.navigate('OpportunityDetail', { opportunityId: o.id })} />
              ))}
            </ResponsiveGrid>
          </View>))}
    </Screen>
  );
}
