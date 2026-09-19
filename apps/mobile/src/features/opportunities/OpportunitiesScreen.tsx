import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, Screen, Text, TextButton, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { toAppError } from '../../lib/errors';
import type { OpportunityType } from '../../lib/database.types';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { fetchOpportunities, opportunityKeys } from './api';
import { OPPORTUNITY_TYPE, TYPE_FILTERS } from './labels';
import { OpportunityCardView } from './OpportunityCardView';
import { useFollowedOpportunities } from './useFollow';

export function OpportunitiesScreen({ navigation }: NativeStackScreenProps<OpportunitiesStackParamList, 'OpportunitiesHome'>) {
  const [type, setType] = useState<OpportunityType | 'all'>('all');
  const q = useQuery({ queryKey: opportunityKeys.list(type, false), queryFn: () => fetchOpportunities(type) });
  const follow = useFollowedOpportunities();
  const open = (id: string) => { track('opportunity_opened', { opportunity_id: id }); navigation.navigate('OpportunityDetail', { opportunityId: id }); };

  return (
    <Screen wide header={<AppHeader brand />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="eyebrow" color="textSecondary">SIRADAKİ ADIMIN BURADA</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Potansiyeline{'\n'}bir kapı aç.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>Yarışmalar, hibeler, ödüller, burslar, stajlar ve programlar. Son tarihi kaçırma.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: space[3] }}>
        <TextButton icon="clock" label="Son tarihler" onPress={() => navigation.navigate('Deadlines')} />
        <TextButton icon="check" label="Başvurularım" onPress={() => navigation.navigate('MyApplications')} />
      </View>
      <View style={{ marginBottom: space[4] }}>
        <ChipRail>{TYPE_FILTERS.map((t) => <Chip key={t} label={t === 'all' ? 'Tümü' : OPPORTUNITY_TYPE[t].label} selected={type === t} onPress={() => setType(t)} />)}</ChipRail>
      </View>
      {q.isPending ? <LoadingSkeleton /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon="opportunity" title={type === 'all' ? 'Şu an açık çağrı yok' : 'Bu türde açık çağrı yok'} body="Yeni çağrılar eklendiğinde burada göreceksin." actionLabel={type === 'all' ? undefined : 'Tümünü göster'} onAction={() => setType('all')} />
          : <ResponsiveGrid>{q.data.map((o) => <OpportunityCardView key={o.id} item={o} followed={follow.ids.has(o.id)} onPress={() => open(o.id)} onToggleFollow={follow.requiresAuth ? undefined : () => follow.toggle(o.id)} />)}</ResponsiveGrid>}
    </Screen>
  );
}
