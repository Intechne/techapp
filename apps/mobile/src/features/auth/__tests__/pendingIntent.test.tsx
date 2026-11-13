import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { PendingIntentProvider, usePendingIntent } from '../pendingIntent';

const wrapper = ({ children }: { children: React.ReactNode }) => <PendingIntentProvider>{children}</PendingIntentProvider>;

describe('PendingIntent.consume with a matcher', () => {
  it('leaves an intent the caller does not own, and hands it to the one that does', async () => {
    const { result } = await renderHook(() => usePendingIntent(), { wrapper });
    result.current.set({ type: 'bookmark', targetType: 'team', targetId: 't1' });
    expect(result.current.consume('bookmark', (i) => i.targetType === 'event')).toBeNull();
    expect(result.current.consume('bookmark', (i) => i.targetType === 'team')).toEqual({ type: 'bookmark', targetType: 'team', targetId: 't1' });
    expect(result.current.consume('bookmark')).toBeNull(); // taken once
  });
  it('without a matcher it behaves as before', async () => {
    const { result } = await renderHook(() => usePendingIntent(), { wrapper });
    result.current.set({ type: 'register_event', eventId: 'e1' });
    expect(result.current.consume('apply_opportunity')).toBeNull();
    expect(result.current.consume('register_event')).toEqual({ type: 'register_event', eventId: 'e1' });
  });
});
