import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, EmptyState, ErrorState, LoadingSkeleton, Modal, Notice, ResponsiveGrid, RowCard, Screen, Text, TextButton, applicationStatusView, colors, space, useToast, type RowLines } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { OpportunitiesStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchMyApplications, opportunityKeys, withdrawApplication } from './api';
import { OPPORTUNITY_TYPE } from './labels';

/** An application row: two-line title, type · organisation, "Gönderildi" date, status under the text on phones. */
export const MY_APPLICATION_ROW_LINES: RowLines = { title: 2, secondary: 1, footnote: 'text', status: true };
const OPEN = ['submitted', 'in_review', 'info_requested'];

export function MyApplicationsScreen({ navigation }: NativeStackScreenProps<OpportunitiesStackParamList, 'MyApplications'>) {
  const { userId } = useSession(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: opportunityKeys.myApplications(userId), queryFn: () => fetchMyApplications(userId!), enabled: !!userId });
  const [target, setTarget] = useState<string | null>(null);
  const withdraw = useMutation({ mutationFn: withdrawApplication, onSuccess: async () => { setTarget(null); await qc.invalidateQueries({ queryKey: ['applications'] }); toast.show('Başvurun geri çekildi.'); } });

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Başvurularım" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Text variant="title" style={{ marginBottom: space[4] }}>Attığın adımlar.</Text>
      {!userId ? <EmptyState icon="opportunity" title="Başvuruların burada görünecek" body="Bir çağrıya başvurduğunda durumunu buradan takip edersin." />
        : q.isPending ? <LoadingSkeleton variant="row" rowLines={MY_APPLICATION_ROW_LINES} /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
          : q.data.length === 0 ? <EmptyState icon="opportunity" title="Henüz bir başvurun yok" body="Sana uyan bir çağrı bul, ilk adımı at." actionLabel="Çağrılara göz at" onAction={() => navigation.navigate('OpportunitiesHome')} />
            : <ResponsiveGrid>{q.data.map((a) => (
              <View key={a.id} style={{ gap: space[2] }}>
                <RowCard leading={{ kind: 'icon', icon: OPPORTUNITY_TYPE[a.opportunity.type].icon }} title={a.opportunity.title}
                  secondary={[OPPORTUNITY_TYPE[a.opportunity.type].label, a.opportunity.organization?.name].filter(Boolean).join(' · ')}
                  footnote={a.submitted_at ? `Gönderildi: ${formatDate(a.submitted_at)}` : undefined}
                  trailing={{ kind: 'status', view: applicationStatusView[a.status] }}
                  onPress={() => navigation.navigate('OpportunityDetail', { opportunityId: a.opportunity.id })} />
                {a.status === 'info_requested' && <Notice tone="warning">Kurum senden ek bilgi istiyor. Yakında buradan yanıtlayabileceksin; şimdilik kurumun sana ulaşmasını bekle.</Notice>}
                {OPEN.includes(a.status) && <View style={{ alignItems: 'flex-end' }}><TextButton label="Geri çek" color={colors.danger} onPress={() => setTarget(a.id)} /></View>}
              </View>))}</ResponsiveGrid>}
      <Modal visible={!!target} title="Başvurunu geri çekelim mi?" onClose={() => setTarget(null)}>
        <Text variant="bodySmall" color="textSecondary">Kurum başvurunu artık değerlendirmez. Başvurular açıkken yeniden başvurabilirsin.</Text>
        {withdraw.error && <Notice tone="danger">{toAppError(withdraw.error).message}</Notice>}
        <Button kind="danger" label="Evet, geri çek" loading={withdraw.isPending} onPress={() => target && withdraw.mutate(target)} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setTarget(null)} />
      </Modal>
    </Screen>
  );
}
