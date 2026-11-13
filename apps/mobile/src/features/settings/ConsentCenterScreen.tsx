import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Notice, ResponsiveGrid, Screen, StatusBadge, Text, consentStatusView, space } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchConsents, settingsKeys } from './api';
import { consentAction, consentGrantedByLabel, consentPurposeLabel, type ConsentRow } from './labels';

/**
 * Ayarlar > Rıza merkezi. Shows only what the database holds: purpose, policy version, who gave it, when, and when it was
 * withdrawn. Nothing is undone here: the action opens the screen that already runs the right RPC (cancel registration /
 * withdraw application), which also withdraws the consent on the server.
 */
export function ConsentCenterScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'ConsentCenter'>) {
  const { userId } = useSession();
  const q = useQuery({ queryKey: settingsKeys.consents(userId), queryFn: () => fetchConsents(userId!), enabled: !!userId, staleTime: 0 });
  const tabs = (navigation as unknown as { getParent: () => { navigate: (...a: unknown[]) => void } | undefined }).getParent();

  const act = (c: ConsentRow) => {
    const a = consentAction(c);
    if (a.kind === 'cancel_registration') navigation.navigate('RegistrationStatus', { registrationId: a.target });
    else if (a.kind === 'withdraw_application') tabs?.navigate('OpportunitiesTab', { screen: 'MyApplications' });
  };

  const rows = q.data ?? [];
  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Rıza merkezi" />} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {q.isPending ? <LoadingSkeleton cards={2} variant="row" /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
        : rows.length === 0 ? <EmptyState icon="verified" title="Henüz kayıtlı bir iznin yok." body="Bir etkinliğe kayıt olduğunda ya da bir fırsata başvurduğunda verdiğin izin burada görünür." />
          : (
            <View style={{ gap: space[4] }}>
              <Notice tone="info">Kaydı iptal ettiğinde ya da başvuruyu geri çektiğinde ilgili izin de geri çekilmiş olur. Geri çekilen izinler tarihiyle burada kalır.</Notice>
              <ResponsiveGrid>
                {rows.map((c) => {
                  const action = consentAction(c);
                  const withdrawn = !!c.withdrawn_at;
                  return (
                    <Card key={c.id} testID="consent-card" style={{ gap: space[2] }}>
                      <View style={{ alignItems: 'flex-start' }}><StatusBadge view={withdrawn ? consentStatusView.withdrawn : consentStatusView.active} /></View>
                      <Text variant="cardTitle" breakStrategy="words">{consentPurposeLabel(c.purpose)}</Text>
                      <MetadataRow icon="shield">{`Veren: ${consentGrantedByLabel(c.granted_by)}`}</MetadataRow>
                      <MetadataRow icon="calendar">{`Verildiği tarih: ${formatDate(c.granted_at)}`}</MetadataRow>
                      {c.withdrawn_at && <MetadataRow icon="clock">{`Geri çekildiği tarih: ${formatDate(c.withdrawn_at)}`}</MetadataRow>}
                      <Text variant="caption" color="textSecondary" selectable breakStrategy="words">{`Sürüm: ${c.policy_version}`}</Text>
                      {action.kind !== 'none' && (
                        <View style={{ marginTop: space[2] }}>
                          <Button kind="secondary" label={action.kind === 'cancel_registration' ? 'Kaydı iptal et' : 'Başvuruyu geri çek'} onPress={() => act(c)} />
                        </View>
                      )}
                    </Card>
                  );
                })}
              </ResponsiveGrid>
            </View>
          )}
    </Screen>
  );
}
