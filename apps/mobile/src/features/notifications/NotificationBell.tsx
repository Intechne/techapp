import React from 'react';
import { IconButton } from '../../design-system';
import { useSession } from '../auth/SessionProvider';
import { useUnreadCount } from './api';

/** `0 → ''`, `1–99 → 'n'`, `≥100 → '99+'` (the pill never grows past three characters). */
export function formatBadge(n: number): string {
  const whole = Math.floor(n);
  if (!(whole > 0)) return '';
  return whole >= 100 ? '99+' : String(whole);
}

/** Header bell with the unread pill. Signed-in people only: a guest has no notifications, so nothing is rendered. */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { userId } = useSession();
  if (!userId) return null;
  return <Bell onPress={onPress} />;
}

function Bell({ onPress }: { onPress: () => void }) {
  const unread = useUnreadCount();
  return (
    <IconButton icon="bell" badge={formatBadge(unread)} onPress={onPress}
      accessibilityLabel={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'} />
  );
}
