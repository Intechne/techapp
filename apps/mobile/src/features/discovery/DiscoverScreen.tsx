import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, EventCard, HeroCard, IconButton, ListCard, LoadingSkeleton, MiniCard, OfflineBanner, Screen, SearchInput, SectionHeader, Text, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { InterestRow, OpportunityRow, TeamRow } from '../../lib/database.types';
import type { DiscoverStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchEventsPage } from '../events/api';
import { toEventCardModel } from '../events/labels';
import { usePrefs } from '../onboarding/PrefsProvider';

async function fetchInterests(): Promise<InterestRow[]> {
  const { data, error } = await getSupabase().from('interests').select('*').order('sort_order');
  if (error) throw toAppError(error);
  return data;
}
async function fetchPreview(): Promise<{ opportunities: OpportunityRow[]; teams: TeamRow[] }> {
  const supabase = getSupabase();
  const [o, t] = await Promise.all([
    supabase.from('opportunities').select('*').eq('status', 'published').gte('closes_at', new Date().toISOString()).order('closes_at').limit(3),
    supabase.from('teams').select('*').order('member_count', { ascending: false }).limit(3),
  ]);
  if (o.error) throw toAppError(o.error);
  if (t.error) throw toAppError(t.error);
  return { opportunities: o.data, teams: t.data };
}

export function DiscoverScreen({ navigation }: NativeStackScreenProps<DiscoverStackParamList, 'DiscoverHome'>) {
  const { prefs } = usePrefs();
  const { session } = useSession();
  const [topic, setTopic] = useState<string | 'all' | 'mine'>(prefs.interestSlugs.length ? 'mine' : 'all');
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');

  const interests = useQuery({ queryKey: ['interests'], queryFn: fetchInterests, staleTime: 3_600_000 });
  const topicIds = useMemo(() => {
    const all = interests.data ?? [];
    if (topic === 'all') return undefined;
    const slugs = topic === 'mine' ? prefs.interestSlugs : [topic];
    return all.filter((i) => slugs.includes(i.slug)).map((i) => i.id);
  }, [topic, interests.data, prefs.interestSlugs]);

  const filters = useMemo(() => ({ type: 'all' as const, onlineOnly: false, topicInterestIds: topicIds, search: submitted }), [topicIds, submitted]);
  const events = useQuery({ queryKey: ['discover', 'events', filters], queryFn: () => fetchEventsPage(filters, null), enabled: topic === 'all' || interests.isSuccess });
  const preview = useQuery({ queryKey: ['discover', 'preview'], queryFn: fetchPreview });

  const [featured, ...rest] = events.data?.items ?? [];
  const openEvent = (id: string) => { track('discovery_item_opened', { kind: 'event', id }); navigation.navigate('EventDetail', { eventId: id }); };
  const firstName = session?.user.user_metadata?.first_name as string | undefined;
  const offline = events.isError && toAppError(events.error).code === 'network_unreachable' && !!events.data;

  return (
    <Screen header={<><AppHeader brand right={<IconButton icon="ticket" accessibilityLabel="Katılımlarım" onPress={() => navigation.navigate('MyRegistrations')} />} />{offline && <OfflineBanner />}</>}
      refreshing={events.isRefetching} onRefresh={() => { void events.refetch(); void preview.refetch(); void interests.refetch(); }}>
      <Text variant="bodySmall" color="textSecondary">{firstName ? `Merhaba ${firstName}` : 'Merhaba'}</Text>
      <Text variant="display" style={{ marginTop: space[1] }}>Bir fikrin varsa,{'\n'}bir yerin var.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2], marginBottom: space[4] }}>Keşfet, birlikte üret, iz bırak.</Text>

      <SearchInput placeholder="Etkinlik ara" value={search} onChangeText={(t) => { setSearch(t); if (!t) setSubmitted(''); }} onSubmitEditing={() => setSubmitted(search)} />
      <View style={{ marginTop: space[3], marginBottom: space[4] }}>
        <ChipRail>
          {prefs.interestSlugs.length > 0 && <Chip label="Sana göre" icon="spark" selected={topic === 'mine'} onPress={() => setTopic('mine')} />}
          <Chip label="Tümü" selected={topic === 'all'} onPress={() => setTopic('all')} />
          {(interests.data ?? []).map((i) => <Chip key={i.slug} label={i.label_tr} selected={topic === i.slug} onPress={() => setTopic(i.slug)} />)}
        </ChipRail>
      </View>

      {events.isPending ? <LoadingSkeleton />
        : events.isError && !events.data ? <ErrorState error={toAppError(events.error)} onRetry={() => void events.refetch()} />
          : !featured ? (
            <EmptyState icon="discover" title={submitted ? `“${submitted}” için sonuç yok` : 'Bu alanda şu an etkinlik yok'}
              body="Başka bir konuya bakabilir ya da tüm etkinlikleri görebilirsin." actionLabel="Tümünü göster"
              onAction={() => { setTopic('all'); setSearch(''); setSubmitted(''); }} />
          ) : (
            <>
              {!submitted && (() => { const m = toEventCardModel(featured); return (
                <HeroCard eyebrow={m.typeLabel} title={m.posterLine} accent={m.posterLine.split(' ').slice(-1)[0]} meta={`${m.dateLabel} · ${m.placeLabel} · ${m.feeLabel}`} cta="Detayları gör" onPress={() => openEvent(featured.id)} />
              ); })()}
              <SectionHeader title={submitted ? 'Sonuçlar' : 'Yaklaşan etkinlikler'} actionLabel="Tümünü gör" onAction={() => navigation.getParent()?.navigate('EventsTab')} />
              <View style={{ gap: space[3] }}>
                {(submitted ? [featured, ...rest] : rest).slice(0, 4).map((e) => <EventCard key={e.id} model={toEventCardModel(e)} onPress={() => openEvent(e.id)} />)}
              </View>
            </>
          )}

      {!submitted && preview.data && preview.data.opportunities.length > 0 && (
        <>
          <SectionHeader title="Sıradaki adımın" actionLabel="Fırsatlar" onAction={() => navigation.getParent()?.navigate('OpportunitiesTab')} />
          <View style={{ gap: space[3] }}>
            {preview.data.opportunities.map((o) => <ListCard key={o.id} icon="opportunity" title={o.title} body={o.summary} footnote={`Son başvuru: ${formatDate(o.closes_at)}`} onPress={() => navigation.getParent()?.navigate('OpportunitiesTab')} />)}
          </View>
        </>
      )}
      {!submitted && preview.data && preview.data.teams.length > 0 && (
        <>
          <SectionHeader title="Birlikte üretenler" actionLabel="Topluluk" onAction={() => navigation.getParent()?.navigate('CommunityTab')} />
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {preview.data.teams.slice(0, 2).map((t) => <MiniCard key={t.id} icon={t.kind === 'team' ? 'robot' : 'community'} title={t.name} body={t.tagline ?? ''} onPress={() => navigation.getParent()?.navigate('CommunityTab')} />)}
          </View>
        </>
      )}
    </Screen>
  );
}
