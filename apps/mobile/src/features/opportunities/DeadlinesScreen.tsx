import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, Screen, SegmentedControl, Tag, Text, colors, radius, space, tones } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { fetchOpportunities, opportunityKeys } from './api';
import { OPPORTUNITY_TYPE, deadlineView, groupByMonth, urgencyTone } from './labels';
import { useFollowedOpportunities } from './useFollow';

const SEGMENTS = ['Tüm son tarihler', 'Takip ettiklerim'] as const;
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', timeZone: 'Europe/Istanbul' });
const weekdayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' });

/** Deadline calendar: every open call ordered by its closing date, grouped by month. */
export function DeadlinesScreen({ navigation }: NativeStackScreenProps<OpportunitiesStackParamList, 'Deadlines'>) {
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Tüm son tarihler');
  const q = useQuery({ queryKey: opportunityKeys.list('all', false), queryFn: () => fetchOpportunities('all') });
  const follow = useFollowedOpportunities();
  const rows = useMemo(() => (q.data ?? []).filter((o) => segment === 'Tüm son tarihler' || follow.ids.has(o.id)), [q.data, segment, follow.ids]);
  const groups = useMemo(() => groupByMonth(rows), [rows]);

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Son tarihler" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="display">Takvimi{'\n'}kaçırma.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2], marginBottom: space[4] }}>Yarışma, hibe, ödül ve program başvurularının kapanış tarihleri.</Text>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      <View style={{ height: space[4] }} />
      {q.isPending ? <LoadingSkeleton /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : groups.length === 0 ? (
          segment === 'Takip ettiklerim'
            ? <EmptyState icon="bookmark" title={follow.requiresAuth ? 'Takip etmek için giriş yap' : 'Henüz takip ettiğin bir çağrı yok'} body="Bir çağrının üzerindeki yer imine dokun; son tarihi burada görünsün." actionLabel="Tüm son tarihleri göster" onAction={() => setSegment('Tüm son tarihler')} />
            : <EmptyState icon="clock" title="Yaklaşan son tarih yok" body="Yeni çağrılar açıldığında burada sıralanacak." />
        ) : groups.map((g) => (
          <View key={g.month} style={{ marginBottom: space[6] }}>
            <Text variant="eyebrow" color="textSecondary" style={{ marginBottom: space[3] }}>{g.month.toLocaleUpperCase('tr')}</Text>
            <ResponsiveGrid maxColumns={2}>
              {g.items.map((o) => { const d = deadlineView(o.closes_at); return (
                <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${o.title}. ${d.label}.`} onPress={() => navigation.navigate('OpportunityDetail', { opportunityId: o.id })}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: space[3], alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space[3], opacity: pressed ? 0.85 : 1 })}>
                  <View style={{ width: 56, minHeight: 60, borderRadius: radius.control, backgroundColor: d.urgency === 'upcoming' ? colors.primarySoft : tones.apricot.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text variant="section" color={d.urgency === 'upcoming' ? 'primary' : 'ink'}>{dayFmt.format(new Date(o.closes_at))}</Text>
                    <Text variant="caption" color="textSecondary">{weekdayFmt.format(new Date(o.closes_at))}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="label" numberOfLines={2}>{o.title}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}><Tag label={OPPORTUNITY_TYPE[o.type].label.toLocaleUpperCase('tr')} /><Tag label={d.label.toLocaleUpperCase('tr')} tone={urgencyTone(d.urgency)} /></View>
                  </View>
                </Pressable>); })}
            </ResponsiveGrid>
          </View>))}
    </Screen>
  );
}
