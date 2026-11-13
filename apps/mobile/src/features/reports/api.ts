import { makeError, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';

/** The kinds of content the server accepts (reports_target_type_check). The app offers "Bildir" on the six it shows to the public. */
export type ReportTarget = 'event' | 'opportunity' | 'team' | 'organization' | 'profile' | 'experience' | 'recruitment_post' | 'course' | 'team_project';
export const REPORT_TARGETS: readonly ReportTarget[] = ['event', 'opportunity', 'team', 'organization', 'profile', 'experience', 'recruitment_post', 'course', 'team_project'];

/** The server's reasons, exactly (reports.reason check), with the app's own words. Order: most common first, "Diğer" last. */
export type ReportReason = 'inappropriate' | 'misleading' | 'spam' | 'safety' | 'harassment' | 'privacy' | 'other';
export const REPORT_REASONS: readonly { value: ReportReason; label: string; description?: string }[] = [
  { value: 'inappropriate', label: 'Uygunsuz içerik' },
  { value: 'misleading', label: 'Yanıltıcı bilgi' },
  { value: 'spam', label: 'Spam ya da reklam' },
  { value: 'safety', label: 'Güvenlik sorunu' },
  { value: 'harassment', label: 'Taciz ya da zorbalık' },
  { value: 'privacy', label: 'Gizlilik ihlali', description: 'Birinin kişisel bilgisi ya da küçük yaştaki birinin adı yazılmış.' },
  { value: 'other', label: 'Diğer' },
];

/** reports.details check (char_length <= 1000). */
export const REPORT_DETAILS_MAX = 1000;

export interface ReportInput { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }

/**
 * Files the signed-in person's own report through the existing `reports_insert_own` policy (no RPC). The reporter id is the
 * session's; a guest never reaches the table. While one of their reports on the same content is still open, the partial
 * unique index refuses the second (SQLSTATE 23505): that is `already_reported`, in the app's own words.
 */
export async function submitReport(input: ReportInput): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const reporterId = data.session?.user.id;
  if (!reporterId) throw makeError('auth_required', 401);
  const details = input.details?.trim().slice(0, REPORT_DETAILS_MAX) || null;
  const { error } = await supabase.from('reports').insert({ reporter_id: reporterId, target_type: input.targetType, target_id: input.targetId, reason: input.reason, details });
  if (!error) return;
  if ((error as { code?: unknown }).code === '23505') throw makeError('already_reported', 409);
  throw toAppError(error);
}
