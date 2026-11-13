import { getSupabase } from '../../lib/supabase';
import { parsePayload, toAppError } from '../../lib/errors';
import { teamRegistrationDetailSchema, type TeamRegistrationDetail } from '../../lib/database.types';
import type { Database } from '../../lib/database.generated';
import { fetchRoster, type RosterEntry } from '../teams/api';

export type TeamEventRegistrationRow = Database['public']['Functions']['submit_team_registration']['Returns'];

export const teamRegistrationKeys = {
  all: ['teamRegistrations'] as const,
  detail: (id: string) => ['teamRegistrations', 'detail', id] as const,
  roster: (teamId: string) => ['teamRegistrations', 'roster', teamId] as const,
};

/** Members the manager can put on the roster: the team's ACTIVE members only (pending join requests are not candidates). */
export async function fetchRosterCandidates(teamId: string): Promise<RosterEntry[]> {
  return (await fetchRoster(teamId)).filter((m) => m.status === 'active');
}

export async function fetchTeamRegistrationDetail(id: string): Promise<TeamRegistrationDetail> {
  const { data, error } = await getSupabase().rpc('team_registration_detail', { p_team_registration_id: id });
  if (error) throw toAppError(error);
  return parsePayload(teamRegistrationDetailSchema, data);
}

/** The same idempotency key is reused on a retry, so a dropped connection can never create a second registration. */
export async function submitTeamRegistration(input: { eventId: string; teamId: string; memberIds: string[]; idempotencyKey: string }): Promise<TeamEventRegistrationRow> {
  const { data, error } = await getSupabase().rpc('submit_team_registration', {
    p_event_id: input.eventId, p_team_id: input.teamId, p_member_ids: input.memberIds, p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw toAppError(error);
  return data;
}

/** `expectedVersion` = the roster_version the manager saw: a change in between answers 409 roster_changed, never a silent overwrite. */
export async function updateTeamRoster(input: { teamRegistrationId: string; memberIds: string[]; expectedVersion: number }): Promise<TeamEventRegistrationRow> {
  const { data, error } = await getSupabase().rpc('update_team_roster', {
    p_team_registration_id: input.teamRegistrationId, p_member_ids: input.memberIds, p_expected_roster_version: input.expectedVersion,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function cancelTeamRegistration(teamRegistrationId: string): Promise<TeamEventRegistrationRow> {
  const { data, error } = await getSupabase().rpc('cancel_team_registration', { p_team_registration_id: teamRegistrationId });
  if (error) throw toAppError(error);
  return data;
}
