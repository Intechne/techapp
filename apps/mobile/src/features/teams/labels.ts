import type { applicationStatusView } from '../../design-system';
import type { TaskPriority, TaskStatus, TeamRole } from './logic';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: 'Yapılacak', doing: 'Devam ediyor', done: 'Tamamlandı' };
export const TASK_ADVANCE_LABEL: Record<TaskStatus, string | null> = { todo: 'Başla', doing: 'Tamamla', done: null };
export const TASK_STATUS_OPTIONS = (['todo', 'doing', 'done'] as const).map((value) => ({ value, label: TASK_STATUS_LABEL[value] }));

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'YÜKSEK ÖNCELİK', normal: 'NORMAL', low: 'DÜŞÜK ÖNCELİK' };
/** Priority tag of a task card; a normal task carries none (the common case is not worth a tag). */
export const PRIORITY_TONE: Record<Exclude<TaskPriority, 'normal'>, 'apricot' | 'neutral'> = { high: 'apricot', low: 'neutral' };
export const PRIORITY_OPTIONS = ([['high', 'Yüksek'], ['normal', 'Normal'], ['low', 'Düşük']] as const).map(([value, label]) => ({ value, label }));

export const ROLE_LABEL: Record<TeamRole, string> = { captain: 'KAPTAN', mentor: 'MENTOR', member: 'ÜYE' };
/** Role as a plain name (sentence case) for secondary lines; the tag labels above are capitals for tags only. */
export const ROLE_NAME: Record<TeamRole, string> = { captain: 'Kaptan', mentor: 'Mentor', member: 'Üye' };
export const ROLE_TONE: Record<TeamRole, 'iris' | 'moss' | 'neutral'> = { captain: 'iris', mentor: 'moss', member: 'neutral' };
export const ROLE_OPTIONS: readonly { value: TeamRole; label: string; description: string }[] = [
  { value: 'captain', label: 'Kaptan', description: 'Rolleri ve üyeleri yönetir, görev verir.' },
  { value: 'mentor', label: 'Mentor', description: 'Görev verir, katılma isteklerini değerlendirir.' },
  { value: 'member', label: 'Üye', description: 'Kendi görevlerini ilerletir.' },
];

export const KIND_LABEL = { team: 'TAKIM', community: 'TOPLULUK' } as const;

/** A recruitment application is read through the same status wording as every other application (Status.tsx). */
export const RECRUITMENT_STATUS: Record<'submitted' | 'accepted' | 'rejected' | 'withdrawn', keyof typeof applicationStatusView> =
  { submitted: 'submitted', accepted: 'accepted', rejected: 'declined', withdrawn: 'withdrawn' };
