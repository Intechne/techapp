import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, DateField, ErrorState, Input, LoadingSkeleton, Modal, Notice, Screen, Select, Text, TextArea, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { deleteTask, fetchRoster, fetchTask, saveTask, teamKeys, type RosterEntry, type TeamTask } from './api';
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from './labels';
import { isoToDisplayDate, parseDueDate, type TaskPriority, type TaskStatus } from './logic';

const UNASSIGNED = 'none';

export function TeamTaskEditorScreen({ navigation, route }: NativeStackScreenProps<CommunityStackParamList, 'TeamTaskEditor'>) {
  const { teamId, taskId } = route.params;
  const roster = useQuery({ queryKey: teamKeys.roster(teamId), queryFn: () => fetchRoster(teamId) });
  const existing = useQuery({ queryKey: teamKeys.task(taskId ?? 'new'), queryFn: () => fetchTask(taskId!), enabled: !!taskId });

  const header = <AppHeader onBack={navigation.goBack} title={taskId ? 'Görevi düzenle' : 'Yeni görev'} />;
  if (roster.isPending || (taskId && existing.isPending)) return <Screen header={header}><LoadingSkeleton cards={1} /></Screen>;
  const loadError = roster.error ?? existing.error;
  if (loadError) return <Screen header={header}><ErrorState error={toAppError(loadError)} onRetry={() => { void roster.refetch(); if (taskId) void existing.refetch(); }} /></Screen>;
  return <TaskForm key={taskId ?? 'new'} teamId={teamId} taskId={taskId} initial={existing.data ?? null} roster={roster.data ?? []} header={header} navigation={navigation} />;
}

interface FormProps { teamId: string; taskId?: string; initial: TeamTask | null; roster: RosterEntry[]; header: React.ReactElement; navigation: NativeStackScreenProps<CommunityStackParamList, 'TeamTaskEditor'>['navigation'] }

/** Mounted once the task and roster are loaded, so the fields start from server values instead of being synced in an effect. */
function TaskForm({ teamId, taskId, initial, roster, header, navigation }: FormProps) {
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? ''); const [description, setDescription] = useState(initial?.description ?? ''); const [assignee, setAssignee] = useState<string>(initial?.assignee_id ?? UNASSIGNED);
  const [due, setDue] = useState(isoToDisplayDate(initial?.due_date ?? null)); const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo'); const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'normal');
  const [errors, setErrors] = useState<{ title?: string; due?: string }>({}); const [confirmDelete, setConfirmDelete] = useState(false);

  const done = async (message: string) => { await qc.invalidateQueries({ queryKey: teamKeys.tasks(teamId) }); toast.show(message, 'success'); navigation.goBack(); };
  const save = useMutation({
    mutationFn: (dueIso: string | null) => saveTask(teamId, userId!, taskId, { title, description, assigneeId: assignee === UNASSIGNED ? null : assignee, dueDate: dueIso, status, priority }),
    onSuccess: () => done(taskId ? 'Görev güncellendi.' : 'Görev eklendi.'),
  });
  const remove = useMutation({ mutationFn: () => deleteTask(taskId!), onSuccess: () => { setConfirmDelete(false); return done('Görev silindi.'); } });

  const submit = () => {
    const parsed = parseDueDate(due);
    const next = { title: title.trim().length < 2 ? 'Görevin ne olduğunu kısaca yaz.' : undefined, due: parsed.ok ? undefined : parsed.error };
    setErrors(next);
    if (!next.title && parsed.ok) save.mutate(parsed.iso);
  };

  const members = [{ value: UNASSIGNED, label: 'Henüz atama', description: 'Sonra birine verilebilir.' },
    ...roster.filter((r) => r.status === 'active').map((r) => ({ value: r.user_id, label: r.display_name ?? 'İsimsiz üye', description: r.title ?? undefined }))];
  const saveError = save.error ? toAppError(save.error) : null;

  return (
    <Screen header={header} footer={<Button label={taskId ? 'Değişiklikleri kaydet' : 'Görevi ekle'} loading={save.isPending} onPress={submit} />}>
      <Text variant="eyebrow" color="textSecondary">TAKIM GÖREVİ</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>{taskId ? 'Görevi\ngüncelle.' : 'Kim, neyi,\nne zamana?'}</Text>
      <View style={{ gap: space[5], marginTop: space[6] }}>
        <Input label="Görev" value={title} onChangeText={setTitle} maxLength={140} error={errors.title} placeholder="Örn. Şasi çizimini tamamla" />
        <TextArea label="Açıklama (isteğe bağlı)" value={description} onChangeText={setDescription} maxLength={2000} />
        <Select label="Sorumlu" options={members} value={assignee} onChange={setAssignee} />
        <DateField label="Son tarih (isteğe bağlı)" value={due} onChangeText={setDue} error={errors.due} />
        <Select label="Öncelik" options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        <Select label="Durum" options={TASK_STATUS_OPTIONS} value={status} onChange={setStatus} />
        {saveError && <Notice tone="danger" title="Görev kaydedilmedi">{saveError.code === 'assignee_not_team_member' ? 'Seçtiğin kişi artık takımın aktif üyesi değil. Başka bir sorumlu seç.' : saveError.code === 'not_found' || saveError.code === 'forbidden' ? 'Görevleri yalnızca kaptan ve mentorlar düzenleyebilir.' : saveError.message}</Notice>}
        {taskId && <Button kind="danger" label="Görevi sil" onPress={() => { remove.reset(); setConfirmDelete(true); }} />}
      </View>
      <Modal visible={confirmDelete} title="Görevi silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">Bu işlem geri alınamaz.</Text>
        {remove.error && <Notice tone="danger">{toAppError(remove.error).message}</Notice>}
        <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
