/** Pure helpers for the teams feature. Nothing here grants anything: it only interprets what the server reported. */
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TeamRole = 'captain' | 'mentor' | 'member';
export type MembershipStatus = 'pending' | 'active' | 'rejected' | 'left' | 'removed';

export interface TaskLike { id: string; status: TaskStatus; due_date: string | null; assignee_id: string | null; created_at: string; completed_at: string | null; priority?: TaskPriority }
export const TASK_ORDER: readonly TaskStatus[] = ['todo', 'doing', 'done'];

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A task is overdue when it has a due date before today and is not done. Date-only comparison, no time zones involved. */
export function isOverdue(task: Pick<TaskLike, 'status' | 'due_date'>, today: Date = new Date()): boolean {
  return task.status !== 'done' && !!task.due_date && task.due_date < isoDay(today);
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
/** Open tasks: earliest due date first, undated last; on the same day the higher priority leads. Done tasks: most recently completed first. */
export function groupTasks<T extends TaskLike>(tasks: readonly T[]): Record<TaskStatus, T[]> {
  const groups: Record<TaskStatus, T[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) groups[t.status].push(t);
  const byDue = (a: T, b: T) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')
    || PRIORITY_RANK[a.priority ?? 'normal'] - PRIORITY_RANK[b.priority ?? 'normal'] || a.created_at.localeCompare(b.created_at);
  groups.todo.sort(byDue); groups.doing.sort(byDue);
  groups.done.sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));
  return groups;
}

/** "Bana atananlar" filter: a plain client-side view over rows the server already allowed this member to read. */
export const onlyMine = <T extends Pick<TaskLike, 'assignee_id'>>(tasks: readonly T[], userId: string | null): T[] => tasks.filter((t) => !!userId && t.assignee_id === userId);

export const nextStatus = (s: TaskStatus): TaskStatus | null => (s === 'todo' ? 'doing' : s === 'doing' ? 'done' : null);

export interface Permissions { isMember: boolean; canManage: boolean; isCaptain: boolean }
/** Derived ONLY from the membership row the server returned for the signed-in user. UI affordances, not authority. */
export function permissionsFor(membership: { role: TeamRole; status: MembershipStatus } | null | undefined): Permissions {
  const active = membership?.status === 'active';
  return { isMember: active, canManage: active && (membership.role === 'captain' || membership.role === 'mentor'), isCaptain: active && membership.role === 'captain' };
}

export function canAdvanceTask(task: Pick<TaskLike, 'assignee_id' | 'status'>, userId: string | null, p: Permissions): boolean {
  if (!p.isMember || nextStatus(task.status) === null) return false;
  return p.canManage || (!!userId && task.assignee_id === userId);
}

export type DueDateResult = { ok: true; iso: string | null } | { ok: false; error: string };
/** GG.AA.YYYY → YYYY-MM-DD. Empty is allowed (no due date). Rejects impossible calendar dates. */
export function parseDueDate(input: string): DueDateResult {
  const raw = input.trim();
  if (!raw) return { ok: true, iso: null };
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (!m) return { ok: false, error: 'Tarihi GG.AA.YYYY biçiminde yaz.' };
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return { ok: false, error: 'Takvimde böyle bir tarih yok.' };
  if (y < 2020 || y > 2100) return { ok: false, error: 'Yılı kontrol eder misin?' };
  return { ok: true, iso: `${m[3]}-${m[2]}-${m[1]}` };
}
export const isoToDisplayDate = (iso: string | null): string => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '');
