import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, Text, TextButton, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { toAppError } from '../../lib/errors';
import type { OpportunityType } from '../../lib/database.types';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { fetchOpportunities, opportunityKeys } from './api';
import { OPPORTUNITY_TYPE, OPPORTUNITY_ROW_LINES, TYPE_FILTERS, isOpen, toOpportunityRow } from './labels';
import { useFollowedOpportunities } from './useFollow';

/** Saving an opportunity means following its deadline: the control is the card bookmark, the words stay specific. */
const FOLLOW_LABELS = { save: 'Son tarihi takip et', unsave: 'Takipten çıkar' };

export function OpportunitiesScreen({ navigation }: NativeStackScreenProps<OpportunitiesStackParamList, 'OpportunitiesHome'>) {
  const [type, setType] = useState<OpportunityType | 'all'>('all');
  const q = useQuery({ queryKey: opportunityKeys.list(type), queryFn: () => fetchOpportunities(type) });
  const follow = useFollowedOpportunities();
  // The server only returns open calls; this also drops one whose deadline passed while the screen stayed open.
  const rows = (q.data ?? []).filter((o) => isOpen(o));
  const open = (id: string) => { track('opportunity_opened', { opportunity_id: id }); navigation.navigate('OpportunityDetail', { opportunityId: id }); };

  return (
    <Screen wide header={<AppHeader brand />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {/* No slogan eyebrow or category paragraph (approved F1): the chips below already say what is here. */}
      <Text variant="display">Potansiyeline{'\n'}bir kapı aç.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: space[3] }}>
        <TextButton icon="clock" label="Son tarihler" onPress={() => navigation.navigate('Deadlines')} />
        <TextButton icon="check" label="Başvurularım" onPress={() => navigation.navigate('MyApplications')} />
      </View>
      <View style={{ marginBottom: space[4] }}>
        <ChipRail>{TYPE_FILTERS.map((t) => <Chip key={t} label={t === 'all' ? 'Tümü' : OPPORTUNITY_TYPE[t].label} selected={type === t} onPress={() => setType(t)} />)}</ChipRail>
      </View>
      {q.isPending ? <LoadingSkeleton variant="row" rowLines={OPPORTUNITY_ROW_LINES} /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : rows.length === 0 ? <EmptyState icon="opportunity" title={type === 'all' ? 'Şu an açık çağrı yok' : 'Bu türde açık çağrı yok'} body="Yeni çağrılar eklendiğinde burada göreceksin." actionLabel={type === 'all' ? undefined : 'Tümünü göster'} onAction={() => setType('all')} />
          : (
            <ResponsiveGrid>
              {rows.map((o) => (
                <RowCard key={o.id} {...toOpportunityRow(o)}
                  trailing={follow.requiresAuth ? { kind: 'chevron' } : { kind: 'bookmark', saved: follow.ids.has(o.id), onToggle: () => follow.toggle(o.id), labels: FOLLOW_LABELS }}
                  onPress={() => open(o.id)} />
              ))}
            </ResponsiveGrid>
          )}
    </Screen>
  );
}
