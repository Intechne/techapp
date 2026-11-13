import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Chip, ChipRail, EmptyState, ErrorState, HeroCard, IconButton, LoadingSkeleton, MiniCard, MiniCardGrid, Notice, OfflineBanner, PosterCard, RowCard, Screen, SearchInput, SectionHeader, Text, TextButton, metaJoin, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { InterestRow, TeamRow } from '../../lib/database.types';
import type { DiscoverStackParamList, MainTabParamList } from '../../navigation/types';
import { useMyProfile } from '../profile/api';
import { fetchEventsPage } from '../events/api';
import { isRegistrationClosed, toEventPoster } from '../events/labels';
import { OPPORTUNITY_CARD_COLUMNS, type OpportunityCardRow } from '../opportunities/api';
import { OPPORTUNITY_ROW_LINES, toOpportunityRow } from '../opportunities/labels';
import { teamIcon } from '../teams/labels';
import { usePrefs } from '../onboarding/PrefsProvider';
import { TEAM_PUBLIC_COLUMNS } from '../teams/api';
import { pickFeatured } from './featured';

async function fetchInterests(): Promise<InterestRow[]> {
  const { data, error } = await getSupabase().from('interests').select('*').order('sort_order');
  if (error) throw toAppError(error);
  return data;
}
type OpportunityPreview = OpportunityCardRow;
async function fetchPreview(): Promise<{ opportunities: OpportunityPreview[]; teams: TeamRow[] }> {
  const supabase = getSupabase();
  const [o, t] = await Promise.all([
    supabase.from('opportunities').select(OPPORTUNITY_CARD_COLUMNS).eq('status', 'published').gte('closes_at', new Date().toISOString()).order('closes_at').limit(3),
    supabase.from('teams').select(TEAM_PUBLIC_COLUMNS).order('member_count', { ascending: false }).limit(3),
  ]);
  if (o.error) throw toAppError(o.error);
  if (t.error) throw toAppError(t.error);
  return { opportunities: o.data as unknown as OpportunityPreview[], teams: t.data };
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

  const filters = useMemo(() => ({ type: 'all' as const, topicInterestIds: topicIds, search: submitted, registrationOpenOnly: !submitted }), [topicIds, submitted]);
  const events = useQuery({ queryKey: ['discover', 'events', filters], queryFn: () => fetchEventsPage(filters, null), enabled: topic === 'all' || interests.isSuccess });
  const preview = useQuery({ queryKey: ['discover', 'preview'], queryFn: fetchPreview });

  const items = events.data?.items ?? [];
  // "Yaklaşan" is what can still be joined: events whose registration closed stay in the Etkinlikler list only (approved Q4a).
  // A search is a result list, not "Yaklaşan", so it keeps every match.
  const now = new Date();
  const upcoming = submitted ? items : items.filter((e) => !isRegistrationClosed(e, now.getTime()));
  const featured = submitted ? null : pickFeatured(upcoming, now);
  const listed = (submitted ? upcoming : upcoming.filter((e) => e.id !== featured?.id)).slice(0, 3);
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

  const filteredTopic = topic !== 'all' || !!submitted;
  const p = submitted ? null : preview.data;
  const hasRest = !!p && (p.opportunities.length > 0 || p.teams.length > 0);
  // Every section hides when it has nothing; only when all of them are empty does one empty state stand in for the page.
  const allEmpty = events.isSuccess && upcoming.length === 0 && !filteredTopic && preview.isSuccess && !hasRest;

  // Nothing else on the page could render, and the secondary query is what failed: say so instead of showing a blank page.
  const previewFailedAlone = preview.isError && events.isSuccess && upcoming.length === 0 && !filteredTopic;
  const previewFailedInline = preview.isError && !submitted && !previewFailedAlone;
  const interestsFailed = topic !== 'all' && interests.isError;

  return (
    <Screen header={<><AppHeader brand right={<IconButton icon="ticket" accessibilityLabel="Katılımlarım" onPress={() => navigation.navigate('MyRegistrations')} />} />{offline && <OfflineBanner />}</>}
      refreshing={events.isRefetching} onRefresh={() => { void events.refetch(); void preview.refetch(); void interests.refetch(); }}>
      <Text variant="bodySmall" color="textSecondary">{firstName ? `Merhaba ${firstName}` : 'Merhaba'}</Text>
      <Text variant="display" style={{ marginTop: space[1], marginBottom: space[5] }}>Bir fikrin varsa,{'\n'}bir yerin var.</Text>

      {/* 3b'ye bağlı: once the Search route exists this field only navigates to it (no in-place search). */}
      <SearchInput placeholder="Etkinlik ara" value={search} onChangeText={(t) => { setSearch(t); if (!t) setSubmitted(''); }} onSubmitEditing={() => setSubmitted(search)} />
      <View style={{ marginTop: space[3], marginBottom: space[5] }}>
        <ChipRail>
          {prefs.interestSlugs.length > 0 && <Chip label="Sana göre" icon="spark" selected={topic === 'mine'} onPress={() => setTopic('mine')} />}
          <Chip label="Tümü" selected={topic === 'all'} onPress={() => setTopic('all')} />
          {(interests.data ?? []).map((i) => <Chip key={i.slug} label={i.label_tr} selected={topic === i.slug} onPress={() => setTopic(i.slug)} />)}
        </ChipRail>
      </View>

      {allEmpty ? (
        <EmptyState icon="discover" title="Şu an yayında içerik yok" body="İlgi alanlarını genişlet; yeni etkinlik ve fırsatlar eklendikçe burada görünür." />
      ) : interestsFailed ? <ErrorState error={toAppError(interests.error)} onRetry={() => void interests.refetch()} />
        : previewFailedAlone ? <ErrorState error={toAppError(preview.error)} onRetry={() => void preview.refetch()} />
        : events.isPending ? <LoadingSkeleton variant="poster" />
        : events.isError && !events.data ? <ErrorState error={toAppError(events.error)} onRetry={() => void events.refetch()} />
          : upcoming.length === 0 ? (filteredTopic && (
            <>
              <SectionHeader title={submitted ? 'Sonuçlar' : 'Yaklaşan etkinlikler'} />
              <EmptyState icon="filter" title={submitted ? `“${submitted}” için sonuç yok` : 'Bu filtrelerle sonuç yok'}
                body="Başka bir konuya bakabilir ya da tüm etkinlikleri görebilirsin." actionLabel="Filtreleri temizle"
                onAction={() => { setTopic('all'); setSearch(''); setSubmitted(''); }} />
            </>
          )) : (
            <>
              {featured && (() => { const m = toEventPoster(featured); const line = m.fallback.line; return (
                <HeroCard category={m.typeLabel} title={line} accent={line.split(' ').slice(-1)[0]} meta={metaJoin([m.dateLabel, m.placeLabel, m.feeLabel])} cta="Detayları gör" cover={m.cover} onPress={() => openEvent(featured.id)} />
              ); })()}
              {/* No vitrin: the list moves up; nothing reserves the hero's space. */}
              <SectionHeader title={submitted ? 'Sonuçlar' : 'Yaklaşan etkinlikler'} {...(submitted ? {} : { actionLabel: 'Tümünü gör', onAction: () => navigation.getParent()?.navigate('EventsTab') })} />
              <View style={{ gap: space[3] }}>
                {listed.map((e) => <PosterCard key={e.id} {...toEventPoster(e)} onPress={() => openEvent(e.id)} />)}
              </View>
            </>
          )}

      {previewFailedInline && !interestsFailed && (
        <View style={{ marginTop: space[7], gap: space[2], alignItems: 'flex-start' }}>
          <Notice tone="warning" title="Fırsatlar ve takımlar yüklenemedi">{toAppError(preview.error).message}</Notice>
          <TextButton label="Tekrar dene" onPress={() => void preview.refetch()} />
        </View>
      )}
      {!allEmpty && !submitted && !events.isPending && preview.isPending && (
        <>
          <SectionHeader title="Sıradaki adımın" />
          <LoadingSkeleton variant="row" cards={2} rowLines={OPPORTUNITY_ROW_LINES} />
        </>
      )}
      {!allEmpty && p && p.opportunities.length > 0 && (
        <>
          <SectionHeader title="Sıradaki adımın" actionLabel="Tümünü gör" onAction={() => navigation.getParent()?.navigate('OpportunitiesTab')} />
          <View style={{ gap: space[3] }}>
            {p.opportunities.map((o) => (
              <RowCard key={o.id} {...toOpportunityRow(o)} trailing={{ kind: 'chevron' }} onPress={() => openOpportunity(o.id)} />
            ))}
          </View>
        </>
      )}
      {!allEmpty && p && p.teams.length > 0 && (
        <>
          <SectionHeader title="Birlikte üretenler" actionLabel="Tümünü gör" onAction={() => navigation.getParent()?.navigate('CommunityTab')} />
          <MiniCardGrid>
            {p.teams.slice(0, 2).map((t) => <MiniCard key={t.id} icon={teamIcon(t)} title={t.name} body={t.tagline ?? undefined} onPress={() => openTeam(t.id)} />)}
          </MiniCardGrid>
        </>
      )}
      {/* Gelişim stays hidden until a course screen exists (approved Q4b); no course request either. */}
    </Screen>
  );
}
