import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { parsePayload, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { CourseRow } from '../../lib/database.types';
import { useSession } from '../auth/SessionProvider';

/** Everything a course card, the detail and Keşfet read. Never `*`: approved_by is a staff uid, organization_id/status/slug have no client use. */
export const COURSE_FIELDS = ['id', 'title', 'poster_line', 'summary', 'level', 'tone', 'estimated_minutes', 'lesson_count', 'is_demo', 'published_at'] as const satisfies readonly (keyof CourseRow)[];
export type CourseCard = Pick<CourseRow, (typeof COURSE_FIELDS)[number]>;
export const COURSE_COLUMNS = COURSE_FIELDS.join(', ');

/** The lesson list never carries the body (up to 12 000 characters each): only the opened lesson does. */
export const LESSON_LIST_COLUMNS = 'id, course_id, title, sort_order, estimated_minutes' as const;
export const LESSON_COLUMNS = 'id, course_id, title, body, sort_order, estimated_minutes' as const;
export interface LessonListItem { id: string; course_id: string; title: string; sort_order: number; estimated_minutes: number | null }
export interface LessonFull extends LessonListItem { body: string }

/** Own progress row. `percent` is computed by the server (complete_lesson); the app never derives it. */
export const PROGRESS_COLUMNS = 'course_id, completed_lesson_ids, percent, completed_at' as const;
const progressSchema = z.object({ course_id: z.string(), completed_lesson_ids: z.array(z.string()), percent: z.number(), completed_at: z.string().nullable() });
export type CourseProgress = z.infer<typeof progressSchema>;

export const learningKeys = {
  all: ['learning'] as const,
  courses: () => ['learning', 'courses'] as const,
  preview: () => ['learning', 'preview'] as const,
  course: (id: string) => ['learning', 'course', id] as const,
  lessons: (courseId: string) => ['learning', 'lessons', courseId] as const,
  lesson: (id: string) => ['learning', 'lesson', id] as const,
  progress: (userId: string | null) => ['learning', 'progress', userId] as const,
  eventCourses: (eventId: string) => ['learning', 'event-courses', eventId] as const,
};

/** Published courses that have lessons: a course with none leads nowhere, so lists never offer it (a deep link or saved row still opens the detail, which says "Dersler yakında"). */
export async function fetchCourses(limit = 100): Promise<CourseCard[]> {
  const { data, error } = await getSupabase().from('courses').select(COURSE_COLUMNS).eq('status', 'published').gt('lesson_count', 0).order('published_at', { ascending: false }).limit(limit);
  if (error) throw toAppError(error);
  return data as unknown as CourseCard[];
}
export async function fetchCourse(id: string): Promise<CourseCard> {
  const { data, error } = await getSupabase().from('courses').select(COURSE_COLUMNS).eq('id', id).eq('status', 'published').single();
  if (error) throw toAppError(error);
  return data as unknown as CourseCard;
}
/** Lesson order is the server's: sort_order. */
export async function fetchLessons(courseId: string): Promise<LessonListItem[]> {
  const { data, error } = await getSupabase().from('lessons').select(LESSON_LIST_COLUMNS).eq('course_id', courseId).order('sort_order', { ascending: true });
  if (error) throw toAppError(error);
  return data as unknown as LessonListItem[];
}
export async function fetchLesson(courseId: string, lessonId: string): Promise<LessonFull> {
  const { data, error } = await getSupabase().from('lessons').select(LESSON_COLUMNS).eq('id', lessonId).eq('course_id', courseId).single();
  if (error) throw toAppError(error);
  return data as unknown as LessonFull;
}
/** "Mine" is filtered by user_id here, not left to policy. */
export async function fetchMyProgress(userId: string): Promise<CourseProgress[]> {
  const { data, error } = await getSupabase().from('course_progress').select(PROGRESS_COLUMNS).eq('user_id', userId);
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => parsePayload(progressSchema, r));
}
/** Courses that prepare for an event; the server returns only published ones for a published event. */
export async function fetchEventCourses(eventId: string): Promise<CourseCard[]> {
  const { data, error } = await getSupabase().from('event_courses').select(`course:courses(${COURSE_COLUMNS})`).eq('event_id', eventId);
  if (error) throw toAppError(error);
  return ((data ?? []) as unknown as { course: CourseCard | null }[]).map((r) => r.course).filter((c): c is CourseCard => !!c && c.lesson_count > 0);
}
/** Idempotent on the server; returns the progress row with the server-computed percent. */
export async function completeLesson(lessonId: string): Promise<CourseProgress> {
  const { data, error } = await getSupabase().rpc('complete_lesson', { p_lesson_id: lessonId });
  if (error) throw toAppError(error);
  return parsePayload(progressSchema, data);
}

export function useMyProgress() {
  const { userId } = useSession();
  return useQuery({ queryKey: learningKeys.progress(userId), queryFn: () => fetchMyProgress(userId!), enabled: !!userId });
}
/** The signed-in person's progress in one course; `undefined` data = not started (or a guest). */
export function useCourseProgress(courseId: string) {
  const all = useMyProgress();
  return { ...all, data: all.data?.find((p) => p.course_id === courseId) };
}
