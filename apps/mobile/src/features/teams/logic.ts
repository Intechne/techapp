import { z } from 'zod';

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

// ------------------------------------------------------------------ project / post forms
export type FormResult<Raw extends object, Value> = { ok: true; value: Value } | { ok: false; errors: Partial<Record<keyof Raw, string>> };

/** Same pattern as team_projects_url_check: https only, a host, no whitespace or control characters. */
const HTTPS_URL = /^https:\/\/[^\s\u0000-\u001f\u007f/?#]+([/?#][^\s\u0000-\u001f\u007f]*)?$/;
const projectSchema = z.object({
  title: z.string().trim().min(3, 'Proje adı en az 3 karakter olmalı.').max(120, 'Proje adı en fazla 120 karakter olabilir.'),
  summary: z.string().max(600, 'Özet en fazla 600 karakter olabilir.'),
  year: z.string().trim().refine((v) => v === '' || (/^\d{4}$/.test(v) && Number(v) >= 2000 && Number(v) <= 2100), 'Yılı 2000 ile 2100 arasında, dört haneli yaz.'),
  url: z.string().trim().max(500, 'Bağlantı en fazla 500 karakter olabilir.').refine((v) => v === '' || HTTPS_URL.test(v), 'Bağlantı https:// ile başlamalı ve boşluk içermemeli.'),
});
export interface ProjectForm { title: string; summary: string; year: string; url: string }

export function validateProject(raw: ProjectForm): FormResult<ProjectForm, { title: string; summary: string; year: number | null; url: string }> {
  const r = projectSchema.safeParse(raw);
  if (!r.success) {
    const errors: Partial<Record<keyof ProjectForm, string>> = {};
    for (const issue of r.error.issues) errors[issue.path[0] as keyof ProjectForm] ??= issue.message;
    return { ok: false, errors };
  }
  return { ok: true, value: { title: r.data.title, summary: r.data.summary.trim(), year: r.data.year === '' ? null : Number(r.data.year), url: r.data.url } };
}

export interface PostForm { title: string; roleLabel: string; description: string; skills: string; closesAt: string }
export function validatePost(raw: PostForm): FormResult<PostForm, { title: string; roleLabel: string; description: string; skills: string[]; closesAt: string | null }> {
  const errors: Partial<Record<keyof PostForm, string>> = {};
  const title = raw.title.trim();
  if (title.length < 3 || title.length > 120) errors.title = 'İlan başlığı 3 ile 120 karakter arasında olmalı.';
  if (raw.roleLabel.trim().length > 60) errors.roleLabel = 'Rol adı en fazla 60 karakter olabilir.';
  if (raw.description.trim().length > 2000) errors.description = 'Açıklama en fazla 2000 karakter olabilir.';
  const skills = raw.skills.split(',').map((s) => s.trim()).filter(Boolean);
  if (skills.length > 12) errors.skills = 'En fazla 12 beceri yazabilirsin.';
  const due = parseDueDate(raw.closesAt);
  if (!due.ok) errors.closesAt = due.error;
  if (Object.keys(errors).length || !due.ok) return { ok: false, errors };
  // Applications close at the end of the chosen day, Istanbul time (UTC+3 all year).
  return { ok: true, value: { title, roleLabel: raw.roleLabel.trim(), description: raw.description.trim(), skills, closesAt: due.iso ? `${due.iso}T23:59:59+03:00` : null } };
}

/** A post takes applications while it is switched on and its closing date (if any) has not passed. The server applies the same rule. */
export const isPostOpen = (p: { is_open: boolean; closes_at: string | null }, now: number = Date.now()): boolean =>
  p.is_open && (!p.closes_at || new Date(p.closes_at).getTime() > now);
