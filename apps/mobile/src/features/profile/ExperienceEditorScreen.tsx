import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Chip, DateField, ErrorState, Input, LoadingSkeleton, Modal, Notice, Radio, Screen, Text, TextArea, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CvExperience } from './cvSchema';
import type { ProfileStackParamList } from '../../navigation/types';
import { useMyCv, useSaveExperience, type ExperienceInput } from './api';
import { EXPERIENCE_KINDS, type ExperienceKind } from './labels';
import { emptyToNull, isHttpsUrl, isVerified, parseDate, substanceChanged, toInputDate, validateRange } from './logic';

type Errors = Partial<Record<'title' | 'link' | 'start' | 'end', string>>;

export function ExperienceEditorScreen({ navigation, route }: NativeStackScreenProps<ProfileStackParamList, 'ExperienceEditor'>) {
  const experienceId = route.params?.experienceId;
  const cv = useMyCv();
  const existing = useMemo(() => cv.data?.experiences.find((x) => x.id === experienceId) ?? null, [cv.data, experienceId]);

  const header = <AppHeader onBack={navigation.goBack} title={experienceId ? 'Deneyimi düzenle' : 'Deneyim ekle'} />;
  if (experienceId && cv.isPending) return <Screen header={header}><LoadingSkeleton cards={1} /></Screen>;
  if (experienceId && cv.isError) return <Screen header={header}><ErrorState error={toAppError(cv.error)} onRetry={() => void cv.refetch()} /></Screen>;
  if (experienceId && !existing) return <Screen header={header}><Notice tone="warning">Bu deneyim bulunamadı. Silinmiş olabilir.</Notice></Screen>;
  return <ExperienceForm key={experienceId ?? 'new'} experienceId={experienceId} initial={existing} header={header} navigation={navigation} />;
}

interface FormProps { experienceId?: string; initial: CvExperience | null; header: React.ReactElement; navigation: NativeStackScreenProps<ProfileStackParamList, 'ExperienceEditor'>['navigation'] }

