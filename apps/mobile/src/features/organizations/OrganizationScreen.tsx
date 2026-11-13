import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Divider, ErrorState, LoadingSkeleton, DemoTag, PosterCard, ReadMoreText, RowCard, Screen, Tag, TechIcon, Text, TextButton, colors, radius, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { openExternalUrl } from '../../lib/links';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { toEventPoster } from '../events/labels';
import { FOLLOW_LABELS, toOpportunityRow } from '../opportunities/labels';
import { ReportLink, ReportSheet, type ReportSubject } from '../reports/ReportSheet';
import { useBookmarks } from '../saved/useBookmarks';
import { fetchOrganization, fetchOrganizationEvents, fetchOrganizationOpportunities, organizationKeys, type OrgType } from './api';

const ORG_TYPE_LABEL: Record<OrgType, string> = {
  intechne: 'INTECHNE', company: 'ŞİRKET', university: 'ÜNİVERSİTE', school: 'OKUL', ngo: 'SİVİL TOPLUM KURULUŞU', community: 'TOPLULUK', public_institution: 'KAMU KURUMU',
};

type Props = NativeStackScreenProps<SharedEventParamList, 'Organization'>;

/**
 * Kurum profili (Faz 4: logo + ad + doğrulama → hakkında → etkinlikler → fırsatlar). The name is the organisation's own text and is
 * shown whole, as written. No logo pipeline exists yet, so the TechApp mark stands in; verification is stated either way.
 */
export function OrganizationScreen({ navigation, route }: Props) {
  const { organizationId } = route.params;
  const { userId } = useSession(); const toast = useToast();
  const eventSaves = useBookmarks('event'); const oppSaves = useBookmarks('opportunity');
  const [report, setReport] = useState<ReportSubject | null>(null);
  const org = useQuery({ queryKey: organizationKeys.detail(organizationId), queryFn: () => fetchOrganization(organizationId) });
  const events = useQuery({ queryKey: organizationKeys.events(organizationId), queryFn: () => fetchOrganizationEvents(organizationId) });
  const opps = useQuery({ queryKey: organizationKeys.opportunities(organizationId), queryFn: () => fetchOrganizationOpportunities(organizationId) });

  if (org.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (org.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(org.error)} onRetry={() => void org.refetch()} /></Screen>;

  const o = org.data; const verified = o.verification === 'verified';
  const tabs = navigation.getParent();
  const nothing = !events.isPending && !opps.isPending && !events.isError && !opps.isError && !events.data?.length && !opps.data?.length;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} />} refreshing={org.isRefetching}
      onRefresh={() => { void org.refetch(); void events.refetch(); void opps.refetch(); }}>
      <View style={styles.head}>
        {/* No logo upload exists yet (only covers): the mark, never initials or a broken image. */}
        <View testID="org-logo-fallback" accessible={false} style={styles.logo}><TechIcon name="mark" size={32} color={colors.primary} /></View>
        <Text variant="title" breakStrategy="words" style={{ flexShrink: 1 }}>{o.name}</Text>
      </View>
      <View style={styles.tags}>
        {verified ? <Tag tone="moss" icon="verified" label="DOĞRULANMIŞ KURUM" /> : <Tag tone="neutral" label="HENÜZ DOĞRULANMADI" />}
        <Tag tone="neutral" label={ORG_TYPE_LABEL[o.type]} />
        {o.is_demo && <DemoTag />}
      </View>
      {!!o.tagline && <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>{o.tagline}</Text>}
      {!!o.website && <View style={{ flexDirection: 'row', marginTop: space[3] }}><TextButton icon="link" label="Web sitesi" accessibilityRole="link" accessibilityLabel={`${o.name}: web sitesini aç`} onPress={() => void openExternalUrl(o.website, () => toast.show('Bağlantı açılamadı.', 'danger'))} /></View>}

      {!!o.about && (<><Divider /><Text variant="section">Hakkında</Text><ReadMoreText style={{ marginTop: space[2] }}>{o.about}</ReadMoreText></>)}

      {events.isError && <><Divider /><ErrorState error={toAppError(events.error)} onRetry={() => void events.refetch()} /></>}
      {!!events.data?.length && (
        <>
          <Divider />
          <Text variant="section">Etkinlikler</Text>
          <View style={{ gap: space[4], marginTop: space[3] }}>
            {events.data.map((e) => (
              <PosterCard key={e.id} {...toEventPoster(e)} saved={eventSaves.ids.has(e.id)} onToggleSave={() => eventSaves.toggle(e.id)}
                onPress={() => tabs?.navigate('EventsTab', { screen: 'EventDetail', params: { eventId: e.id } })} />
            ))}
          </View>
        </>
      )}

      {opps.isError && <><Divider /><ErrorState error={toAppError(opps.error)} onRetry={() => void opps.refetch()} /></>}
      {!!opps.data?.length && (
        <>
          <Divider />
          <Text variant="section">Fırsatlar</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            {opps.data.map((p) => (
              <RowCard key={p.id} {...toOpportunityRow(p)} trailing={{ kind: 'bookmark', saved: oppSaves.ids.has(p.id), onToggle: () => oppSaves.toggle(p.id), labels: FOLLOW_LABELS }}
                onPress={() => tabs?.navigate('OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: p.id } })} />
            ))}
          </View>
        </>
      )}
      {nothing && <><Divider /><Text variant="bodySmall" color="textSecondary">Şu an yayında etkinlik ya da fırsat yok.</Text></>}

      <Divider />
      <View style={{ flexDirection: 'row' }}>
        <ReportLink accessibilityLabel="Kurumu bildir" onPress={() => setReport({ targetType: 'organization', targetId: o.id, label: o.name })} />
      </View>
      <ReportSheet subject={report} userId={userId} onClose={() => setReport(null)} onSignIn={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4], marginTop: space[2] },
  logo: { width: 64, height: 64, borderRadius: radius.control, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] },
});
