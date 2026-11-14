import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, DateField, Input, Notice, Screen, Select, Text, space, useToast } from '../../design-system';
import { parseBirthDate } from '../../lib/dates';
import { WEB_ORIGIN, WEB_PATHS } from '../../lib/domain';
import { toAppError } from '../../lib/errors';
import { openExternalUrl } from '../../lib/links';
import { getSupabase } from '../../lib/supabase';
import type { EducationStage } from '../../lib/database.types';
import type { RootStackParamList } from '../../navigation/types';
import { EDUCATION_STAGES } from '../onboarding/options';
import { usePrefs } from '../onboarding/PrefsProvider';
import { signOut } from './authService';
import { useSession } from './SessionProvider';

export function ProfileBootstrapScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ProfileBootstrap'>) {
  const { prefs } = usePrefs();
  const { userId } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [stage, setStage] = useState<EducationStage | null>(prefs.educationStage);
  const [errors, setErrors] = useState<{ name?: string; birth?: string; stage?: string }>({});

  const save = useMutation({
    mutationFn: async (birthIso: string) => {
      const { error } = await getSupabase().rpc('complete_profile_bootstrap', {
        p_display_name: name.trim(), p_education_stage: stage!, p_birth_date: birthIso, p_interest_slugs: prefs.interestSlugs,
      });
      if (error) throw toAppError(error);
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['account-state', userId] }), qc.invalidateQueries({ queryKey: ['profile', userId] })]);
      navigation.popTo('Main');
    },
  });

  type Field = 'name' | 'birth' | 'stage';
  /** A field's error goes away as soon as its value changes; the other fields' errors stay until re-submit. */
  const clear = (f: Field) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  const submit = () => {
    const parsed = parseBirthDate(birth);
    const next = {
      name: name.trim().length < 2 ? 'Adın en az 2 karakter olmalı.' : undefined,
      birth: parsed.ok ? undefined : parsed.error,
      stage: stage ? undefined : 'Bir seçenek işaretle.',
    };
    setErrors(next);
    if (!next.name && !next.stage && parsed.ok) save.mutate(parsed.iso);
  };

  return (
    <Screen header={<AppHeader title="Profilin" onBack={() => { void signOut().finally(() => navigation.popTo('Main')); }} />}
      footer={<Button label="Devam et" loading={save.isPending} onPress={submit} />}>
      <Text variant="display" style={{ marginTop: space[3] }}>Birkaç bilgi,{'\n'}o kadar.</Text>
      <View style={{ marginTop: space[6], gap: space[5] }}>
        <Input label="Ad soyad" value={name} onChangeText={(v) => { setName(v); clear('name'); }} autoComplete="name" textContentType="name" error={errors.name} />
        <DateField label="Doğum tarihi" value={birth} onChangeText={(v) => { setBirth(v); clear('birth'); }} error={errors.birth}
          help="Veli onayı gerekip gerekmediğini belirlemek için kullanılır. Profilinde görünmez, sonradan değiştirilemez." />
        <Select label="Eğitim aşaman" options={EDUCATION_STAGES} value={stage} onChange={(v) => { setStage(v); clear('stage'); }} />
        {errors.stage && <Text variant="caption" color="danger">{errors.stage}</Text>}
        {save.error && (toAppError(save.error).code === 'signup_closed'
          // Closed sign-up (legal gate): not a failure of the form. Say so honestly and offer the way in for pilot staff.
          ? <View style={{ gap: space[3] }}>
              <Notice tone="warning" alert>{toAppError(save.error).message}</Notice>
              <Button kind="secondary" label="Bize yaz" icon="link"
                onPress={() => { void openExternalUrl(WEB_ORIGIN + WEB_PATHS.support, () => toast.show('Bağlantı açılamadı.', 'danger')); }} />
            </View>
          : <Notice tone="danger">{toAppError(save.error).message}</Notice>)}
      </View>
    </Screen>
  );
}
