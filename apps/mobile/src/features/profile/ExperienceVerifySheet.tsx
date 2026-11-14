import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, ErrorState, LoadingSkeleton, Notice, Radio, SheetFrame, Text, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/types';
import { closeSheet } from '../../navigation/sheets';
import { useAttestingOrganizations, useRequestAttestation } from './api';

/** "Doğrulama iste": pick the organisation that can attest this experience. Content of the `ExperienceVerify` form-sheet route. */
export function ExperienceVerifySheet({ experienceId, onClose }: { experienceId: string; onClose: () => void }) {
  const toast = useToast();
  const [orgId, setOrgId] = useState<string | null>(null);
  const orgs = useAttestingOrganizations(true);
  const request = useRequestAttestation(experienceId);
  return (
    <SheetFrame title="Doğrulama iste" onClose={onClose}>
      <Text variant="bodySmall" color="textSecondary">Doğrulama, bir kurumun bu deneyimin belirli bir kapsamını (“etkinliğe katıldı”, “yazılım ekibinde görev aldı” gibi) onaylamasıdır. Seçtiğin kurumun yetkilileri bu deneyimin içeriğini görür; iletişim bilgilerin ve doğum tarihin paylaşılmaz.</Text>
      {orgs.isPending ? <LoadingSkeleton cards={1} /> : orgs.isError ? <ErrorState error={toAppError(orgs.error)} onRetry={() => void orgs.refetch()} />
        : orgs.data.length === 0 ? <Notice tone="warning">Şu an doğrulama yapabilecek bir kurum yok.</Notice>
          : <View accessibilityRole="radiogroup" style={{ gap: space[2] }}>{orgs.data.map((o) => <Radio key={o.id} label={o.name} checked={orgId === o.id} onChange={() => setOrgId(o.id)} />)}</View>}
      {request.error && <Notice tone="danger" title="İstek gönderilmedi">{toAppError(request.error).message}</Notice>}
      <Button label="İsteği gönder" disabled={!orgId} loading={request.isPending}
        onPress={() => orgId && request.mutate(orgId, { onSuccess: () => { onClose(); toast.show('Doğrulama isteğin kuruma iletildi.', 'success'); } })} />
    </SheetFrame>
  );
}

export function ExperienceVerifyScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ExperienceVerify'>) {
  return <ExperienceVerifySheet experienceId={route.params.experienceId} onClose={() => closeSheet(navigation)} />;
}
