import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, Text, courseProgressView, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { SharedLearningParamList } from '../../navigation/types';
import { useBookmarks } from '../saved/useBookmarks';
import { fetchCourses, learningKeys, useMyProgress } from './api';
import { courseMeta } from './labels';

/** Gelişim > tüm eğitimler: published courses, newest first; own progress as a small tag, save on every card. */
export function CourseListScreen({ navigation }: NativeStackScreenProps<SharedLearningParamList, 'CourseList'>) {
  const saves = useBookmarks('course');
  const q = useQuery({ queryKey: learningKeys.courses(), queryFn: () => fetchCourses() });
  const progress = useMyProgress();
  const courses = q.data ?? [];
  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Gelişim" />} refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); void progress.refetch(); }}>
      <Text variant="title" style={{ marginBottom: space[4] }}>Adım adım öğren.</Text>
      {q.isPending ? <LoadingSkeleton variant="row" rowLines={{ title: 2, secondary: 2, footnote: 'none' }} />
        : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
          : courses.length === 0 ? <EmptyState icon="learn" title="Şu an yayında eğitim yok" body="Yeni eğitimler eklendikçe burada görünür." />
            : (
              <ResponsiveGrid>
                {courses.map((c) => {
                  const p = progress.data?.find((r) => r.course_id === c.id);
                  const view = p ? courseProgressView(p.percent, !!p.completed_at) : null;
                  return (
                    <RowCard key={c.id} leading={{ kind: 'icon', icon: 'learn' }} title={c.title} secondary={c.summary} footnote={courseMeta(c)}
                      {...(view ? { footnoteTag: view } : {})} isDemo={c.is_demo}
                      trailing={{ kind: 'bookmark', saved: saves.ids.has(c.id), onToggle: () => saves.toggle(c.id) }}
                      onPress={() => navigation.navigate('CourseDetail', { courseId: c.id })} />
                  );
                })}
              </ResponsiveGrid>
            )}
    </Screen>
  );
}