/** Mounted once the entry is loaded, so the fields start from server values instead of being synced in an effect. */
function ExperienceForm({ experienceId, initial: existing, header, navigation }: FormProps) {
  const save = useSaveExperience(experienceId); const toast = useToast();
  const [kind, setKind] = useState<ExperienceKind>(existing?.kind ?? 'project'); const [title, setTitle] = useState(existing?.title ?? ''); const [role, setRole] = useState(existing?.role ?? '');
  const [contribution, setContribution] = useState(existing?.contribution ?? ''); const [org, setOrg] = useState(existing?.organization_name ?? ''); const [link, setLink] = useState(existing?.link_url ?? '');
  const [start, setStart] = useState(toInputDate(existing?.started_on)); const [end, setEnd] = useState(toInputDate(existing?.ended_on)); const [showOnProfile, setShowOnProfile] = useState(existing ? existing.visibility === 'profile' : true);
  const [errors, setErrors] = useState<Errors>({}); const [pending, setPending] = useState<ExperienceInput | null>(null);

  const run = (input: ExperienceInput) => save.mutate(input, {
    onSuccess: (id) => { setPending(null); toast.show(input.status === 'draft' ? 'Taslak kaydedildi.' : 'Deneyimin kaydedildi.', 'success'); navigation.replace('ExperienceDetail', { experienceId: id }); },
    onError: () => setPending(null),
  });

  const submit = (publish: boolean) => {
    const s = parseDate(start); const e = parseDate(end);
    const next: Errors = {
      title: title.trim().length < 3 ? 'Başlık en az 3 karakter olmalı.' : undefined,
      link: link.trim() && !isHttpsUrl(link) ? 'Bağlantı https:// ile başlamalı.' : undefined,
      start: s.ok ? undefined : s.error,
      end: e.ok ? (s.ok ? validateRange(s.iso, e.iso) ?? undefined : undefined) : e.error,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !s.ok || !e.ok) return;
    const input: ExperienceInput = {
      kind, title: title.trim(), role: emptyToNull(role), contribution: emptyToNull(contribution), organization_name: emptyToNull(org), link_url: emptyToNull(link),
      started_on: s.iso, ended_on: e.iso, status: publish ? 'published' : existing?.status === 'published' ? 'published' : 'draft',
      visibility: publish && showOnProfile ? 'profile' : publish ? 'private' : existing?.visibility ?? 'private',
    };
    // Editing what the organisation verified invalidates the verification on the server: say so before it happens.
    if (existing && isVerified(existing) && substanceChanged(existing, input)) { setPending(input); return; }
    run(input);
  };

  return (
    <Screen header={header} footer={<><Button label={showOnProfile ? 'Kaydet ve profilimde göster' : 'Kaydet'} loading={save.isPending && !pending} onPress={() => submit(true)} />
      {(!existing || existing.status === 'draft') && <Button kind="secondary" label="Taslak olarak kaydet" disabled={save.isPending} onPress={() => submit(false)} />}</>}>
      <Text variant="eyebrow" color="textSecondary">DENEYİM PROFİLİN</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Ürettiğin bir şeyi{'\n'}görünür kıl.</Text>
      <View style={{ gap: space[5], marginTop: space[5] }}>
        {existing && isVerified(existing) && <Notice tone="warning" title="Bu deneyim doğrulanmış">Başlık, rol, katkı, kurum, tür ya da tarihleri değiştirirsen doğrulama geçersiz olur ve yeniden istemen gerekir. Bağlantıyı ve görünürlüğü değiştirmek doğrulamayı etkilemez.</Notice>}
        <View style={{ gap: space[2] }}>
          <Text variant="label">Tür</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }} accessibilityRole="radiogroup">
            {EXPERIENCE_KINDS.map((k) => <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />)}
          </View>
        </View>
        <Input label="Başlık" value={title} onChangeText={setTitle} maxLength={140} placeholder="Örn. Çizgi izleyen robot projesi" error={errors.title} />
        <Input label="Senin rolün" value={role} onChangeText={setRole} maxLength={80} placeholder="Örn. Yazılım, takım kaptanı, gönüllü eğitmen" />
        <TextArea label="Senin katkın" value={contribution} onChangeText={setContribution} maxLength={2000} placeholder="Ne yaptın, ne ortaya çıktı? Takım işiyse kendi payını yaz." help={`${contribution.length} / 2000`} />
        <Input label="Kurum / takım / etkinlik" value={org} onChangeText={setOrg} maxLength={120} />
        <DateField label="Başlangıç (isteğe bağlı)" value={start} onChangeText={setStart} error={errors.start} />
        <DateField label="Bitiş (isteğe bağlı)" value={end} onChangeText={setEnd} error={errors.end} help="Devam ediyorsa boş bırak." />
        <Input label="Çıktı bağlantısı (isteğe bağlı)" value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="https://" error={errors.link} help="Repo, video, sunum… Herkese açık bir bağlantı olsun." />
        <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
          <Text variant="label">Kimler görebilir?</Text>
          <Radio label="Profilimde göster" description="Profilini keşfe açtıysan diğer kullanıcılar da görür." checked={showOnProfile} onChange={() => setShowOnProfile(true)} />
          <Radio label="Yalnızca ben" description="Doğrulama istediğinde ilgili kurum yine de görebilir." checked={!showOnProfile} onChange={() => setShowOnProfile(false)} />
        </View>
        <Notice tone="info">Kaydettiğinde bu deneyim “kendi beyanı” olarak görünür. Dilersen sonra bir kurumdan doğrulama isteyebilirsin.</Notice>
        {save.error && <Notice tone="danger" title="Deneyimin kaydedilmedi">{toAppError(save.error).message}</Notice>}
      </View>

      <Modal visible={!!pending} title="Doğrulama geçersiz olacak" onClose={() => setPending(null)}>
        <Text variant="bodySmall" color="textSecondary">Kurumun doğruladığı bilgileri değiştirdin. Kaydedersen bu deneyim yeniden “kendi beyanı” olur; istersen tekrar doğrulama isteyebilirsin.</Text>
        <Button kind="danger" label="Yine de kaydet" loading={save.isPending} onPress={() => pending && run(pending)} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setPending(null)} />
      </Modal>
    </Screen>
  );
}
