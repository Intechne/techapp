import type { TechIconName } from '../../design-system';
import type { MembershipStatus, TaskPriority, TaskStatus, TeamRole } from './logic';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = { todo: 'Yapılacak', doing: 'Devam ediyor', done: 'Tamamlandı' };
export const TASK_ADVANCE_LABEL: Record<TaskStatus, string | null> = { todo: 'Başla', doing: 'Tamamla', done: null };
export const TASK_STATUS_OPTIONS = (['todo', 'doing', 'done'] as const).map((value) => ({ value, label: TASK_STATUS_LABEL[value] }));

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'YÜKSEK ÖNCELİK', normal: 'NORMAL', low: 'DÜŞÜK ÖNCELİK' };
export const PRIORITY_OPTIONS = ([['high', 'Yüksek'], ['normal', 'Normal'], ['low', 'Düşük']] as const).map(([value, label]) => ({ value, label }));

export const ROLE_LABEL: Record<TeamRole, string> = { captain: 'KAPTAN', mentor: 'MENTOR', member: 'ÜYE' };
export const ROLE_TONE: Record<TeamRole, 'iris' | 'moss' | 'neutral'> = { captain: 'iris', mentor: 'moss', member: 'neutral' };
export const ROLE_OPTIONS: readonly { value: TeamRole; label: string; description: string }[] = [
  { value: 'captain', label: 'Kaptan', description: 'Rolleri ve üyeleri yönetir, görev verir.' },
  { value: 'mentor', label: 'Mentor', description: 'Görev verir, katılma isteklerini değerlendirir.' },
  { value: 'member', label: 'Üye', description: 'Kendi görevlerini ilerletir.' },
];

export const MEMBERSHIP_LABEL: Partial<Record<MembershipStatus, string>> = { active: 'ÜYESİN', pending: 'İSTEĞİN BEKLİYOR' };
export const KIND_LABEL = { team: 'TAKIM', community: 'TOPLULUK' } as const;
export const kindIcon = (kind: 'team' | 'community'): TechIconName => (kind === 'team' ? 'robot' : 'community');
