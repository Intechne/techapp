import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, ErrorState, LoadingSkeleton, Notice, Screen, Text, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { SharedLearningParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { completeLesson, fetchLesson, fetchLessons, learningKeys, useCourseProgress, type CourseProgress } from './api';
import { splitLessonBody } from './lessonBody';
import { minutesLabel } from './labels';

/**
 * Reading view. The body is plain paragraphs (no markdown, no HTML, no links opened). The reading column is the Screen's
 * reading width; text follows the system font scale. A guest reads freely: "Tamamladım" is what asks for sign-in, and the
 * completion is finished when they come back.
 */
export function LessonScreen({ navigation, route }: NativeStackScreenProps<SharedLearningParamList, 'Lesson'>) {
  const { courseId, lessonId } = route.params;
  const { userId } = useSession();
  const intent = usePendingIntent();
  const toast = useToast();
  const qc = useQueryClient();
  const lesson = useQuery({ queryKey: learningKeys.lesson(lessonId), queryFn: () => fetchLesson(courseId, lessonId) });
  const lessons = useQuery({ queryKey: learningKeys.lessons(courseId), queryFn: () => fetchLessons(courseId) });
  const progress = useCourseProgress(courseId);
  const [busy, setBusy] = React.useState(false);
  const running = useRef(false);

  const complete = useCallback(async () => {
    if (running.current) return;
    running.current = true; setBusy(true);
    try {
      const p = await completeLesson(lessonId);
      const key = learningKeys.progress(userId);
      qc.setQueryData<CourseProgress[]>(key, (rows) => [...(rows ?? []).filter((r) => r.course_id !== p.course_id), p]);
      void qc.invalidateQueries({ queryKey: key });
      toast.show(p.completed_at ? 'Tamamladın. Eğitimi bitirdin.' : `Tamamladın. Eğitimde %${p.percent} ilerledin.`);
    } catch (e) {
      toast.show(toAppError(e).message, 'danger');
    } finally { running.current = false; setBusy(false); }
  }, [lessonId, qc, toast, userId]);

  // Back from sign-in: finish the completion the guest started.
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    if (intent.consume('complete_lesson', (i) => i.lessonId === lessonId)) void complete();
  }, [userId, intent, lessonId, complete]));

  const tamamladim = () => {
    if (!userId) { intent.set({ type: 'complete_lesson', courseId, lessonId }); navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; }
    void complete();
  };

  if (lesson.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (lesson.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(lesson.error)} onRetry={() => void lesson.refetch()} /></Screen>;

  const l = lesson.data;
  const list = lessons.data ?? [];
  const index = list.findIndex((x) => x.id === lessonId);
  const next = index >= 0 ? list[index + 1] : undefined;
  const done = !!progress.data?.completed_lesson_ids.includes(lessonId);
  const paragraphs = splitLessonBody(l.body);
  const minutes = minutesLabel(l.estimated_minutes);

  const footer = !done
    ? <Button label="Tamamladım" icon="check" loading={busy} onPress={tamamladim} />
    : next
      ? <Button label="Sonraki ders" iconRight="arrow" onPress={() => navigation.replace('Lesson', { courseId, lessonId: next.id })} />
      : <Button label="Eğitime dön" icon="learn" onPress={() => navigation.navigate('CourseDetail', { courseId })} />;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title={index >= 0 ? `Ders ${index + 1} / ${list.length}` : 'Ders'} />} footer={footer}>
      <Text variant="title" accessibilityRole="header">{l.title}</Text>
      {minutes && <Text variant="caption" color="textSecondary" style={{ marginTop: space[2] }}>{`Okuma: ${minutes}`}</Text>}
      <View style={styles.body}>
        {paragraphs.length === 0
          ? <Notice tone="info" title="Bu dersin metni henüz eklenmedi">Eğitime döndüğünde diğer dersleri açabilirsin.</Notice>
          : paragraphs.map((p, i) => <Text key={i} variant="body" selectable>{p}</Text>)}
      </View>
      {done && <View style={{ marginTop: space[6] }}><Notice tone="success" title="Bu dersi tamamladın" /></View>}
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: space[4], marginTop: space[5] } });
