import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MY_REGISTRATION_ROW_LINES, MyRegistrationsScreen } from '../MyRegistrationsScreen';
import { fetchMyRegistrations } from '../api';

// An organiser's RLS view of event_registrations: their own rows AND their attendees' (incl. a minor's pending one).
const STAFF = 'staff-1';
const event = (id: string, title: string) => ({ id, title, starts_at: '2026-12-01T07:00:00Z', ends_at: '2026-12-01T12:00:00Z', city: 'İstanbul', venue: 'Salon', format: 'in_person', type: 'workshop', organization: { id: 'org', name: 'Org', verification: 'verified' } });
const reg = (id: string, userId: string, title: string, status = 'confirmed') => ({ id, user_id: userId, event_id: `e-${id}`, status, created_at: '2026-11-01T10:00:00Z', event: event(`e-${id}`, title) });
const RLS_ROWS = [reg('r1', STAFF, 'Organizatörün kendi katılımı'), reg('r2', 'minor-1', 'Reşit olmayanın etkinliği', 'pending_guardian'), reg('r3', 'adult-1', 'Yetişkinin etkinliği')];

const mockCalls: { method: string; args: unknown[] }[] = [];
function mockBuilder() {
  const filters: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'limit', 'overrideTypes']) b[method] = (...args: unknown[]) => { mockCalls.push({ method, args }); return b; };
  b.eq = (col: string, val: unknown) => { mockCalls.push({ method: 'eq', args: [col, val] }); filters[col] = val; return b; };
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({
    data: RLS_ROWS.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v)), error: null,
  }).then(resolve);
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: () => mockBuilder() }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: STAFF }) }));

beforeEach(() => { mockCalls.length = 0; });

describe('Katılımlarım only shows the signed-in user’s own registrations', () => {
  it('fetchMyRegistrations filters event_registrations by user_id', async () => {
    const mine = await fetchMyRegistrations(STAFF);
    expect(mockCalls).toContainEqual({ method: 'eq', args: ['user_id', STAFF] });
    expect(mine.map((r) => r.id)).toEqual(['r1']);
  });
  it('a staff user does not see another user’s registration on the screen', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
    const props = { navigation: { navigate: jest.fn(), goBack: jest.fn() }, route: { key: 'k', name: 'MyRegistrations' } } as unknown as React.ComponentProps<typeof MyRegistrationsScreen>;
    await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><MyRegistrationsScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
    expect(await screen.findByText('Organizatörün kendi katılımı')).toBeTruthy();
    expect(screen.queryByText('Reşit olmayanın etkinliği')).toBeNull();
    expect(screen.queryByText('Yetişkinin etkinliği')).toBeNull();
    // Status row (RowCard trailing status; under the text on phones, see cards.test).
    expect(screen.getByText(/^KATILIMIN.ONAYLANDI$/)).toBeTruthy();
    expect(screen.getByLabelText(/^Organizatörün kendi katılımı\. /)).toBeTruthy();
  });
  it('the loading skeleton is shaped like a status row', () => {
    expect(MY_REGISTRATION_ROW_LINES.status).toBe(true);
  });
});
