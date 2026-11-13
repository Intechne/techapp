import { REPORT_DETAILS_MAX, REPORT_REASONS, REPORT_TARGETS, submitReport } from '../api';

// Faz 3b Task 14: the write goes through the existing reports_insert_own policy; the unique index on an open report is the
// only "already reported" signal, and the app turns its SQLSTATE into its own sentence.
let mockInserted: Record<string, unknown> | null = null;
let mockResult: { error: unknown } = { error: null };
let mockSession: { user: { id: string } } | null = { user: { id: 'u1' } };
jest.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: mockSession } }) },
    from: (table: string) => ({ insert: (row: Record<string, unknown>) => { if (table === 'reports') mockInserted = row; return Promise.resolve(mockResult); } }),
  }),
}));
beforeEach(() => { mockInserted = null; mockResult = { error: null }; mockSession = { user: { id: 'u1' } }; });

describe('submitReport', () => {
  it('files the signed-in person\'s own report with exactly the columns the policy accepts', async () => {
    await submitReport({ targetType: 'team_project', targetId: 'p1', reason: 'privacy', details: '  Küçük yaştaki bir kişinin adı yazılmış.  ' });
    expect(mockInserted).toEqual({ reporter_id: 'u1', target_type: 'team_project', target_id: 'p1', reason: 'privacy', details: 'Küçük yaştaki bir kişinin adı yazılmış.' });
  });
  it('no details: null, never an empty string; details are cut to the server limit', async () => {
    await submitReport({ targetType: 'event', targetId: 'e1', reason: 'spam', details: '   ' });
    expect(mockInserted).toMatchObject({ details: null });
    await submitReport({ targetType: 'event', targetId: 'e1', reason: 'spam', details: 'x'.repeat(REPORT_DETAILS_MAX + 50) });
    expect((mockInserted!.details as string).length).toBe(REPORT_DETAILS_MAX);
  });
  it('a second open report is the app\'s own already_reported sentence, not a generic conflict', async () => {
    mockResult = { error: { code: '23505', message: 'duplicate key value violates unique constraint "reports_one_open"' } };
    await expect(submitReport({ targetType: 'team', targetId: 't1', reason: 'spam' })).rejects.toMatchObject({
      code: 'already_reported', status: 409, retryable: false, message: expect.stringContaining('zaten bildirdin'),
    });
  });
  it('a guest never reaches the table', async () => {
    mockSession = null;
    await expect(submitReport({ targetType: 'team', targetId: 't1', reason: 'spam' })).rejects.toMatchObject({ code: 'auth_required' });
    expect(mockInserted).toBeNull();
  });
  it('other failures keep the shared contract (offline → network_unreachable)', async () => {
    mockResult = { error: { message: 'Failed to fetch' } };
    await expect(submitReport({ targetType: 'team', targetId: 't1', reason: 'spam' })).rejects.toMatchObject({ code: 'network_unreachable', retryable: true });
  });
  it('offers exactly the server\'s reasons and the six kinds of content the app can report', () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(['inappropriate', 'misleading', 'spam', 'safety', 'harassment', 'privacy', 'other']);
    expect(REPORT_TARGETS).toEqual(expect.arrayContaining(['event', 'opportunity', 'team', 'organization', 'recruitment_post', 'team_project']));
  });
});
