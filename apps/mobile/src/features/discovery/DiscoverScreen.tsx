import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, HeroCard, IconButton, LoadingSkeleton, MiniCard, OfflineBanner, PosterCard, RowCard, Screen, SearchInput, SectionHeader, Text, keepTogether, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { InterestRow, OpportunityRow, TeamRow } from '../../lib/database.types';
import type { DiscoverStackParamList, MainTabParamList } from '../../navigation/types';
import { useMyProfile } from '../profile/api';
import { fetchEventsPage } from '../events/api';
import { toEventPoster } from '../events/labels';
import { OPPORTUNITY_TYPE } from '../opportunities/labels';
import { kindIcon } from '../teams/labels';
import { usePrefs } from '../onboarding/PrefsProvider';
import { TEAM_PUBLIC_COLUMNS } from '../teams/api';
import { pickFeatured } from './featured';

async function fetchInterests(): Promise<InterestRow[]> {
  const { data, error } = await getSupabase().from('interests').select('*').order('sort_order');
  if (error) throw toAppError(error);
  return data;
}
async function fetchPreview(): Promise<{ opportunities: OpportunityRow[]; teams: TeamRow[] }> {
  const supabase = getSupabase();
  const [o, t] = await Promise.all([
    supabase.from('opportunities').select('*').eq('status', 'published').gte('closes_at', new Date().toISOString()).order('closes_at').limit(3),
    supabase.from('teams').select(TEAM_PUBLIC_COLUMNS).order('member_count', { ascending: false }).limit(3),
  ]);
  if (o.error) throw toAppError(o.error);
  if (t.error) throw toAppError(t.error);
  return { opportunities: o.data, teams: t.data };
}

export function DiscoverScreen({ navigation }: NativeStackScreenProps<DiscoverStackParamList, 'DiscoverHome'>) {
  const { prefs } = usePrefs();
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

  const items = events.data?.items ?? [];
  const featured = submitted ? null : pickFeatured(items, new Date());
  const listed = (submitted ? items : items.filter((e) => e.id !== featured?.id)).slice(0, 4);
  const openEvent = (id: string) => { track('discovery_item_opened', { kind: 'event', id }); navigation.navigate('EventDetail', { eventId: id }); };
  const tabs = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  // Straight to the detail inside the right tab; initial: false keeps that tab's list underneath, so Back returns to it.
  const openOpportunity = (id: string) => {
    track('discovery_item_opened', { kind: 'opportunity', id });
    tabs?.navigate('OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: id }, initial: false });
  };
  const openTeam = (id: string) => {
    track('discovery_item_opened', { kind: 'team', id });
    tabs?.navigate('CommunityTab', { screen: 'TeamDetail', params: { teamId: id }, initial: false });
  };
  const firstName = useMyProfile().data?.display_name?.split(' ')[0];
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

      {events.isPending ? <LoadingSkeleton variant="poster" />
        : events.isError && !events.data ? <ErrorState error={toAppError(events.error)} onRetry={() => void events.refetch()} />
          : items.length === 0 ? (
            <EmptyState icon="discover" title={submitted ? `“${submitted}” için sonuç yok` : 'Bu alanda şu an etkinlik yok'}
              body="Başka bir konuya bakabilir ya da tüm etkinlikleri görebilirsin." actionLabel="Tümünü göster"
              onAction={() => { setTopic('all'); setSearch(''); setSubmitted(''); }} />
          ) : (
            <>
              {featured && (() => { const m = toEventPoster(featured); const line = m.fallback.line; return (
                <HeroCard eyebrow={m.typeLabel} title={line} accent={line.split(' ').slice(-1)[0]} meta={`${m.dateLabel} · ${m.placeLabel} · ${m.feeLabel}`} cta="Detayları gör" onPress={() => openEvent(featured.id)} />
              ); })()}
              <SectionHeader title={submitted ? 'Sonuçlar' : 'Yaklaşan etkinlikler'} actionLabel="Tümünü gör" onAction={() => navigation.getParent()?.navigate('EventsTab')} />
              <View style={{ gap: space[3] }}>
                {listed.map((e) => <PosterCard key={e.id} {...toEventPoster(e)} onPress={() => openEvent(e.id)} />)}
              </View>
            </>
          )}

      {!submitted && preview.data && preview.data.opportunities.length > 0 && (
        <>
          <SectionHeader title="Sıradaki adımın" actionLabel="Fırsatlar" onAction={() => navigation.getParent()?.navigate('OpportunitiesTab')} />
          <View style={{ gap: space[3] }}>
            {preview.data.opportunities.map((o) => (
              <RowCard key={o.id} leading={{ kind: 'icon', icon: OPPORTUNITY_TYPE[o.type].icon }} title={o.title} secondary={o.summary}
                footnote={`Son başvuru: ${keepTogether(formatDate(o.closes_at))}`} isDemo={o.is_demo} trailing={{ kind: 'chevron' }} onPress={() => openOpportunity(o.id)} />
            ))}
          </View>
        </>
      )}
      {!submitted && preview.data && preview.data.teams.length > 0 && (
        <>
          <SectionHeader title="Birlikte üretenler" actionLabel="Topluluk" onAction={() => navigation.getParent()?.navigate('CommunityTab')} />
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            {preview.data.teams.slice(0, 2).map((t) => <MiniCard key={t.id} icon={kindIcon(t.kind)} title={t.name} body={t.tagline ?? undefined} onPress={() => openTeam(t.id)} />)}
          </View>
        </>
      )}
    </Screen>
  );
}
