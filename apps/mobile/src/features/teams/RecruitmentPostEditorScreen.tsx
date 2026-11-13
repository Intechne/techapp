import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, DateField, ErrorState, Input, LoadingSkeleton, Modal, Notice, Screen, Text, TextArea, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { deleteRecruitmentPost, fetchAllPosts, saveRecruitmentPost, teamKeys, type RecruitmentPost } from './api';
import { isoToDisplayDate, validatePost, type PostForm } from './logic';

type Props = NativeStackScreenProps<CommunityStackParamList, 'RecruitmentPostEditor'>;

export function RecruitmentPostEditorScreen({ navigation, route }: Props) {
  const { teamId, postId } = route.params;
  const posts = useQuery({ queryKey: teamKeys.allPosts(teamId), queryFn: () => fetchAllPosts(teamId), enabled: !!postId });
  const header = <AppHeader onBack={navigation.goBack} title={postId ? 'İlanı düzenle' : 'Yeni ilan'} />;
  if (postId && posts.isPending) return <Screen header={header}><LoadingSkeleton cards={1} /></Screen>;
  if (postId && posts.isError) return <Screen header={header}><ErrorState error={toAppError(posts.error)} onRetry={() => void posts.refetch()} /></Screen>;
  const initial = postId ? posts.data?.find((p) => p.id === postId) ?? null : null;
  if (postId && !initial) return <Screen header={header}><ErrorState error={toAppError({ code: 'PT404', message: 'recruitment_post_not_found' })} /></Screen>;
  return <PostFormBody key={postId ?? 'new'} teamId={teamId} postId={postId} initial={initial} header={header} navigation={navigation} />;
}

function PostFormBody({ teamId, postId, initial, header, navigation }: { teamId: string; postId?: string; initial: RecruitmentPost | null; header: React.ReactElement; navigation: Props['navigation'] }) {
  const qc = useQueryClient(); const toast = useToast();
  const [form, setForm] = useState<PostForm>({
    title: initial?.title ?? '', roleLabel: initial?.role_label ?? '', description: initial?.description ?? '', skills: initial?.skills.join(', ') ?? '',
    closesAt: isoToDisplayDate(initial?.closes_at ?? null),
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PostForm, string>>>({}); const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof PostForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const done = async (message: string) => { await qc.invalidateQueries({ queryKey: ['teams', teamId] }); toast.show(message, 'success'); navigation.goBack(); };
  const save = useMutation({
    mutationFn: (value: { title: string; roleLabel: string; description: string; skills: string[]; closesAt: string | null }) => saveRecruitmentPost(teamId, postId, value),
    onSuccess: () => done(postId ? 'İlan güncellendi.' : 'İlan yayında.'),
  });
  const remove = useMutation({ mutationFn: () => deleteRecruitmentPost(postId!), onSuccess: () => { setConfirmDelete(false); return done('İlan silindi.'); } });
  const submit = () => {
    const r = validatePost(form);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({}); save.mutate(r.value);
  };
  const saveError = save.error ? toAppError(save.error) : null;

  return (
    <Screen header={header} footer={<Button label={postId ? 'Değişiklikleri kaydet' : 'İlanı yayınla'} loading={save.isPending} onPress={submit} />}>
      <Text variant="title">{postId ? 'İlanı güncelle.' : 'Hangi role kişi arıyorsunuz?'}</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>İlan takım sayfasında görünür; başvurular Takım alanındaki İlanlar sekmesine gelir.</Text>
      <View style={{ gap: space[5], marginTop: space[6] }}>
        <Input label="İlan başlığı" value={form.title} onChangeText={set('title')} maxLength={120} error={errors.title} placeholder="Örn. Mekanik ekibine katıl" />
        <Input label="Rol (isteğe bağlı)" value={form.roleLabel} onChangeText={set('roleLabel')} maxLength={60} error={errors.roleLabel} placeholder="Örn. Mekanik lideri" />
        <TextArea label="Açıklama (isteğe bağlı)" value={form.description} onChangeText={set('description')} maxLength={2000} error={errors.description} />
        <Input label="Beceriler (isteğe bağlı)" value={form.skills} onChangeText={set('skills')} error={errors.skills} help="Virgülle ayır, en fazla 12." placeholder="CAD, Şasi, Python" />
        <DateField label="Son başvuru (isteğe bağlı)" value={form.closesAt} onChangeText={set('closesAt')} error={errors.closesAt} />
        {saveError && <Notice tone="danger" title="İlan kaydedilmedi">{saveError.code === 'forbidden' ? 'İlanları yalnızca kaptan ve mentorlar yönetebilir.' : saveError.message}</Notice>}
        {postId && <Button kind="danger" label="İlanı sil" onPress={() => { remove.reset(); setConfirmDelete(true); }} />}
      </View>
      <Modal visible={confirmDelete} title="İlanı silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">İlan ve bu ilana gelen başvurular silinir. Geçici olarak kapatmak için ilanı kapatman yeterli.</Text>
        {remove.error && <Notice tone="danger">{toAppError(remove.error).message}</Notice>}
        <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
