import { getSupabase } from '../../lib/supabase';
import { parsePayload, toAppError } from '../../lib/errors';
import { teamPublicProfileSchema, type Database, type RecruitmentPostRow, type TeamPublicProfile, type TeamRow } from '../../lib/database.types';
import type { TaskPriority, TeamRole, TaskStatus } from './logic';

type Public = Database['public'];
export type Team = TeamRow;
export type Membership = Public['Tables']['team_memberships']['Row'];
export type TeamTask = Public['Tables']['team_tasks']['Row'];
export type RecruitmentPost = RecruitmentPostRow;
export type RosterEntry = Public['Functions']['team_roster']['Returns'][number];
export type TeamProject = Omit<Public['Tables']['team_projects']['Row'], 'cover_path'>;
export type RecruitmentApplication = Pick<Public['Tables']['recruitment_applications']['Row'], 'id' | 'post_id' | 'user_id' | 'message' | 'status' | 'created_at'>;
/** What a manager sees of an application (team_recruitment_applications): a name and an age flag, never an id. */
export interface ApplicantRow { id: string; post_id: string; display_name: string | null; is_minor: boolean; message: string | null; status: string; created_at: string }
export type { TeamPublicProfile };
export type MyTeam = Membership & { team: Team };

/**
 * The columns the API roles may read (migration 20261112000300). `created_by` (the founder's user id, possibly a minor) is
 * not granted, so `select('*')`, `teams(*)` or `returning *` on these tables fails with "permission denied".
 * A column added to either table must be granted in a new migration AND added here.
 */
export const TEAM_PUBLIC_COLUMNS = 'id, organization_id, slug, name, kind, category, category_key, tagline, about, city, topic_interest_id, tone, accepts_join_requests, moderation_status, member_count, is_demo, cover_path, cover_blurhash, created_at, updated_at' as const;
export const RECRUITMENT_POST_COLUMNS = 'id, team_id, title, role_label, description, skills, is_open, closes_at, created_at, updated_at' as const;
/** `cover_path` stays closed for projects (migration 20261113000200), so it is not read. */
export const TEAM_PROJECT_COLUMNS = 'id, team_id, title, summary, year, url, created_at, updated_at' as const;
export const RECRUITMENT_APPLICATION_COLUMNS = 'id, post_id, user_id, message, status, created_at' as const; // the person's OWN applications only
const MY_TEAMS_SELECT = `*, team:teams(${TEAM_PUBLIC_COLUMNS})` as const;

export const teamKeys = {
  list: (kind: 'team' | 'community') => ['teams', 'list', kind] as const,
  mine: (userId: string | null) => ['teams', 'mine', userId] as const,
  detail: (teamId: string) => ['teams', 'detail', teamId] as const,
  posts: (teamId: string) => ['teams', teamId, 'posts'] as const,
  membership: (teamId: string, userId: string | null) => ['teams', teamId, 'membership', userId] as const,
  roster: (teamId: string) => ['teams', teamId, 'roster'] as const,
  profile: (teamId: string) => ['teams', teamId, 'profile'] as const,
  projects: (teamId: string) => ['teams', teamId, 'projects'] as const,
  allPosts: (teamId: string) => ['teams', teamId, 'posts', 'all'] as const,
  postApplications: (teamId: string) => ['teams', teamId, 'post-applications'] as const,
  myApplications: (userId: string | null) => ['teams', 'my-recruitment-applications', userId] as const,
  tasks: (teamId: string) => ['teams', teamId, 'tasks'] as const,
  task: (taskId: string) => ['teams', 'task', taskId] as const,
};

export async function fetchTeams(kind: 'team' | 'community'): Promise<Team[]> {
  const { data, error } = await getSupabase().from('teams').select(TEAM_PUBLIC_COLUMNS).eq('kind', kind).order('member_count', { ascending: false }).limit(30);
  if (error) throw toAppError(error);
  return data;
}

/**
 * My live memberships. Filtered by user id on purpose: RLS also lets a captain/mentor read their team's rows, so without
 * the filter a manager would fetch teammates' memberships (and their join notes) and see one card per member.
 * The role shown anywhere in the app comes from here or from team_roster.
 */
export async function fetchMyTeams(userId: string): Promise<MyTeam[]> {
  const { data, error } = await getSupabase().from('team_memberships').select(MY_TEAMS_SELECT)
    .eq('user_id', userId).in('status', ['active', 'pending']).order('created_at', { ascending: false }).overrideTypes<MyTeam[], { merge: false }>();
  if (error) throw toAppError(error);
  return data.filter((m) => !!m.team);
}

export async function fetchTeam(teamId: string): Promise<Team> {
  const { data, error } = await getSupabase().from('teams').select(TEAM_PUBLIC_COLUMNS).eq('id', teamId).single();
  if (error) throw toAppError(error);
  return data;
}

export async function fetchOpenPosts(teamId: string): Promise<RecruitmentPost[]> {
  const { data, error } = await getSupabase().from('recruitment_posts').select(RECRUITMENT_POST_COLUMNS).eq('team_id', teamId).eq('is_open', true).order('created_at', { ascending: false }).limit(10);
  if (error) throw toAppError(error);
  return data;
}

