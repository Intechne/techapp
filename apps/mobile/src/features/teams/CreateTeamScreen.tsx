import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Input, Notice, Screen, Select, Text, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { createTeam } from './api';

const KINDS = [
  { value: 'team', label: 'Takım', description: 'Yarışma, proje ya da ürün için birlikte çalışan ekip.' },
  { value: 'community', label: 'Topluluk', description: 'Ortak bir ilgi etrafında buluşan, herkese açık grup.' },
] as const;

export function CreateTeamScreen({ navigation }: NativeStackScreenProps<CommunityStackParamList, 'CreateTeam'>) {
  const qc = useQueryClient();
  const [name, setName] = useState(''); const [kind, setKind] = useState<'team' | 'community'>('team');
  const [category, setCategory] = useState(''); const [tagline, setTagline] = useState(''); const [nameError, setNameError] = useState<string>();

  const create = useMutation({
    mutationFn: () => createTeam({ name, kind, category, tagline }),
    onSuccess: async (team) => { await qc.invalidateQueries({ queryKey: ['teams'] }); navigation.replace('TeamWorkspace', { teamId: team.id }); },
  });
  const submit = () => {
    if (name.trim().length < 2) { setNameError('En az 2 karakterlik bir ad yaz.'); return; }
    setNameError(undefined); create.mutate();
  };
  const error = create.error ? toAppError(create.error) : null;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Takım kur" />} footer={<Button label="Takımı oluştur" loading={create.isPending} onPress={submit} />}>
      <Text variant="title">Ekibine bir yer aç.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>Kurduğun takımın kaptanı sen olursun. Rolleri sonradan paylaşabilirsin.</Text>
      <View style={{ gap: space[5], marginTop: space[6] }}>
        <Input label="Takım adı" value={name} onChangeText={setName} maxLength={80} error={nameError} placeholder="Örn. Nova Robotik" />
        <Select label="Tür" options={KINDS} value={kind} onChange={setKind} />
        <Input label="Alan (isteğe bağlı)" value={category} onChangeText={setCategory} maxLength={60} placeholder="Robotik, yazılım, sosyal etki…" />
        <Input label="Kısa tanıtım (isteğe bağlı)" value={tagline} onChangeText={setTagline} maxLength={160} placeholder="Tek cümleyle ne yapıyorsunuz?" />
        {error && <Notice tone="danger" title="Takım oluşturulamadı">{error.code === 'profile_incomplete' ? 'Önce Profil sekmesinden profilini tamamlaman gerekiyor.' : error.message}</Notice>}
      </View>
    </Screen>
  );
}
