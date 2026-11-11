import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * React Native has no window focus: map AppState (active ↔ focused) so stale queries refetch when the app returns
 * to the foreground (e.g. guardian approval done on another device). onlineManager is deliberately NOT wired:
 * the offline card fallback relies on fetches erroring, not pausing.
 */
export function setupAppFocus(): () => void {
  if (Platform.OS === 'web') return () => undefined; // browsers already have visibilitychange
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => handleFocus(state === 'active'));
    return () => sub.remove();
  });
  return () => focusManager.setEventListener((handleFocus) => {
    const onVisibility = () => handleFocus();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    return () => { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility); };
  });
}
