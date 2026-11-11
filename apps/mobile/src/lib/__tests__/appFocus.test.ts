import { AppState } from 'react-native';
import { QueryClient, QueryObserver, focusManager } from '@tanstack/react-query';
import { setupAppFocus } from '../appFocus';

describe('setupAppFocus', () => {
  it('toggles focusManager with AppState and refetches stale queries on foreground', async () => {
    let handler: ((s: string) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => { handler = h; return { remove }; }) as never);
    const dispose = setupAppFocus();
    const qc = new QueryClient();
    qc.mount();
    const fn = jest.fn().mockResolvedValue('x');
    await qc.fetchQuery({ queryKey: ['a'], queryFn: fn, staleTime: 0 });
    const observer = new QueryObserver(qc, { queryKey: ['a'], queryFn: fn, staleTime: 0 });
    const stop = observer.subscribe(() => undefined);
    await Promise.resolve();
    const before = fn.mock.calls.length;
    handler!('background');
    expect(focusManager.isFocused()).toBe(false);
    handler!('active');
    expect(focusManager.isFocused()).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(fn.mock.calls.length).toBeGreaterThan(before);
    stop(); dispose(); qc.unmount(); qc.clear();
  });
});
