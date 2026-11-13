import React, { useCallback, useEffect } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, BookmarkButton, Button, DemoTag, Divider, ErrorState, IconButton, LoadingSkeleton, MetadataRow, Notice, OrganizerRow, Poster, ReadMoreText, RegistrationStatus, RowCard, Screen, Tag, TechIcon, Text, keepNumbersTogether, semantic, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { formatDate, formatDateRange, formatTime, formatTimeRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList, SharedLearningParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { useBookmarks } from '../saved/useBookmarks';
import { fetchEventCourses, learningKeys } from '../learning/api';
import { courseMeta, levelLabel } from '../learning/labels';
import { eventKeys, fetchEligibility, fetchEvent } from './api';
import { primaryBlocker } from './detailBlocker';
import { VolunteerSection } from '../volunteers/VolunteerSection';
import { EVENT_TYPE_ICON, EVENT_TYPE_LABEL, audienceLabel, availability, blockerCopy, feeLabel, placeLabel, registrationTermsLabel } from './labels';

const sem = semantic.light;

export function EventDetailScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList & SharedLearningParamList, 'EventDetail'>) {
  const { eventId } = route.params;
  const { userId } = useSession();
  const intent = usePendingIntent();
  const saves = useBookmarks('event');
  const event = useQuery({ queryKey: eventKeys.detail(eventId), queryFn: () => fetchEvent(eventId) });
  // Courses that prepare for this event; nothing is shown (and nothing fails loudly) when there are none or the request fails.
  const courses = useQuery({ queryKey: learningKeys.eventCourses(eventId), queryFn: () => fetchEventCourses(eventId) });
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
  const existing = el?.registration_id && el.registration_status ? { id: el.registration_id, status: el.registration_status } : null;
  const full = !!el?.is_full;
  // profile_incomplete is not a blocker here: the registration screen asks for the missing profile fields.
  const reasons = el ? [...el.reasons.filter((r) => r !== 'profile_incomplete'), ...(full && !el.waitlist_enabled ? ['event_full'] : [])] : [];
  // One deciding reason, never a lone disabled primary button (approved S11 / Review Focus 5).
  const blocker = primaryBlocker([...new Set(reasons)], !!existing);
  const tabs = navigation.getParent();
  const similar = () => tabs?.navigate('EventsTab', { screen: 'EventsList', params: { type: e.type }, pop: true });

  const footer = existing ? (
    <Button label={existing.status === 'confirmed' ? 'Katılım kartımı göster' : 'Kayıt durumumu gör'} icon="ticket"
      onPress={() => navigation.navigate('RegistrationStatus', { registrationId: existing.id })} />
  ) : blocker ? (
    <>
      <View testID="blocker-footer" style={styles.reasonLine} accessible accessibilityLabel={`Kayıt yapılamıyor: ${blockerCopy(blocker.reason).short}`}>
        <TechIcon name="info" size={18} color={sem.text.secondary} />
        <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }}>{blockerCopy(blocker.reason).short}</Text>
      </View>
      {blocker.secondary === 'find_team'
        ? <Button kind="secondary" icon="team" label="Takımını bul" onPress={() => tabs?.navigate('CommunityTab')} />
        : blocker.secondary === 'save'
          ? <Button kind="secondary" icon="bookmark" label={saves.ids.has(eventId) ? 'Kaydedildi' : 'Kaydet'} onPress={() => saves.toggle(eventId)} />
          : <Button kind="secondary" icon="event" label="Benzer etkinlikler" onPress={similar} />}
    </>
  ) : (
    <Button label={full ? 'Bekleme listesine katıl' : 'Etkinliğe katıl'} iconRight="arrow" onPress={join} loading={eligibility.isPending} />
  );
  const share = () => { void Share.share({ message: `${e.title} · ${formatDateRange(e.starts_at, e.ends_at)}` }); };

  return (
    // No "Etkinlik" title: the content names itself. Back + save + share.
    <Screen header={<AppHeader onBack={navigation.goBack} right={<><BookmarkButton saved={saves.ids.has(eventId)} onToggle={() => saves.toggle(eventId)} /><IconButton icon="share" accessibilityLabel="Paylaş" onPress={share} /></>} />} footer={footer}
      refreshing={event.isRefetching} onRefresh={() => { void event.refetch(); void eligibility.refetch(); }}>
      <Poster large tone={e.tone} icon={EVENT_TYPE_ICON[e.type]} typeLabel={EVENT_TYPE_LABEL[e.type]} line={e.poster_line ?? e.title} cover={{ path: e.cover_path, blurhash: e.cover_blurhash }} />
      <View style={styles.tags}>
        <Tag label={EVENT_TYPE_LABEL[e.type]} />
        {avail && <Tag label={keepNumbersTogether(avail.label)} tone={avail.tone} />}
        {e.is_demo && <DemoTag />}
        {existing && <RegistrationStatus status={existing.status} />}
      </View>
      <Text variant="title" style={{ marginTop: space[3] }}>{e.title}</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{e.summary}</Text>

      <View style={{ gap: space[3], marginTop: space[5] }}>
        <MetadataRow icon="event" strong>{formatDateRange(e.starts_at, e.ends_at)} · {formatTimeRange(e.starts_at, e.ends_at)}</MetadataRow>
        <MetadataRow icon="location" strong>{[placeLabel(e), e.venue].filter(Boolean).join(' · ')}</MetadataRow>
        <MetadataRow icon="community" strong>{audienceLabel(e)} · {feeLabel(e.fee_minor_units)}</MetadataRow>
        <MetadataRow icon="team" strong>{registrationTermsLabel(e)}</MetadataRow>
        <MetadataRow icon="clock" strong>Son kayıt: {formatDate(e.registration_closes_at)}</MetadataRow>
        {e.capacity !== null && <MetadataRow icon="ticket" strong>{Math.max(e.capacity - e.seats_taken, 0)} / {e.capacity} yer açık</MetadataRow>}
      </View>

      {blocker && (
        <View testID="blocker-notice" style={{ marginTop: space[5] }}>
          <Notice tone="warning" title={blockerCopy(blocker.reason).short}>
            {[blockerCopy(blocker.reason).detail, blocker.others.length > 0 ? `Diğer nedenler: ${blocker.others.map((r) => blockerCopy(r).short).join(' ')}` : null].filter(Boolean).join('\n')}
          </Notice>
        </View>
      )}
      {el?.guardian_required && !existing && !blocker && (
        <View style={{ marginTop: space[5] }}><Notice tone="info" title="Veli onayı gerekiyor">18 yaşından küçük katılımcılar için bu etkinlikte velinin onayı isteniyor. Kaydından sonra velinin e-postasını soracağız.</Notice></View>
      )}

      {/* Organiser: in the detail, with its verification (Q5); a name never upper-cased. Organisation profile screen: Faz 3b. */}
      {e.organization && <><Divider /><OrganizerRow name={e.organization.name} verified={e.organization.verification === 'verified'} /></>}

      {e.description && (<><Divider /><Text variant="section">Neler olacak?</Text><ReadMoreText style={{ marginTop: space[2] }}>{e.description}</ReadMoreText></>)}

      {e.sessions.length > 0 && (
        <><Divider /><Text variant="section">Program</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            {e.sessions.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', gap: space[3] }}>
                <Text variant="label" color="primary" style={styles.sessionTime}>{formatTime(s.starts_at)}</Text>
                <View style={{ flex: 1 }}><Text variant="bodySmall">{s.title}</Text>{s.location_note && <Text variant="caption" color="textSecondary">{s.location_note}</Text>}</View>
              </View>
            ))}
          </View></>
      )}

      {courses.data && courses.data.length > 0 && (
        <><Divider /><Text variant="section">Bu etkinliğe hazırlan</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            {courses.data.map((c) => (
              <RowCard key={c.id} leading={{ kind: 'icon', icon: 'learn' }} title={c.title} secondary={`${levelLabel(c.level)} · ${courseMeta(c)}`} isDemo={c.is_demo}
                trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('CourseDetail', { courseId: c.id })} />
            ))}
          </View></>
      )}

      {(e.cancellation_policy || e.support_contact) && (
        <><Divider /><Text variant="section">Bilmen gerekenler</Text>
          {e.cancellation_policy && <Text variant="bodySmall" color="textSecondary" style={{ marginTop: space[2] }}>{e.cancellation_policy}</Text>}
          {e.support_contact && <Text variant="bodySmall" color="textSecondary" style={{ marginTop: space[2] }}>Destek: {e.support_contact}</Text>}</>
      )}

      {/* Gönüllü ol is last: the visitor's own decision (join) comes first. */}
      <View style={{ marginTop: space[7] }}>
        <VolunteerSection eventId={eventId} accepts={e.accepts_volunteers} ended={new Date(e.ends_at) <= new Date()}
          onSignIn={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} onOpenHub={() => navigation.navigate('VolunteerHub', { eventId })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] },
  reasonLine: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  sessionTime: { width: 96, fontVariant: ['tabular-nums'] },
});
