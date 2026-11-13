import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, BookmarkButton, Button, DemoTag, Divider, ErrorState, LoadingSkeleton, MetadataRow, Notice, Poster, RowCard, Screen, Tag, Text, colors, lessonDoneView, radius, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { SharedLearningParamList } from '../../navigation/types';
import { useBookmarks } from '../saved/useBookmarks';
import { fetchCourse, fetchLessons, learningKeys, useCourseProgress } from './api';
import { levelLabel, lessonCountLabel, minutesLabel, toTone } from './labels';

/** Progress meter: the percent is the server's; the bar only draws it. */
function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
    </View>
  );
}

export function CourseDetailScreen({ navigation, route }: NativeStackScreenProps<SharedLearningParamList, 'CourseDetail'>) {
  const { courseId } = route.params;
  const saves = useBookmarks('course');
  const course = useQuery({ queryKey: learningKeys.course(courseId), queryFn: () => fetchCourse(courseId) });
  const lessons = useQuery({ queryKey: learningKeys.lessons(courseId), queryFn: () => fetchLessons(courseId) });
  const progress = useCourseProgress(courseId);

  if (course.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (course.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(course.error)} onRetry={() => void course.refetch()} /></Screen>;

  const c = course.data;
  const list = lessons.data ?? [];
  const done = new Set(progress.data?.completed_lesson_ids ?? []);
  const finished = !!progress.data?.completed_at;
  const started = !!progress.data && (progress.data.percent > 0 || done.size > 0);
  const next = list.find((l) => !done.has(l.id)) ?? list[0];
  const doneCount = list.filter((l) => done.has(l.id)).length;
  const open = (lessonId: string) => navigation.navigate('Lesson', { courseId, lessonId });
  const minutes = minutesLabel(c.estimated_minutes);

  const footer = next ? <Button label={finished ? 'Baştan oku' : started ? 'Devam et' : 'Başla'} iconRight="arrow" onPress={() => open(finished ? list[0]!.id : next.id)} /> : undefined;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} right={<BookmarkButton saved={saves.ids.has(courseId)} onToggle={() => saves.toggle(courseId)} />} />} footer={footer}
      refreshing={course.isRefetching} onRefresh={() => { void course.refetch(); void lessons.refetch(); void progress.refetch(); }}>
      <Poster large tone={toTone(c.tone)} icon="learn" typeLabel={levelLabel(c.level)} line={c.poster_line ?? c.title} cover={{ path: null, blurhash: null }} />
      {/* The poster already says the level; tags only carry what it does not. */}
      {(finished || c.is_demo) && (
        <View style={styles.tags}>
          {finished && <Tag label={lessonDoneView.label} tone="moss" icon="check" />}
          {c.is_demo && <DemoTag />}
        </View>
      )}
      <Text variant="title" style={{ marginTop: space[4] }}>{c.title}</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{c.summary}</Text>
      <View style={{ gap: space[3], marginTop: space[5] }}>
        <MetadataRow icon="learn" strong>{lessonCountLabel(list.length || c.lesson_count)}</MetadataRow>
        {minutes && <MetadataRow icon="clock" strong>{minutes}</MetadataRow>}
      </View>

      {progress.data && started && (
        <View style={{ marginTop: space[5], gap: space[2] }}>
          <Text variant="label">{`${doneCount} / ${list.length || c.lesson_count} ders · %${progress.data.percent}`}</Text>
          <ProgressBar percent={progress.data.percent} label={`Eğitim ilerlemesi, yüzde ${progress.data.percent}`} />
        </View>
      )}

      <Divider />
      <Text variant="section">Dersler</Text>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {lessons.isPending ? <LoadingSkeleton variant="row" cards={2} rowLines={{ title: 1, secondary: 1, footnote: 'none' }} />
          : lessons.isError ? <ErrorState error={toAppError(lessons.error)} onRetry={() => void lessons.refetch()} />
            : list.length === 0 ? <Notice tone="info" title="Dersler yakında">Bu eğitimin dersleri henüz eklenmedi.</Notice>
              : list.map((l, i) => (
                <RowCard key={l.id} leading={{ kind: 'icon', icon: done.has(l.id) ? 'check' : 'learn' }} title={`${i + 1}. ${l.title}`} secondary={minutesLabel(l.estimated_minutes) ?? undefined}
                  trailing={done.has(l.id) ? { kind: 'status', view: lessonDoneView } : { kind: 'chevron' }} onPress={() => open(l.id)} />
              ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
});
