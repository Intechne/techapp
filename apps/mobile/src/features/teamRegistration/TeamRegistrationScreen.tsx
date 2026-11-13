import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, Checkbox, ErrorState, LoadingSkeleton, MetadataRow, Notice, Radio, Screen, Text, space } from '../../design-system';
import { formatDateRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { eventKeys, fetchEligibility, fetchEvent } from '../events/api';
import { placeLabel } from '../events/labels';
import { useSession } from '../auth/SessionProvider';
import { ROLE_NAME } from '../teams/labels';
import { fetchRosterCandidates, fetchTeamRegistrationDetail, submitTeamRegistration, teamRegistrationKeys, updateTeamRoster } from './api';
import { ROSTER_PROBLEM_TITLE, rosterProblemLabel, teamSizeLabel } from './labels';
import { initialSelection, isMemberError, memberIdsFromError, rosterProblem, TEAM_INFO_LABEL } from './logic';

/**
 * Roster selection for a team-mode event, for the team's captain or mentor; with `teamRegistrationId` the same screen edits an
 * existing registration's roster (guarded by the roster version the manager saw).
 * The submit button is never disabled: a size problem is shown inline and pressing it explains, with no call.
 */
export function TeamRegistrationScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'TeamRegistration'>) {
  const { eventId, teamRegistrationId } = route.params;
  const editing = !!teamRegistrationId;
  const { userId } = useSession();
  const qc = useQueryClient();
  const event = useQuery({ queryKey: eventKeys.detail(eventId), queryFn: () => fetchEvent(eventId) });
  const eligibility = useQuery({ queryKey: eventKeys.eligibility(eventId, userId), queryFn: () => fetchEligibility(eventId), enabled: !editing });
  const detail = useQuery({ queryKey: teamRegistrationKeys.detail(teamRegistrationId ?? ''), queryFn: () => fetchTeamRegistrationDetail(teamRegistrationId!), enabled: editing });

  const freeTeams = useMemo(() => (eligibility.data?.manageable_teams ?? []).filter((t) => !t.registration_id), [eligibility.data]);
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  const teamId = editing ? detail.data?.team.id : (freeTeams.find((t) => t.team_id === pickedTeam) ?? freeTeams[0])?.team_id;
  const roster = useQuery({ queryKey: teamRegistrationKeys.roster(teamId ?? ''), queryFn: () => fetchRosterCandidates(teamId!), enabled: !!teamId });

  // One key per roster (a changed selection or team starts a new one): a retry after a dropped connection can never create a second registration.
  const idempotencyKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [showProblem, setShowProblem] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const min = event.data?.team_min_size ?? 1;
  const max = event.data?.team_max_size ?? null;

  // Default selection: everyone who fits when registering; when editing, the current roster by member id (never by display name).
  const defaultSelection = useMemo(() => {
    const entries = roster.data ?? [];
    if (!editing) return initialSelection(entries.map((m) => m.user_id), min, max);
    const current = new Set((detail.data?.members ?? []).filter((m) => m.state === 'invited' || m.state === 'accepted').map((m) => m.user_id));
    return new Set(entries.map((m) => m.user_id).filter((id) => current.has(id)));
  }, [roster.data, detail.data, editing, min, max]);
  const selected = selection ?? defaultSelection;
  const problem = rosterProblem(selected.size, min, max);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelection(next); setShowProblem(false); idempotencyKey.current = null; // another roster is another request
    setRowErrors((prev) => { if (!(id in prev)) return prev; const { [id]: _gone, ...rest } = prev; return rest; });
  };

  const save = useMutation({
    mutationFn: () => {
      const memberIds = (roster.data ?? []).map((m) => m.user_id).filter((id) => selected.has(id));
      return editing
        ? updateTeamRoster({ teamRegistrationId: teamRegistrationId!, memberIds, expectedVersion: detail.data!.roster_version })
        : submitTeamRegistration({ eventId, teamId: teamId!, memberIds, idempotencyKey: (idempotencyKey.current ??= Crypto.randomUUID()) });
    },
    onSuccess: async (reg) => {
      await Promise.all([qc.invalidateQueries({ queryKey: teamRegistrationKeys.all }), qc.invalidateQueries({ queryKey: ['events'] }), qc.invalidateQueries({ queryKey: ['registrations'] })]);
      if (editing) navigation.navigate('TeamRegistrationStatus', { teamRegistrationId: reg.id });
      else navigation.replace('TeamRegistrationStatus', { teamRegistrationId: reg.id });
    },
    onError: (err) => {
      const e = toAppError(err);
      const ids = isMemberError(e.code) ? memberIdsFromError(e) : [];
      setRowErrors(Object.fromEntries(ids.map((id) => [id, e.message])));
    },
    onSettled: () => { inFlight.current = false; },
  });

  const press = () => {
    if (inFlight.current) return;
    if (problem) { setShowProblem(true); return; }
    inFlight.current = true;
    save.mutate();
  };
  const reload = () => { setSelection(null); setRowErrors({}); save.reset(); void detail.refetch(); void roster.refetch(); };

  const back = <AppHeader onBack={navigation.goBack} title={editing ? 'Kadroyu düzenle' : 'Takım kaydı'} />;
  const loading = event.isPending || (editing ? detail.isPending : eligibility.isPending);
  const loadError = event.error ?? (editing ? detail.error : eligibility.error);
  if (loading) return <Screen header={back}><LoadingSkeleton cards={1} /></Screen>;
  if (loadError || !event.data) return <Screen header={back}><ErrorState error={toAppError(loadError)} onRetry={() => { void event.refetch(); void eligibility.refetch(); void detail.refetch(); }} /></Screen>;
  const e = event.data;

  if (!editing && freeTeams.length === 0) {
    const registered = (eligibility.data?.manageable_teams ?? []).find((t) => t.registration_id);
    return (
      <Screen header={back} footer={registered ? <Button label="Takım kaydını gör" onPress={() => navigation.replace('TeamRegistrationStatus', { teamRegistrationId: registered.registration_id! })} /> : undefined}>
        <Notice tone="info" title={registered ? 'Takımın bu etkinliğe kayıtlı' : TEAM_INFO_LABEL}>
          {registered ? 'Kadroyu ve durumu takım kaydı ekranından görebilirsin.' : 'Takım kaydı için bir takımın aktif kaptanı ya da mentoru olman gerekiyor.'}
        </Notice>
      </Screen>
    );
  }

  const teamName = editing ? detail.data?.team.name : freeTeams.find((t) => t.team_id === teamId)?.name;
  const candidates = roster.data ?? [];
  const reasonLine = problem ? rosterProblemLabel(problem, min, max) : null;
  const rowErrorCount = candidates.filter((m) => m.user_id in rowErrors).length;
  const saveError = save.error ? toAppError(save.error) : null;

  return (
    <Screen header={back} footer={<Button label={editing ? 'Kadroyu kaydet' : 'Takımı kaydet'} loading={save.isPending} onPress={press} />}>
      <Text variant="title">{editing ? 'Kadroyu güncelle.' : 'Kadronu seç.'}</Text>
      <Card style={{ marginTop: space[5], gap: space[2] }}>
        <Text variant="cardTitle">{e.title}</Text>
        <MetadataRow icon="event">{formatDateRange(e.starts_at, e.ends_at)}</MetadataRow>
        <MetadataRow icon="location">{placeLabel(e)}</MetadataRow>
        <MetadataRow icon="team">Takım: {teamSizeLabel(min, max)}</MetadataRow>
      </Card>

      {!editing && freeTeams.length > 1 && (
        <View style={{ marginTop: space[5], gap: space[3] }}>
          <Text variant="section">Hangi takım?</Text>
          {freeTeams.map((t) => (
            <Radio key={t.team_id} label={t.name} description={`${t.active_member_count} aktif üye · ${ROLE_NAME[t.role]}`}
              checked={t.team_id === teamId} onChange={() => { setPickedTeam(t.team_id); idempotencyKey.current = null; setSelection(null); setRowErrors({}); setShowProblem(false); }} />
          ))}
        </View>
      )}

      <View style={{ marginTop: space[5], gap: space[1] }}>
        <Text variant="section">{teamName ? `${teamName} kadrosu` : 'Kadro'}</Text>
        <Text variant="caption" color="textSecondary">{selected.size} kişi seçili · istenen: {teamSizeLabel(min, max)}</Text>
        {reasonLine && <Text variant="caption" color="danger">{reasonLine}</Text>}
      </View>

      <View style={{ gap: space[3], marginTop: space[3] }}>
        {roster.isPending && roster.fetchStatus !== 'idle' ? <LoadingSkeleton cards={2} variant="row" />
          : roster.isError ? <ErrorState error={toAppError(roster.error)} onRetry={() => void roster.refetch()} />
            : candidates.map((m) => (
              <View key={m.user_id} testID={`member-row-${m.user_id}`}>
                <Checkbox label={m.display_name} description={ROLE_NAME[m.role]} checked={selected.has(m.user_id)} onChange={() => toggle(m.user_id)} error={rowErrors[m.user_id]} />
              </View>
            ))}
      </View>

      <View style={{ gap: space[3], marginTop: space[5] }}>
        {showProblem && problem && <Notice tone="warning" title={ROSTER_PROBLEM_TITLE}>Kadroyu etkinliğin istediği büyüklüğe getirip yeniden dene.</Notice>}
        {saveError && rowErrorCount === 0 && (
          <Notice tone="danger" title={editing ? 'Kadro kaydedilmedi' : 'Takım kaydın tamamlanmadı'}>{saveError.message}</Notice>
        )}
        {saveError?.code === 'roster_changed' && <Button kind="secondary" label="Güncel kadroyu yükle" onPress={reload} />}
        <Notice tone="info" title="Her üye kendi adına onay verir">Seçtiğin herkese davet gider. Katılım, üyenin kendi onayıyla kaydedilir; 18 yaşından küçükler için ayrıca velisinden onay istenir.</Notice>
      </View>
    </Screen>
  );
}
