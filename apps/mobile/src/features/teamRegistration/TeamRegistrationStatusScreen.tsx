import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, ErrorState, LoadingSkeleton, MetadataRow, Modal, Notice, Screen, Skeleton, StatusBadge, StatusTimeline, TechIcon, Text, colors, radius, space, teamMemberStepView, teamRegistrationStatusView, teamRegistrationSteps, useToast, type TechIconName } from '../../design-system';
import { formatDateTime } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { TeamRegistrationStatus } from '../../lib/database.types';
import type { SharedEventParamList } from '../../navigation/types';
import { eventKeys, fetchEligibility, fetchEvent } from '../events/api';
import { useSession } from '../auth/SessionProvider';
import { ROLE_NAME } from '../teams/labels';
import { cancelTeamRegistration, fetchTeamRegistrationDetail, teamRegistrationKeys } from './api';
import { TEAM_STATUS_HEADLINE, holdLabel } from './labels';

const ICON: Record<TeamRegistrationStatus, { icon: TechIconName; good: boolean }> = {
  pending_members: { icon: 'team', good: false }, pending_review: { icon: 'clock', good: false }, confirmed: { icon: 'check', good: true },
  waitlisted: { icon: 'clock', good: false }, cancelled: { icon: 'close', good: false }, rejected: { icon: 'close', good: false }, expired: { icon: 'clock', good: false },
};
const LIVE: TeamRegistrationStatus[] = ['pending_members', 'pending_review', 'confirmed', 'waitlisted'];

/** A team registration as the team's circle sees it. Captains and mentors (per event_eligibility) also get edit and cancel. */
export function TeamRegistrationStatusScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'TeamRegistrationStatus'>) {
  const { teamRegistrationId } = route.params;
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const detail = useQuery({ queryKey: teamRegistrationKeys.detail(teamRegistrationId), queryFn: () => fetchTeamRegistrationDetail(teamRegistrationId), refetchOnWindowFocus: 'always' });
  const eventId = detail.data?.event.id;
  // Whether the review step belongs in the line, and whether this person manages the team: both asked of the server, never guessed.
  const event = useQuery({ queryKey: eventKeys.detail(eventId ?? ''), queryFn: () => fetchEvent(eventId!), enabled: !!eventId });
  const eligibility = useQuery({ queryKey: eventKeys.eligibility(eventId ?? '', userId), queryFn: () => fetchEligibility(eventId!), enabled: !!eventId });

  const cancel = useMutation({
    mutationFn: () => cancelTeamRegistration(teamRegistrationId),
    onSuccess: async () => {
      setConfirmCancel(false);
      await Promise.all([qc.invalidateQueries({ queryKey: teamRegistrationKeys.all }), qc.invalidateQueries({ queryKey: ['events'] }), qc.invalidateQueries({ queryKey: ['registrations'] })]);
      toast.show('Takım kaydı iptal edildi.');
    },
  });

  if (detail.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (detail.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(detail.error)} onRetry={() => void detail.refetch()} /></Screen>;

  const d = detail.data;
  const h = TEAM_STATUS_HEADLINE[d.status]; const look = ICON[d.status];
  const isManager = !!eligibility.data?.manageable_teams.some((t) => t.team_id === d.team.id);
  const live = LIVE.includes(d.status);
  const steps = teamRegistrationSteps(d.status, event.data?.requires_review === true);
  const stepsUnknown = event.isPending && d.status !== 'cancelled';
  const ready = d.members.filter((m) => m.step === 'ready').length;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Takım kaydı" />} refreshing={detail.isRefetching}
      onRefresh={() => { void detail.refetch(); void eligibility.refetch(); }}
      footer={isManager && d.can_edit
        ? <Button label="Kadroyu düzenle" icon="edit" onPress={() => navigation.navigate('TeamRegistration', { eventId: d.event.id, teamRegistrationId: d.id })} />
        : !live ? <Button kind="secondary" label="Etkinliğe dön" onPress={() => navigation.navigate('EventDetail', { eventId: d.event.id })} /> : undefined}>
      <View style={[styles.icon, { backgroundColor: look.good ? colors.mossSoft : colors.primarySoft }]}>
        <TechIcon name={look.icon} size={32} color={look.good ? colors.moss : colors.primary} />
      </View>
      <Text variant="title" center>{h.title}</Text>
      <Text variant="body" color="textSecondary" center style={{ marginTop: space[3] }}>{h.body}</Text>

      <Card style={{ marginTop: space[6], gap: space[2] }}>
        <StatusBadge view={teamRegistrationStatusView[d.status]} />
        <Text variant="cardTitle">{d.team.name}</Text>
        <MetadataRow icon="event" strong>{d.event.title}</MetadataRow>
        <MetadataRow icon="clock">{formatDateTime(d.event.starts_at)}</MetadataRow>
        {d.status === 'pending_members' && d.hold_expires_at && <MetadataRow icon="clock" strong>{holdLabel(formatDateTime(d.hold_expires_at))}</MetadataRow>}
      </Card>

      {(steps.length > 0 || stepsUnknown) && (
        <Card style={{ marginTop: space[3] }}>
          <Text variant="eyebrow" color="textSecondary" style={{ marginBottom: space[3] }}>SÜREÇ</Text>
          {stepsUnknown ? (
            <View testID="timeline-skeleton" style={{ gap: space[4] }}>{[0, 1, 2].map((i) => <Skeleton key={i} width="60%" height={20} />)}</View>
          ) : <StatusTimeline steps={steps} />}
        </Card>
      )}

      <Card style={{ marginTop: space[3] }}>
        <Text variant="eyebrow" color="textSecondary">KADRO · {ready} / {d.members.filter((m) => m.step !== 'declined').length} HAZIR</Text>
        <View style={{ marginTop: space[3] }}>
          {d.members.map((m, i) => (
            <View key={m.member_id} testID={`member-${m.member_id}`} style={[styles.member, i > 0 && styles.memberDivider]}>
              <Text variant="label">{m.display_name ?? 'Takım üyesi'}</Text>
              <Text variant="caption" color="textSecondary">{ROLE_NAME[m.role_at_submit]}</Text>
              <View style={styles.badge}><StatusBadge view={teamMemberStepView[m.step]} /></View>
            </View>
          ))}
        </View>
      </Card>

      {isManager && live && <Button kind="danger" label="Takım kaydını iptal et" style={{ marginTop: space[6] }} onPress={() => setConfirmCancel(true)} />}

      <Modal visible={confirmCancel} title="Takım kaydını iptal edelim mi?" onClose={() => setConfirmCancel(false)}>
        <Text variant="bodySmall" color="textSecondary">Kadrodaki herkesin etkinlik kaydı kapanır ve takım yerin sıradaki takıma geçer. Kayıtlar açıkken yeniden kaydedebilirsin ama aynı yer garanti olmaz.</Text>
        {cancel.error && <Notice tone="danger">{toAppError(cancel.error).message}</Notice>}
        <Button kind="danger" label="Evet, iptal et" loading={cancel.isPending} onPress={() => cancel.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmCancel(false)} />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 76, height: 76, borderRadius: radius.hero, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: space[5], marginBottom: space[5] },
  member: { paddingVertical: space[3], gap: space[1] },
  memberDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  badge: { flexDirection: 'row', marginTop: space[1] },
});
