import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, ErrorState, LoadingSkeleton, MetadataRow, Modal, Notice, Screen, Text, space, useToast } from '../../design-system';
import { formatDateTime } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchMyTeamInvites, respondTeamRegistration, teamRegistrationKeys } from './api';
import { TEAM_INVITE_CONSENT, holdLabel } from './labels';

/**
 * The invited member answers for themselves: accept saves THEIR registration (own consent), and a minor goes on to the guardian step.
 * Opened by member id (Katılımlarım) or by team registration id (a notification carries that one).
 */
export function TeamInviteScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'TeamInvite'>) {
  const { memberId, teamRegistrationId } = route.params;
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const invites = useQuery({ queryKey: teamRegistrationKeys.invites(userId), queryFn: fetchMyTeamInvites });
  const [confirmDecline, setConfirmDecline] = useState(false);
  // One key per answer and invite: a retry reuses it, a different invite (or answer) never shares one.
  const inviteRef = memberId ?? teamRegistrationId;
  const fresh = (): { for: string | undefined; accept: string; decline: string } => ({ for: inviteRef, accept: Crypto.randomUUID(), decline: Crypto.randomUUID() });
  const [keys, setKeys] = useState(fresh);
  if (keys.for !== inviteRef) setKeys(fresh());
  const inFlight = useRef(false);
  const invite = invites.data?.find((i) => (memberId ? i.member_id === memberId : i.team_registration_id === teamRegistrationId));

  const respond = useMutation({
    mutationFn: (accept: boolean) => respondTeamRegistration({ memberId: invite!.member_id, accept, idempotencyKey: accept ? keys.accept : keys.decline }),
    onSuccess: (res, accept) => {
      setConfirmDecline(false);
      void Promise.all([qc.invalidateQueries({ queryKey: teamRegistrationKeys.all }), qc.invalidateQueries({ queryKey: ['registrations'] }), qc.invalidateQueries({ queryKey: ['events'] })]);
      if (!accept || !res.registration_id) { toast.show('Yanıtın takıma iletildi.'); navigation.goBack(); return; }
      if (res.registration_status === 'pending_guardian') navigation.replace('GuardianRequest', { registrationId: res.registration_id });
      else navigation.replace('RegistrationStatus', { registrationId: res.registration_id, fresh: true });
    },
    onSettled: () => { inFlight.current = false; },
  });
  const answer = (accept: boolean) => { if (inFlight.current || !invite) return; inFlight.current = true; respond.mutate(accept); };

  if (invites.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (invites.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(invites.error)} onRetry={() => void invites.refetch()} /></Screen>;
  if (!invite) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Takım daveti" />} footer={<Button kind="secondary" label="Katılımlarım" onPress={() => navigation.navigate('MyRegistrations')} />}>
        <Text variant="title">Bu davet artık yanıt beklemiyor.</Text>
        <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>Yanıtlamış olabilirsin ya da takım kaydı değişmiş olabilir. {'Güncel durumu Katılımlarım\'da görürsün.'}</Text>
      </Screen>
    );
  }

  const err = respond.error ? toAppError(respond.error) : null;
  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Takım daveti" />}
      footer={<>
        <Button label="Katılıyorum" icon="check" loading={respond.isPending && respond.variables === true} onPress={() => answer(true)} />
        <Button kind="secondary" label="Katılmıyorum" onPress={() => setConfirmDecline(true)} />
      </>}>
      <Text variant="title">Takımın seni kaydetti.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>{TEAM_INVITE_CONSENT}</Text>
      <Card style={{ marginTop: space[6], gap: space[2] }}>
        <Text variant="cardTitle">{invite.event.title}</Text>
        <MetadataRow icon="team" strong>{invite.team.name}</MetadataRow>
        <MetadataRow icon="event">{formatDateTime(invite.event.starts_at)}</MetadataRow>
        {invite.team_status === 'pending_members' && invite.hold_expires_at && <MetadataRow icon="clock">{holdLabel(formatDateTime(invite.hold_expires_at))}</MetadataRow>}
      </Card>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {invite.team_status === 'waitlisted' && <Notice tone="warning" title="Takımın bekleme listesinde">Yer açılınca davetini kabul edebilirsin.</Notice>}
        {err && <Notice tone="danger">{err.message}</Notice>}
        {err?.code === 'profile_incomplete' && (
          <Button kind="secondary" label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} />
        )}
      </View>

      <Modal visible={confirmDecline} title="Davete katılmayacak mısın?" onClose={() => setConfirmDecline(false)}>
        <Text variant="bodySmall" color="textSecondary">Takımın kadrosu eksik kalır; kaptanın ya da mentorun kadroyu yeniden düzenleyebilir. Yanıtını burada değiştiremezsin.</Text>
        {err && <Notice tone="danger">{err.message}</Notice>}
        <Button kind="danger" label="Evet, katılmıyorum" loading={respond.isPending && respond.variables === false} onPress={() => answer(false)} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDecline(false)} />
      </Modal>
    </Screen>
  );
}
