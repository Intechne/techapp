import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, ApplicationStatus, Button, Divider, ErrorState, IconButton, LoadingSkeleton, MetadataRow, Notice, OrganizerRow, Poster, Screen, Tag, Text, colors, space, useToast } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import { openExternalUrl } from '../../lib/links';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { useAccountState, useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { fetchMyApplicationFor, fetchOpportunity, opportunityKeys } from './api';
import { OPPORTUNITY_TYPE, SHARED_FIELD_LABEL, deadlineView, opportunityIneligibility, placeOf, urgencyTone } from './labels';
import { useFollowedOpportunities } from './useFollow';

export function OpportunityDetailScreen({ navigation, route }: NativeStackScreenProps<OpportunitiesStackParamList, 'OpportunityDetail'>) {
  const { opportunityId } = route.params;
  const { userId } = useSession(); const account = useAccountState(); const intent = usePendingIntent(); const toast = useToast();
  const q = useQuery({ queryKey: opportunityKeys.detail(opportunityId), queryFn: () => fetchOpportunity(opportunityId) });
  const mine = useQuery({ queryKey: opportunityKeys.myApplicationFor(opportunityId, userId), queryFn: () => fetchMyApplicationFor(userId!, opportunityId), enabled: !!userId });
  const follow = useFollowedOpportunities();

  useFocusEffect(useCallback(() => {
    if (userId && intent.consume('apply_opportunity')) navigation.navigate('OpportunityApply', { opportunityId });
  }, [userId, intent, navigation, opportunityId]));

  if (q.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (q.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const o = q.data; const type = OPPORTUNITY_TYPE[o.type]; const deadline = deadlineView(o.closes_at); const closed = deadline.urgency === 'closed';
  const notOpen = !!o.opens_at && new Date(o.opens_at) > new Date();
  const external = !!o.apply_url;
  const ineligible = userId && !external ? opportunityIneligibility(o, account.data?.is_minor) : null;

  const apply = () => {
    if (external) { void openExternalUrl(o.apply_url, () => toast.show('Bağlantı açılamadı.', 'danger')); return; }
    if (!userId) { intent.set({ type: 'apply_opportunity', opportunityId }); navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; }
    navigation.navigate('OpportunityApply', { opportunityId });
  };
  const footer = mine.data ? <Button kind="secondary" icon="check" label="Başvurumu gör" onPress={() => navigation.navigate('MyApplications')} />
    : closed ? <Button label="Başvurular kapandı" disabled /> : ineligible ? <Button label="Bu fırsata başvuramıyorsun" disabled /> : notOpen ? <Button label={`Başvurular ${formatDate(o.opens_at!)} tarihinde açılıyor`} disabled />
      : <Button label={external ? 'Başvuru sayfasına git' : 'Başvurunu hazırla'} iconRight={external ? 'link' : 'arrow'} onPress={apply} />;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title={type.label} right={follow.requiresAuth ? undefined : <IconButton icon="bookmark" filled={follow.ids.has(o.id)} color={follow.ids.has(o.id) ? colors.primary : colors.ink} accessibilityLabel={follow.ids.has(o.id) ? 'Takipten çıkar' : 'Son tarihi takip et'} onPress={() => follow.toggle(o.id)} />} />}
      footer={footer} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void mine.refetch(); }}>
      <Poster large tone={o.tone as 'iris' | 'moss' | 'apricot' | 'ink'} icon={type.icon} typeLabel={type.label.toLocaleUpperCase('tr')} line={o.reward_note ?? o.title} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] }}>
        <Tag label={type.label.toLocaleUpperCase('tr')} /><Tag label={deadline.label.toLocaleUpperCase('tr')} tone={urgencyTone(deadline.urgency)} icon="clock" />
        {o.team_based && <Tag label="TAKIM BAŞVURUSU" tone="neutral" icon="community" />}{o.is_demo && <Tag label="ÖRNEK İÇERİK" tone="neutral" />}
        {mine.data && <ApplicationStatus status={mine.data.status} />}
      </View>
      <Text variant="title" style={{ marginTop: space[3] }}>{o.title}</Text>
      {ineligible && <View style={{ marginTop: space[3] }}><Notice tone="warning" title="Yaş koşulu">{ineligible}</Notice></View>}
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{o.summary}</Text>
      <View style={{ gap: space[3], marginTop: space[5] }}>
        <MetadataRow icon="clock" strong>Son başvuru: {formatDate(o.closes_at)}</MetadataRow>
        <MetadataRow icon="location" strong>{placeOf(o)}</MetadataRow>
        {o.audience_note && <MetadataRow icon="community" strong>{o.audience_note}</MetadataRow>}
        {(o.min_age !== null || (o.guardian_required_under ?? 0) >= 18) && <MetadataRow icon="shield" strong>{Math.max(o.min_age ?? 0, o.guardian_required_under ?? 0)}+ yaş</MetadataRow>}
      </View>
      {o.skills.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] }}>{o.skills.map((s) => <Tag key={s} label={s} tone="neutral" />)}</View>}
      <Divider />
      {o.organization && <OrganizerRow name={o.organization.name} verified={o.organization.verification === 'verified'} caption="Çağrının sahibi" />}
      {o.description && (<><Divider /><Text variant="section">Ayrıntılar</Text><Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{o.description}</Text></>)}
      <Divider />
      {external
        ? <Notice tone="info" title="Başvuru kurumun kendi sayfasında">Bu çağrıya TechApp dışından başvurulur; TechApp yalnızca son tarihi takip etmene yardım eder. Dış sayfada paylaştığın bilgiler o kurumun koşullarına tabidir.</Notice>
        : <Notice tone="success" title="Başvurunda paylaşılacak bilgiler">{o.shared_fields.map((f) => SHARED_FIELD_LABEL[f] ?? f).join(' · ')}. Göndermeden önce hepsini göreceksin; profilinin geri kalanı paylaşılmaz.</Notice>}
    </Screen>
  );
}
