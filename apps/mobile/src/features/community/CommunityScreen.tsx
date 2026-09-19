import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, Notice, Screen, SegmentedControl, TeamCard, Text, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';

const SEGMENTS = ['Topluluklar', 'Takımlar'] as const;

/** Phase 7 foundation: real teams/communities from the backend. Join requests and "Takımım" ship with Phase 7. */
export function CommunityScreen() {
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Topluluklar');
  const kind = segment === 'Takımlar' ? 'team' : 'community';
  const q = useQuery({
    queryKey: ['teams', kind],
    queryFn: async () => {
      const { data, error } = await getSupabase().from('teams').select('*').eq('kind', kind).order('member_count', { ascending: false }).limit(30);
      if (error) throw toAppError(error);
      return data;
    },
  });
  return (
    <Screen header={<AppHeader brand />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="eyebrow" color="textSecondary">BİRLİKTE DAHA FAZLASI</Text>
      <Text variant="display" style={{ marginTop: space[2], marginBottom: space[4] }}>Senin gibi{'\n'}merak edenler.</Text>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      <View style={{ marginVertical: space[4] }}><Notice tone="info">Katılma isteği ve Takımım alanı bir sonraki sürümde açılıyor.</Notice></View>
      {q.isPending ? <LoadingSkeleton /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon="community" title="Burası yakında dolacak" body="İlk topluluklar ve takımlar eklendiğinde burada göreceksin." />
          : <View style={{ gap: space[3] }}>{q.data.map((t) => (
            <TeamCard key={t.id} icon={kind === 'team' ? 'robot' : 'community'} title={t.name} body={t.tagline ?? undefined}
              footnote={[t.category, t.city, `${t.member_count} üye`].filter(Boolean).join(' · ')} />))}</View>}
    </Screen>
  );
}
