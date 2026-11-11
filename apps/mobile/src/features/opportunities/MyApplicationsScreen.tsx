import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, ApplicationStatus, Button, Card, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Modal, Notice, ResponsiveGrid, Screen, Text, TextButton, space, useToast } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchMyApplications, opportunityKeys, withdrawApplication } from './api';
import { OPPORTUNITY_TYPE } from './labels';

const OPEN = ['submitted', 'in_review', 'info_requested'];

export function MyApplicationsScreen({ navigation }: NativeStackScreenProps<OpportunitiesStackParamList, 'MyApplications'>) {
  const { userId } = useSession(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: opportunityKeys.myApplications(userId), queryFn: () => fetchMyApplications(userId!), enabled: !!userId });
  const [target, setTarget] = useState<string | null>(null);
  const withdraw = useMutation({ mutationFn: withdrawApplication, onSuccess: async () => { setTarget(null); await qc.invalidateQueries({ queryKey: ['applications'] }); toast.show('Başvurun geri çekildi.'); } });

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Başvurularım" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="display" style={{ marginBottom: space[4] }}>Attığın adımlar.</Text>
      {!userId ? <EmptyState icon="opportunity" title="Başvuruların burada görünecek" body="Bir çağrıya başvurduğunda durumunu buradan takip edersin." />
        : q.isPending ? <LoadingSkeleton /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
          : q.data.length === 0 ? <EmptyState icon="opportunity" title="Henüz bir başvurun yok" body="Sana uyan bir çağrı bul, ilk adımı at." actionLabel="Çağrılara göz at" onAction={() => navigation.navigate('OpportunitiesHome')} />
            : <ResponsiveGrid maxColumns={2}>{q.data.map((a) => (
              <Card key={a.id} style={{ gap: space[2] }}>
                <ApplicationStatus status={a.status} />
                <Text variant="cardTitle">{a.opportunity.title}</Text>
                <MetadataRow icon="opportunity">{[OPPORTUNITY_TYPE[a.opportunity.type].label, a.opportunity.organization?.name].filter(Boolean).join(' · ')}</MetadataRow>
                {a.submitted_at && <MetadataRow icon="clock">Gönderildi: {formatDate(a.submitted_at)}</MetadataRow>}
                {a.status === 'info_requested' && <Notice tone="warning">Kurum senden ek bilgi istiyor. Yakında buradan yanıtlayabileceksin; şimdilik kurumun sana ulaşmasını bekle.</Notice>}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <TextButton label="Çağrıyı gör" iconRight="arrow" onPress={() => navigation.navigate('OpportunityDetail', { opportunityId: a.opportunity.id })} />
                  {OPEN.includes(a.status) && <TextButton label="Geri çek" color="#B8323D" onPress={() => setTarget(a.id)} />}
                </View>
              </Card>))}</ResponsiveGrid>}
      <Modal visible={!!target} title="Başvurunu geri çekelim mi?" onClose={() => setTarget(null)}>
        <Text variant="bodySmall" color="textSecondary">Kurum başvurunu artık değerlendirmez. Başvurular açıkken yeniden başvurabilirsin.</Text>
        {withdraw.error && <Notice tone="danger">{toAppError(withdraw.error).message}</Notice>}
        <Button kind="danger" label="Evet, geri çek" loading={withdraw.isPending} onPress={() => target && withdraw.mutate(target)} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setTarget(null)} />
      </Modal>
    </Screen>
  );
}
