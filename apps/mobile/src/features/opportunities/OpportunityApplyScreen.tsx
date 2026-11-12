import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, Checkbox, ErrorState, LoadingSkeleton, Notice, Screen, Text, TextArea, space, useToast } from '../../design-system';
import { track } from '../../lib/analytics';
import { toAppError } from '../../lib/errors';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { useAccountState, useSession } from '../auth/SessionProvider';
import { fetchOpportunity, fetchSharePreview, opportunityKeys, submitApplication } from './api';
import { SHARED_FIELD_LABEL, formatSharedValue, opportunityIneligibility } from './labels';

/** The applicant sees exactly what the organisation will receive before anything is sent. The snapshot is frozen on the server at submission. */
export function OpportunityApplyScreen({ navigation, route }: NativeStackScreenProps<OpportunitiesStackParamList, 'OpportunityApply'>) {
  const { opportunityId } = route.params;
  const { userId } = useSession(); const account = useAccountState(); const qc = useQueryClient(); const toast = useToast();
  const opportunity = useQuery({ queryKey: opportunityKeys.detail(opportunityId), queryFn: () => fetchOpportunity(opportunityId) });
  const preview = useQuery({ queryKey: opportunityKeys.preview(opportunityId, userId), queryFn: () => fetchSharePreview(opportunityId), staleTime: 0 });
  const [motivation, setMotivation] = useState(''); const [accepted, setAccepted] = useState(false); const [showError, setShowError] = useState(false);
  const key = useRef(Crypto.randomUUID());

  const submit = useMutation({
    mutationFn: () => submitApplication(opportunityId, key.current, motivation, preview.data?.shared_fields ?? []),
    onSuccess: async () => {
      track('application_submitted', { opportunity_id: opportunityId });
      await qc.invalidateQueries({ queryKey: ['applications'] });
      toast.show('Başvurun alındı.', 'success');
      navigation.replace('MyApplications');
    },
    // The organisation changed what it asks for: show the new list; the applicant has to confirm again.
    onError: (e) => { if (toAppError(e).code === 'shared_fields_changed') { setAccepted(false); void preview.refetch(); } },
  });

  if (opportunity.isPending || preview.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  const loadError = opportunity.error ?? preview.error;
  if (loadError || !opportunity.data || !preview.data) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(loadError)} onRetry={() => { void opportunity.refetch(); void preview.refetch(); }} /></Screen>;

  const ineligible = opportunityIneligibility(opportunity.data, account.data?.is_minor);
  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Başvuru" />}
      footer={ineligible ? undefined : <Button label="Başvuruyu gönder" loading={submit.isPending} onPress={() => { if (!accepted) { setShowError(true); return; } submit.mutate(); }} />}>
      {ineligible && <Notice tone="warning" title="Bu fırsata başvuramıyorsun">{ineligible}</Notice>}
      <Text variant="title" style={ineligible ? { marginTop: space[4] } : undefined}>{opportunity.data.title}</Text>

      <Text variant="section" style={{ marginTop: space[6] }}>{preview.data.organization ?? 'Kurum'} şunları görecek</Text>
      <Card style={{ marginTop: space[3], gap: space[3] }}>
        {preview.data.shared_fields.map((field) => (
          <View key={field} style={{ gap: 2 }}>
            <Text variant="caption" color="textSecondary">{SHARED_FIELD_LABEL[field] ?? field}</Text>
            <Text variant="bodySmall">{formatSharedValue(field, preview.data.snapshot[field])}</Text>
          </View>))}
      </Card>
      <Text variant="caption" color="textSecondary" style={{ marginTop: space[2] }}>Boş görünen alanları profilinden doldurabilirsin. Gönderdikten sonra profilini değiştirsen de bu başvuruda gönderdiğin bilgiler aynı kalır.</Text>

      <View style={{ gap: space[4], marginTop: space[5] }}>
        <TextArea label="Neden başvuruyorsun? (isteğe bağlı)" value={motivation} onChangeText={setMotivation} maxLength={2000} help={`${motivation.length} / 2000`} />
        <Checkbox checked={accepted} onChange={(v) => { setAccepted(v); setShowError(false); }} label="Yukarıdaki bilgilerimin bu başvuru için kurumla paylaşılmasını kabul ediyorum."
          error={showError ? 'Devam etmek için bu kutuyu işaretlemen gerekiyor.' : undefined} />
        {submit.error && <Notice tone="danger" title="Başvurun gönderilmedi">{toAppError(submit.error).message}</Notice>}
      </View>
    </Screen>
  );
}
