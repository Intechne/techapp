import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, ErrorState, LoadingSkeleton, Screen } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { eventKeys } from './api';
import { fetchCardWithOfflineFallback } from './offlineCard';
import { ParticipationCardView } from './ParticipationCardView';

/** The QR is an opaque server-signed token (registration id + HMAC). It carries no personal data and is verified on the server. */
export function ParticipationCardScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'ParticipationCard'>) {
  const { registrationId } = route.params;
  const { userId } = useSession();
  const card = useQuery({ queryKey: eventKeys.card(registrationId), queryFn: () => fetchCardWithOfflineFallback(userId, registrationId), staleTime: 0 });

  if (card.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (card.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(card.error)} onRetry={() => void card.refetch()} /></Screen>;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Katılım kartı" />} refreshing={card.isRefetching} onRefresh={() => void card.refetch()}>
      <ParticipationCardView card={card.data.card} cachedAt={card.data.cachedAt} />
    </Screen>
  );
}
