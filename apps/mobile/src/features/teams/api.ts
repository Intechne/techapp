import { getSupabase } from '../../lib/supabase';
import { toAppError } from '../../lib/errors';
import type { Database } from '../../lib/database.types';
import type { TaskPriority, TeamRole, TaskStatus } from './logic';

type Public = Database['public'];
export type Team = Public['Tables']['teams']['Row'];
export type Membership = Public['Tables']['team_memberships']['Row'];
export type TeamTask = Public['Tables']['team_tasks']['Row'];
export type RecruitmentPost = Public['Tables']['recruitment_posts']['Row'];
export type RosterEntry = Public['Functions']['team_roster']['Returns'][number];
export type MyTeam = Membership & { team: Team };

export const teamKeys = {
  list: (kind: 'team' | 'community') => ['teams', 'list', kind] as const,
  mine: (userId: string | null) => ['teams', 'mine', userId] as const,
  detail: (teamId: string) => ['teams', 'detail', teamId] as const,
  posts: (teamId: string) => ['teams', teamId, 'posts'] as const,
  membership: (teamId: string, userId: string | null) => ['teams', teamId, 'membership', userId] as const,
  roster: (teamId: string) => ['teams', teamId, 'roster'] as const,
  tasks: (teamId: string) => ['teams', teamId, 'tasks'] as const,
  task: (taskId: string) => ['teams', 'task', taskId] as const,
};

export async function fetchTeams(kind: 'team' | 'community'): Promise<Team[]> {
  const { data, error } = await getSupabase().from('teams').select('*').eq('kind', kind).order('member_count', { ascending: false }).limit(30);
  if (error) throw toAppError(error);
  return data;
}

/** My live memberships (RLS: own rows only). The role shown anywhere in the app comes from here or from team_roster. */
export async function fetchMyTeams(): Promise<MyTeam[]> {
  const { data, error } = await getSupabase().from('team_memberships').select('*, team:teams(*)')
    .in('status', ['active', 'pending']).order('created_at', { ascending: false }).overrideTypes<MyTeam[], { merge: false }>();
  if (error) throw toAppError(error);
  return data.filter((m) => !!m.team);
}

export async function fetchTeam(teamId: string): Promise<Team> {
  const { data, error } = await getSupabase().from('teams').select('*').eq('id', teamId).single();
  if (error) throw toAppError(error);
  return data;
}

export async function fetchOpenPosts(teamId: string): Promise<RecruitmentPost[]> {
  const { data, error } = await getSupabase().from('recruitment_posts').select('*').eq('team_id', teamId).eq('is_open', true).order('created_at', { ascending: false }).limit(10);
  if (error) throw toAppError(error);
  return data;
}

export async function fetchMyMembership(teamId: string, userId: string): Promise<Membership | null> {
  const { data, error } = await getSupabase().from('team_memberships').select('*').eq('team_id', teamId).eq('user_id', userId)
    .in('status', ['active', 'pending']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

export async function fetchRoster(teamId: string): Promise<RosterEntry[]> {
  const { data, error } = await getSupabase().rpc('team_roster', { p_team_id: teamId });
  if (error) throw toAppError(error);
  return data;
}

export async function fetchTasks(teamId: string): Promise<TeamTask[]> {
  const { data, error } = await getSupabase().from('team_tasks').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(200);
  if (error) throw toAppError(error);
  return data;
}

export async function fetchTask(taskId: string): Promise<TeamTask> {
  const { data, error } = await getSupabase().from('team_tasks').select('*').eq('id', taskId).single();
  if (error) throw toAppError(error);
  return data;
}

// ------------------------------------------------------------------ membership (always through RPCs)
async function rpcRow<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw toAppError(error);
  return data as T;
}
export const createTeam = (input: { name: string; kind: 'team' | 'community'; category: string; tagline: string }) =>
  rpcRow(getSupabase().rpc('create_team', { p_name: input.name.trim(), p_kind: input.kind, p_category: input.category.trim() || undefined, p_tagline: input.tagline.trim() || undefined }));
export const requestJoin = (teamId: string, message: string) => rpcRow(getSupabase().rpc('request_team_join', { p_team_id: teamId, p_message: message.trim() || undefined }));
export const withdrawJoin = (membershipId: string) => rpcRow(getSupabase().rpc('withdraw_team_join', { p_membership_id: membershipId }));
export const decideJoin = (membershipId: string, accept: boolean) => rpcRow(getSupabase().rpc('decide_team_join', { p_membership_id: membershipId, p_accept: accept }));
export const setMemberRole = (membershipId: string, role: TeamRole) => rpcRow(getSupabase().rpc('set_team_member_role', { p_membership_id: membershipId, p_role: role }));
/** A title describes what someone does ("Mekanik lideri"); it grants nothing. Empty clears it. */
export const setMemberTitle = (membershipId: string, title: string) => rpcRow(getSupabase().rpc('set_team_member_title', { p_membership_id: membershipId, p_title: title.trim() }));
export const removeMember = (membershipId: string) => rpcRow(getSupabase().rpc('remove_team_member', { p_membership_id: membershipId }));
export const leaveTeam = (teamId: string) => rpcRow(getSupabase().rpc('leave_team', { p_team_id: teamId }));

// ------------------------------------------------------------------ tasks
/** Members move their own task through the RPC (the server checks assignee/manager). */
export const setTaskStatus = (taskId: string, status: TaskStatus) => rpcRow(getSupabase().rpc('set_team_task_status', { p_task_id: taskId, p_status: status }));

export interface TaskInput { title: string; description: string; assigneeId: string | null; dueDate: string | null; status: TaskStatus; priority: TaskPriority }

/** Managers write tasks directly; RLS (is_team_manager) and the assignee guard trigger decide. */
export async function saveTask(teamId: string, userId: string, taskId: string | undefined, input: TaskInput): Promise<TeamTask> {
  const fields = { title: input.title.trim(), description: input.description.trim() || null, assignee_id: input.assigneeId, due_date: input.dueDate, status: input.status, priority: input.priority };
  const query = taskId
    ? getSupabase().from('team_tasks').update(fields).eq('id', taskId).select('*').single()
    : getSupabase().from('team_tasks').insert({ ...fields, team_id: teamId, created_by: userId }).select('*').single();
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { data, error } = await getSupabase().from('team_tasks').delete().eq('id', taskId).select('id');
  if (error) throw toAppError(error);
  if (!data.length) throw toAppError({ code: '42501', message: 'not permitted' }); // RLS filtered the row: not a manager
}
