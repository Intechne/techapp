import { saveRecruitmentPost, setRecruitmentPostOpen } from '../api';

// The write path of a recruitment post: RLS decides who may write, column grants decide what may be read back.
const calls: { method: string; args: unknown[] }[] = [];
let result: { data: unknown; error: unknown } = { data: { id: 'p1' }, error: null };
function mockBuilder() {
  const b: Record<string, unknown> = {};
  for (const m of ['insert', 'update', 'delete', 'select', 'eq']) b[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return b; };
  b.single = () => Promise.resolve(result);
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: () => mockBuilder() }) }));
beforeEach(() => { calls.length = 0; result = { data: { id: 'p1' }, error: null }; });

const input = { title: ' Yazılım ekibi ', roleLabel: '', description: '', skills: ['Python'], closesAt: null };

describe('recruitment post writes', () => {
  it('create: sends team_id and the fields only (never created_by) and reads back just the id', async () => {
    expect(await saveRecruitmentPost('t1', undefined, input)).toBe('p1');
    const insert = calls.find((c) => c.method === 'insert')!;
    expect(Object.keys(insert.args[0] as object).sort()).toEqual(['closes_at', 'description', 'role_label', 'skills', 'team_id', 'title']);
    expect(insert.args[0]).toMatchObject({ title: 'Yazılım ekibi', role_label: null, description: null });
    expect(calls.find((c) => c.method === 'select')!.args).toEqual(['id']);
  });
  it('update: never carries team_id or created_by, reads back just the id', async () => {
    await saveRecruitmentPost('t1', 'p1', input);
    const update = calls.find((c) => c.method === 'update')!;
    expect(Object.keys(update.args[0] as object)).not.toEqual(expect.arrayContaining(['created_by']));
    expect(update.args[0]).not.toHaveProperty('team_id');
    expect(calls.find((c) => c.method === 'select')!.args).toEqual(['id']);
  });
  it('closing a post that RLS filtered out (not a manager) is a forbidden error, not a silent success', async () => {
    result = { data: [], error: null };
    await expect(setRecruitmentPostOpen('p1', false)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
