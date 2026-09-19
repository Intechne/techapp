import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Divider, ErrorState, LoadingSkeleton, MetadataRow, Notice, OrganizerRow, Poster, RegistrationStatus, Screen, Tag, Text, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { formatDate, formatDateRange, formatTime, formatTimeRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { eventKeys, fetchEligibility, fetchEvent } from './api';
import { ELIGIBILITY_REASON, EVENT_TYPE_LABEL, audienceLabel, availability, feeLabel, placeLabel } from './labels';

export function EventDetailScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'EventDetail'>) {
  const { eventId } = route.params;
  const { userId } = useSession();
  const intent = usePendingIntent();
  const event = useQuery({ queryKey: eventKeys.detail(eventId), queryFn: () => fetchEvent(eventId) });
  const eligibility = useQuery({ queryKey: eventKeys.eligibility(eventId, userId), queryFn: () => fetchEligibility(eventId) });

  useEffect(() => { track('event_opened', { event_id: eventId }); }, [eventId]);

  // Coming back from sign-in: continue what the guest started.
  useFocusEffect(useCallback(() => {
    if (userId && intent.consume('register_event')) navigation.navigate('EventRegistration', { eventId });
  }, [userId, intent, navigation, eventId]));

  const join = () => {
    track('registration_started', { event_id: eventId, authenticated: !!userId });
    if (!userId) { intent.set({ type: 'register_event', eventId }); navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; }
    navigation.navigate('EventRegistration', { eventId });
  };

  if (event.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (event.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(event.error)} onRetry={() => void event.refetch()} /></Screen>;

  const e = event.data;
  const el = eligibility.data;
  const avail = availability(e);
  const blocked = el ? el.reasons.filter((r) => r !== 'profile_incomplete') : [];
  const existing = el?.registration_id && el.registration_status ? { id: el.registration_id, status: el.registration_status } : null;
  const full = !!el?.is_full;

  const footer = existing ? (
    <Button label={existing.status === 'confirmed' ? 'Katılım kartımı göster' : 'Kayıt durumumu gör'} icon="ticket"
      onPress={() => navigation.navigate('RegistrationStatus', { registrationId: existing.id })} />
  ) : blocked.length > 0 || (full && !el?.waitlist_enabled) ? (
    <Button label={full ? 'Kontenjan doldu' : 'Kayıt şu an yapılamıyor'} disabled />
  ) : (
    <Button label={full ? 'Bekleme listesine katıl' : 'Etkinliğe katıl'} iconRight="arrow" onPress={join} loading={eligibility.isPending} />
  );

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Etkinlik" />} footer={footer}
      refreshing={event.isRefetching} onRefresh={() => { void event.refetch(); void eligibility.refetch(); }}>
      <Poster large tone={e.tone} brand={`${(e.organization?.name ?? 'TechApp').toLocaleUpperCase('tr')} / ${EVENT_TYPE_LABEL[e.type]}`} line={e.poster_line ?? e.title} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] }}>
        <Tag label={EVENT_TYPE_LABEL[e.type]} />
        {avail && <Tag label={avail.label} tone={avail.tone} />}
        {e.is_demo && <Tag label="ÖRNEK İÇERİK" tone="neutral" />}
        {existing && <RegistrationStatus status={existing.status} />}
      </View>
      <Text variant="title" style={{ marginTop: space[3] }}>{e.title}</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{e.summary}</Text>

      <View style={{ gap: space[3], marginTop: space[5] }}>
        <MetadataRow icon="event" strong>{formatDateRange(e.starts_at, e.ends_at)} · {formatTimeRange(e.starts_at, e.ends_at)}</MetadataRow>
        <MetadataRow icon="location" strong>{[placeLabel(e), e.venue].filter(Boolean).join(' · ')}</MetadataRow>
        <MetadataRow icon="community" strong>{audienceLabel(e)} · {feeLabel(e.fee_minor_units)}</MetadataRow>
        <MetadataRow icon="clock" strong>Son kayıt: {formatDate(e.registration_closes_at)}</MetadataRow>
        {e.capacity !== null && <MetadataRow icon="ticket" strong>{Math.max(e.capacity - e.seats_taken, 0)} / {e.capacity} yer açık</MetadataRow>}
      </View>

      {blocked.map((r) => <View key={r} style={{ marginTop: space[4] }}><Notice tone="warning">{ELIGIBILITY_REASON[r] ?? 'Bu etkinliğe şu an kayıt olamıyorsun.'}</Notice></View>)}
      {el?.guardian_required && !existing && (
        <View style={{ marginTop: space[4] }}><Notice tone="info" title="Veli onayı gerekiyor">18 yaşından küçük katılımcılar için bu etkinlikte velinin onayı isteniyor. Kaydından sonra velinin e-postasını soracağız.</Notice></View>
      )}

      <Divider />
      {e.organization && <OrganizerRow name={e.organization.name} verified={e.organization.verification === 'verified'} />}

      {e.description && (<><Divider /><Text variant="section">Neler olacak?</Text><Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{e.description}</Text></>)}

      {e.sessions.length > 0 && (
        <><Divider /><Text variant="section">Program</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            {e.sessions.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', gap: space[3] }}>
                <Text variant="label" color="primary" style={{ width: 96 }}>{formatTime(s.starts_at)}</Text>
                <View style={{ flex: 1 }}><Text variant="bodySmall">{s.title}</Text>{s.location_note && <Text variant="caption" color="textSecondary">{s.location_note}</Text>}</View>
              </View>
            ))}
          </View></>
      )}

      {(e.cancellation_policy || e.support_contact) && (
        <><Divider /><Text variant="section">Bilmen gerekenler</Text>
          {e.cancellation_policy && <Text variant="bodySmall" color="textSecondary" style={{ marginTop: space[2] }}>{e.cancellation_policy}</Text>}
          {e.support_contact && <Text variant="bodySmall" color="textSecondary" style={{ marginTop: space[2] }}>Destek: {e.support_contact}</Text>}</>
      )}
    </Screen>
  );
}