/** Safe public counts + the adult leaders who are discoverable. The only source of names on the public team page. */
export async function fetchTeamProfile(teamId: string): Promise<TeamPublicProfile> {
  const { data, error } = await getSupabase().rpc('team_public_profile', { p_team_id: teamId });
  if (error) throw toAppError(error);
  return parsePayload(teamPublicProfileSchema, data);
}

export async function fetchTeamProjects(teamId: string): Promise<TeamProject[]> {
  const { data, error } = await getSupabase().from('team_projects').select(TEAM_PROJECT_COLUMNS).eq('team_id', teamId)
    .order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50);
  if (error) throw toAppError(error);
  return data;
}

/** Members and managers also read the team's closed posts (recruitment_posts_member_read); the public only sees open ones. */
export async function fetchAllPosts(teamId: string): Promise<RecruitmentPost[]> {
  const { data, error } = await getSupabase().from('recruitment_posts').select(RECRUITMENT_POST_COLUMNS).eq('team_id', teamId).order('created_at', { ascending: false }).limit(50);
  if (error) throw toAppError(error);
  return data;
}

/**
 * Managers read who applied through the RPC (name, is_minor, note); there is no user id on the client. Same visibility rule as the
 * join requests in team_roster: the person consented by applying. Only still-undecided applications are returned.
 */
export async function fetchPostApplications(postIds: string[]): Promise<ApplicantRow[]> {
  const perPost = await Promise.all(postIds.map(async (postId) => {
    const { data, error } = await getSupabase().rpc('team_recruitment_applications', { p_post_id: postId });
    if (error) throw toAppError(error);
    return data.filter((a) => a.status === 'submitted').map((a): ApplicantRow => ({ id: a.application_id, post_id: postId, display_name: a.display_name, is_minor: a.is_minor, message: a.message, status: a.status, created_at: a.created_at }));
  }));
  return perPost.flat();
}

export async function fetchMyRecruitmentApplications(userId: string): Promise<RecruitmentApplication[]> {
  const { data, error } = await getSupabase().from('recruitment_applications').select(RECRUITMENT_APPLICATION_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
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

// ------------------------------------------------------------------ projects (captain / mentor, always through RPCs)
export interface ProjectInput { title: string; summary: string; year: number | null; url: string }
export const upsertTeamProject = (teamId: string, projectId: string | null, input: ProjectInput) =>
  rpcRow(getSupabase().rpc('upsert_team_project', { p_team_id: teamId, p_project_id: projectId, p_title: input.title.trim(), p_summary: input.summary.trim() || null, p_year: input.year, p_url: input.url.trim() || null }));
export const deleteTeamProject = (projectId: string) => rpcRow(getSupabase().rpc('delete_team_project', { p_project_id: projectId }));

// ------------------------------------------------------------------ recruitment
export const applyToRecruitment = (postId: string, message: string) => rpcRow(getSupabase().rpc('apply_to_recruitment', { p_post_id: postId, p_message: message.trim() || undefined }));
export const decideRecruitmentApplication = (applicationId: string, accept: boolean) => rpcRow(getSupabase().rpc('decide_recruitment_application', { p_application_id: applicationId, p_accept: accept }));

export interface PostInput { title: string; roleLabel: string; description: string; skills: string[]; closesAt: string | null }
/**
 * Managers write posts directly; the RLS policies (app.is_team_manager) decide. Two rules, both from migration 20261112000300:
 * rows are read back with `.select('id')` (a `returning *` would ask for the ungranted `created_by`), and `created_by` is NEVER sent:
 * it is the founder's identity, hidden from every client, and the column carries no server-side default or check
 * (see the Task 7 report: server follow-up).
 */
export async function saveRecruitmentPost(teamId: string, postId: string | undefined, input: PostInput): Promise<string> {
  const fields = { title: input.title.trim(), role_label: input.roleLabel.trim() || null, description: input.description.trim() || null, skills: input.skills, closes_at: input.closesAt };
  const query = postId
    ? getSupabase().from('recruitment_posts').update(fields).eq('id', postId).select('id').single()
    : getSupabase().from('recruitment_posts').insert({ ...fields, team_id: teamId }).select('id').single();
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data.id;
}

export async function setRecruitmentPostOpen(postId: string, isOpen: boolean): Promise<void> {
  const { data, error } = await getSupabase().from('recruitment_posts').update({ is_open: isOpen }).eq('id', postId).select('id');
  if (error) throw toAppError(error);
  if (!data.length) throw toAppError({ code: '42501', message: 'not permitted' }); // RLS filtered the row: not a manager
}

export async function deleteRecruitmentPost(postId: string): Promise<void> {
  const { data, error } = await getSupabase().from('recruitment_posts').delete().eq('id', postId).select('id');
  if (error) throw toAppError(error);
  if (!data.length) throw toAppError({ code: '42501', message: 'not permitted' });
}
