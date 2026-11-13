import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, Chip, ErrorState, Input, LoadingSkeleton, Notice, Screen, Select, Text, TextArea, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { EducationStage, ProfileRow } from '../../lib/database.types';
import type { ProfileStackParamList } from '../../navigation/types';
import { EDUCATION_STAGES } from '../onboarding/options';
import { useMyBirthDate, useMyProfile, useUpdateProfile } from './api';
import { MAX_SKILLS, addSkill, emptyToNull, toInputDate } from './logic';

export function EditProfileScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>) {
  const profile = useMyProfile();
  if (profile.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} title="Profili düzenle" />}><LoadingSkeleton cards={1} /></Screen>;
  if (profile.isError) return <Screen header={<AppHeader onBack={navigation.goBack} title="Profili düzenle" />}><ErrorState error={toAppError(profile.error)} onRetry={() => void profile.refetch()} /></Screen>;
  return <EditProfileForm initial={profile.data} navigation={navigation} />;
}

/** Mounted once the profile is loaded, so the fields start from server values instead of being synced in an effect. */
function EditProfileForm({ initial, navigation }: { initial: ProfileRow; navigation: NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>['navigation'] }) {
  const birth = useMyBirthDate();
  const save = useUpdateProfile(); const toast = useToast();
  const [headline, setHeadline] = useState(initial.headline ?? ''); const [bio, setBio] = useState(initial.bio ?? ''); const [city, setCity] = useState(initial.city ?? '');
  const [stage, setStage] = useState<EducationStage | null>(initial.education_stage); const [skills, setSkills] = useState<string[]>(initial.skills ?? []);
  const [skillInput, setSkillInput] = useState(''); const [skillError, setSkillError] = useState<string | undefined>();

  const commitSkill = () => {
    const result = addSkill(skills, skillInput);
    setSkillError(result.error); setSkills(result.skills);
    if (!result.error) setSkillInput('');
  };
  const submit = () => {
    const pending = skillInput.trim() ? addSkill(skills, skillInput).skills : skills;
    save.mutate({ headline: emptyToNull(headline), bio: emptyToNull(bio), city: emptyToNull(city), education_stage: stage, skills: pending },
      { onSuccess: () => { toast.show('Profilin güncellendi.', 'success'); navigation.goBack(); } });
  };

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Profili düzenle" />} footer={<Button label="Kaydet" loading={save.isPending} onPress={submit} />}>
      <Text variant="display">Kendini anlat.</Text>
      <View style={{ gap: space[5], marginTop: space[5] }}>
        <Card style={{ gap: space[1] }}>
          <Text variant="caption" color="textSecondary">AD SOYAD</Text><Text variant="label">{initial.display_name ?? '—'}</Text>
          <Text variant="caption" color="textSecondary" style={{ marginTop: space[2] }}>DOĞUM TARİHİ</Text><Text variant="label">{toInputDate(birth.data) || '—'}</Text>
          <Text variant="caption" color="textSecondary" style={{ marginTop: space[2] }}>Katılım kartların ve doğrulamaların bu bilgilere bağlı olduğu için buradan değiştirilemez. Bir hata varsa destek ekibine yaz. Doğum tarihin profilinde görünmez.</Text>
        </Card>
        <Input label="Kısa başlık" value={headline} onChangeText={setHeadline} maxLength={120} placeholder="Örn. Robotik takımında yazılımcı" help="Adının altında görünür." />
        <TextArea label="Hakkında" value={bio} onChangeText={setBio} maxLength={600} placeholder="Nelerle ilgileniyorsun, ne üretmek istiyorsun?" help={`${bio.length} / 600`} />
        <Input label="Şehir" value={city} onChangeText={setCity} maxLength={60} autoComplete="off" />
        <Select label="Eğitim aşaman" options={EDUCATION_STAGES} value={stage} onChange={setStage} />

        <View style={{ gap: space[2] }}>
          <Input label={`Beceriler (${skills.length} / ${MAX_SKILLS})`} value={skillInput} onChangeText={(t) => { setSkillInput(t); setSkillError(undefined); }} onSubmitEditing={commitSkill}
            returnKeyType="done" maxLength={60} placeholder="Örn. Python, CAD, lehimleme" error={skillError} help="Virgülle ayırıp birden fazla ekleyebilirsin. Beceriler kendi beyanın olarak görünür." />
          <Button kind="secondary" label="Beceriyi ekle" disabled={!skillInput.trim()} onPress={commitSkill} />
          {skills.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }} accessibilityLabel="Eklenen beceriler. Kaldırmak için dokun.">
              {skills.map((s) => <Chip key={s} label={`${s}  ✕`} onPress={() => setSkills((cur) => cur.filter((x) => x !== s))} />)}
            </View>
          )}
        </View>

        <Text variant="caption" color="textSecondary">Profilinin keşfedilebilir olup olmayacağını Ayarlar’daki Gizlilik bölümünden seçersin.</Text>
        {save.error && <Notice tone="danger" title="Profilin kaydedilmedi">{toAppError(save.error).message}</Notice>}
      </View>
    </Screen>
  );
}
