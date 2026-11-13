import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, ErrorState, Input, LoadingSkeleton, Modal, Notice, Screen, Text, TextArea, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { deleteTeamProject, fetchTeamProjects, teamKeys, upsertTeamProject, type TeamProject } from './api';
import { validateProject, type ProjectForm } from './logic';

type ProjectValue = Extract<ReturnType<typeof validateProject>, { ok: true }>['value'];
type Props = NativeStackScreenProps<CommunityStackParamList, 'TeamProjectEditor'>;

export function TeamProjectEditorScreen({ navigation, route }: Props) {
  const { teamId, projectId } = route.params;
  // Editing starts from the list the team page already loaded (RLS: every visitor reads projects), so there is no second read path.
  const projects = useQuery({ queryKey: teamKeys.projects(teamId), queryFn: () => fetchTeamProjects(teamId), enabled: !!projectId });
  const header = <AppHeader onBack={navigation.goBack} title={projectId ? 'Projeyi düzenle' : 'Yeni proje'} />;
  if (projectId && projects.isPending) return <Screen header={header}><LoadingSkeleton cards={1} /></Screen>;
  if (projectId && projects.isError) return <Screen header={header}><ErrorState error={toAppError(projects.error)} onRetry={() => void projects.refetch()} /></Screen>;
  const initial = projectId ? projects.data?.find((p) => p.id === projectId) ?? null : null;
  if (projectId && !initial) return <Screen header={header}><ErrorState error={toAppError({ code: 'PT404', message: 'team_project_not_found' })} /></Screen>;
  return <ProjectFormBody key={projectId ?? 'new'} teamId={teamId} projectId={projectId} initial={initial} header={header} navigation={navigation} />;
}

function ProjectFormBody({ teamId, projectId, initial, header, navigation }: { teamId: string; projectId?: string; initial: TeamProject | null; header: React.ReactElement; navigation: Props['navigation'] }) {
  const qc = useQueryClient(); const toast = useToast();
  const [form, setForm] = useState<ProjectForm>({ title: initial?.title ?? '', summary: initial?.summary ?? '', year: initial?.year != null ? String(initial.year) : '', url: initial?.url ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({}); const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof ProjectForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const done = async (message: string) => { await qc.invalidateQueries({ queryKey: ['teams', teamId] }); toast.show(message, 'success'); navigation.goBack(); };
  const save = useMutation({
    mutationFn: (value: ProjectValue) => upsertTeamProject(teamId, projectId ?? null, { title: value.title, summary: value.summary, year: value.year, url: value.url }),
    onSuccess: () => done(projectId ? 'Proje güncellendi.' : 'Proje eklendi.'),
  });
  const remove = useMutation({ mutationFn: () => deleteTeamProject(projectId!), onSuccess: () => { setConfirmDelete(false); return done('Proje silindi.'); } });

  const submit = () => {
    const r = validateProject(form);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({}); save.mutate(r.value);
  };
  // A cap (team_project_limit) is a fact, not a glitch: the message says so and there is nothing to retry.
  const saveError = save.error ? toAppError(save.error) : null;

  return (
    <Screen header={header} footer={<Button label={projectId ? 'Değişiklikleri kaydet' : 'Projeyi ekle'} loading={save.isPending} onPress={submit} />}>
      <Text variant="title">{projectId ? 'Projeyi güncelle.' : 'Takımın neyi inşa etti?'}</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>Projeler takımın herkese açık sayfasında görünür. Kişisel bilgi ve iletişim bilgisi yazma.</Text>
      <View style={{ gap: space[5], marginTop: space[6] }}>
        <Input label="Proje adı" value={form.title} onChangeText={set('title')} maxLength={120} error={errors.title} placeholder="Örn. Otonom şasi v2" />
        <TextArea label="Özet (isteğe bağlı)" value={form.summary} onChangeText={set('summary')} maxLength={600} error={errors.summary} />
        <Input label="Yıl (isteğe bağlı)" value={form.year} onChangeText={set('year')} maxLength={4} keyboardType="number-pad" error={errors.year} placeholder="2026" />
        <Input label="Bağlantı (isteğe bağlı)" value={form.url} onChangeText={set('url')} maxLength={500} autoCapitalize="none" autoCorrect={false} keyboardType="url" error={errors.url} help="https:// ile başlayan bir adres." placeholder="https://" />
        {saveError && <Notice tone="danger" title="Proje kaydedilmedi">{saveError.message}</Notice>}
        {projectId && <Button kind="danger" label="Projeyi sil" onPress={() => { remove.reset(); setConfirmDelete(true); }} />}
      </View>
      <Modal visible={confirmDelete} title="Projeyi silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">Proje takım sayfasından kalkar. Bu işlem geri alınamaz.</Text>
        {remove.error && <Notice tone="danger">{toAppError(remove.error).message}</Notice>}
        <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
