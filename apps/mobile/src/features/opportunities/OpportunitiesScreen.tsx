import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, LoadingSkeleton, Notice, OpportunityCard, Screen, Text, space } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { OpportunityRow } from '../../lib/database.types';

const TYPES: readonly { value: OpportunityRow['type'] | 'all'; label: string }[] = [
  { value: 'all', label: 'Tümü' }, { value: 'internship', label: 'Staj' }, { value: 'volunteering', label: 'Gönüllülük' },
  { value: 'entrepreneurship', label: 'Girişimcilik' }, { value: 'talent_program', label: 'Yetenek programı' }, { value: 'project_call', label: 'Proje çağrısı' },
];

/** Phase 6 foundation: real published opportunities from the backend. The application flow ships with Phase 6. */
export function OpportunitiesScreen() {
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('all');
  const q = useQuery({
    queryKey: ['opportunities', type],
    queryFn: async () => {
      let query = getSupabase().from('opportunities').select('*').eq('status', 'published').gte('closes_at', new Date().toISOString()).order('closes_at').limit(30);
      if (type !== 'all') query = query.eq('type', type);
      const { data, error } = await query;
      if (error) throw toAppError(error);
      return data;
    },
  });
  return (
    <Screen header={<AppHeader brand />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="eyebrow" color="textSecondary">SIRADAKİ ADIMIN BURADA</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Potansiyeline{'\n'}bir kapı aç.</Text>
      <View style={{ marginVertical: space[4] }}>
        <ChipRail>{TYPES.map((t) => <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />)}</ChipRail>
      </View>
      <View style={{ marginBottom: space[4] }}><Notice tone="info">Uygulama içinden başvuru bir sonraki sürümde açılıyor. Şimdilik fırsatları inceleyebilirsin.</Notice></View>
      {q.isPending ? <LoadingSkeleton /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : q.data.length === 0 ? <EmptyState icon="opportunity" title={type === 'all' ? 'Şu an açık fırsat yok' : 'Bu türde açık fırsat yok'} body="Yeni fırsatlar eklendiğinde burada göreceksin." actionLabel={type === 'all' ? undefined : 'Tümünü göster'} onAction={() => setType('all')} />
          : <View style={{ gap: space[3] }}>{q.data.map((o) => (
            <OpportunityCard key={o.id} icon={o.type === 'volunteering' ? 'leaf' : o.type === 'entrepreneurship' ? 'rocket' : 'opportunity'} title={o.title} body={o.summary}
              footnote={[o.is_remote ? 'Çevrim içi' : o.city, o.audience_note, `Son başvuru: ${formatDate(o.closes_at)}`].filter(Boolean).join(' · ')} />))}</View>}
    </Screen>
  );
}
