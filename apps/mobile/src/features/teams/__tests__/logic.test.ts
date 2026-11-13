import { canAdvanceTask, groupTasks, onlyMine, isOverdue, isoToDisplayDate, nextStatus, parseDueDate, permissionsFor, validatePost, validateProject, type TaskLike } from '../logic';

const today = new Date(2026, 8, 19);
const task = (o: Partial<TaskLike>): TaskLike => ({ id: 'x', status: 'todo', due_date: null, assignee_id: null, created_at: '2026-09-01T00:00:00Z', completed_at: null, ...o });

describe('teams logic', () => {
  it('same due date: higher priority leads; priority never beats an earlier due date', () => {
    const g = groupTasks([task({ id: 'low', due_date: '2026-09-20', priority: 'low' }), task({ id: 'high', due_date: '2026-09-20', priority: 'high' }),
      task({ id: 'plain', due_date: '2026-09-20' }), task({ id: 'early-low', due_date: '2026-09-10', priority: 'low' }), task({ id: 'undated-high', priority: 'high' })]);
    expect(g.todo.map((t) => t.id)).toEqual(['early-low', 'high', 'plain', 'low', 'undated-high']);
  });

  it('"bana atananlar" keeps only my tasks and is empty for a guest', () => {
    const tasks = [task({ id: 'a', assignee_id: 'me' }), task({ id: 'b', assignee_id: 'other' }), task({ id: 'c' })];
    expect(onlyMine(tasks, 'me').map((t) => t.id)).toEqual(['a']);
    expect(onlyMine(tasks, null)).toEqual([]);
  });

  it('overdue: only open tasks with a due date before today', () => {
    expect(isOverdue(task({ due_date: '2026-09-18' }), today)).toBe(true);
    expect(isOverdue(task({ due_date: '2026-09-19' }), today)).toBe(false);
    expect(isOverdue(task({ due_date: '2026-09-01', status: 'done' }), today)).toBe(false);
    expect(isOverdue(task({}), today)).toBe(false);
  });

  it('groups by status; open tasks by due date (undated last), done by completion (latest first)', () => {
    const g = groupTasks([
      task({ id: 'a', due_date: null }), task({ id: 'b', due_date: '2026-10-01' }), task({ id: 'c', due_date: '2026-09-25' }),
      task({ id: 'd', status: 'doing' }), task({ id: 'e', status: 'done', completed_at: '2026-09-10T00:00:00Z' }), task({ id: 'f', status: 'done', completed_at: '2026-09-15T00:00:00Z' }),
    ]);
    expect(g.todo.map((t) => t.id)).toEqual(['c', 'b', 'a']);
    expect(g.doing.map((t) => t.id)).toEqual(['d']);
    expect(g.done.map((t) => t.id)).toEqual(['f', 'e']);
  });

  it('status advances todo → doing → done and stops', () => {
    expect([nextStatus('todo'), nextStatus('doing'), nextStatus('done')]).toEqual(['doing', 'done', null]);
  });

  it('permissions come only from an ACTIVE server membership', () => {
    expect(permissionsFor(null)).toEqual({ isMember: false, canManage: false, isCaptain: false });
    expect(permissionsFor({ role: 'captain', status: 'pending' })).toEqual({ isMember: false, canManage: false, isCaptain: false });
    expect(permissionsFor({ role: 'captain', status: 'removed' }).isCaptain).toBe(false);
    expect(permissionsFor({ role: 'mentor', status: 'active' })).toEqual({ isMember: true, canManage: true, isCaptain: false });
    expect(permissionsFor({ role: 'member', status: 'active' })).toEqual({ isMember: true, canManage: false, isCaptain: false });
  });

  it('a member advances only their own task; managers any; nobody a finished one', () => {
    const member = permissionsFor({ role: 'member', status: 'active' }); const mentor = permissionsFor({ role: 'mentor', status: 'active' });
    expect(canAdvanceTask(task({ assignee_id: 'me' }), 'me', member)).toBe(true);
    expect(canAdvanceTask(task({ assignee_id: 'other' }), 'me', member)).toBe(false);
    expect(canAdvanceTask(task({ assignee_id: null }), 'me', member)).toBe(false);
    expect(canAdvanceTask(task({ assignee_id: 'other' }), 'me', mentor)).toBe(true);
    expect(canAdvanceTask(task({ assignee_id: 'me', status: 'done' }), 'me', mentor)).toBe(false);
    expect(canAdvanceTask(task({ assignee_id: 'me' }), 'me', permissionsFor(null))).toBe(false);
  });

  it('due date conversion is strict and optional', () => {
    expect(parseDueDate('')).toEqual({ ok: true, iso: null });
    expect(parseDueDate('05.11.2026')).toEqual({ ok: true, iso: '2026-11-05' });
    expect(parseDueDate('31.02.2026').ok).toBe(false);
    expect(parseDueDate('5.11.2026').ok).toBe(false);
    expect(parseDueDate('01.01.1999').ok).toBe(false);
    expect(isoToDisplayDate('2026-11-05')).toBe('05.11.2026');
    expect(isoToDisplayDate(null)).toBe('');
  });
});

describe('project form (mirrors the CHECKs of team_projects)', () => {
  const ok = { title: 'Otonom Şasi v2', summary: '', year: '', url: '' };
  it('accepts a title with nothing else; trims; year and url are optional', () => {
    expect(validateProject({ ...ok, title: '  Şasi  ' })).toEqual({ ok: true, value: { title: 'Şasi', summary: '', year: null, url: '' } });
  });
  it('title 3–120 after trimming', () => {
    expect(validateProject({ ...ok, title: ' ab ' })).toMatchObject({ ok: false, errors: { title: expect.any(String) } });
    expect(validateProject({ ...ok, title: 'a'.repeat(121) }).ok).toBe(false);
    expect(validateProject({ ...ok, title: 'a'.repeat(120) }).ok).toBe(true);
  });
  it('summary ≤ 600', () => {
    expect(validateProject({ ...ok, summary: 'x'.repeat(601) })).toMatchObject({ ok: false, errors: { summary: expect.any(String) } });
    expect(validateProject({ ...ok, summary: 'x'.repeat(600) }).ok).toBe(true);
  });
  it('year 2000–2100, whole number', () => {
    expect(validateProject({ ...ok, year: '2026' })).toMatchObject({ ok: true, value: { year: 2026 } });
    for (const year of ['1999', '2101', '20.5', 'abc', '2026a']) expect(validateProject({ ...ok, year })).toMatchObject({ ok: false, errors: { year: expect.any(String) } });
  });
  it('url: https only, a host, no whitespace, ≤ 500', () => {
    expect(validateProject({ ...ok, url: 'https://takim.example/proje?id=1#a' }).ok).toBe(true);
    for (const url of ['http://takim.example', 'javascript:alert(1)', 'https://', 'https://a b.example', 'HTTPS://takim.example', 'takim.example', `https://a.example/${'x'.repeat(500)}`]) {
      expect([url, validateProject({ ...ok, url }).ok]).toEqual([url, false]);
    }
  });
});

describe('recruitment post form (mirrors recruitment_posts CHECKs)', () => {
  const ok = { title: 'Mekanik ekibine katıl', roleLabel: '', description: '', skills: '', closesAt: '' };
  it('title 3–120, role label ≤ 60, description ≤ 2000, skills ≤ 12 (comma separated, trimmed, empties dropped)', () => {
    expect(validatePost({ ...ok, skills: ' CAD, ,Şasi ,' })).toMatchObject({ ok: true, value: { skills: ['CAD', 'Şasi'], closesAt: null } });
    expect(validatePost({ ...ok, title: 'ab' }).ok).toBe(false);
    expect(validatePost({ ...ok, roleLabel: 'x'.repeat(61) }).ok).toBe(false);
    expect(validatePost({ ...ok, description: 'x'.repeat(2001) }).ok).toBe(false);
    expect(validatePost({ ...ok, skills: Array.from({ length: 13 }, (_, i) => `s${i}`).join(',') })).toMatchObject({ ok: false, errors: { skills: expect.any(String) } });
  });
  it('closing date is a real GG.AA.YYYY date or empty, and becomes the end of that day', () => {
    expect(validatePost({ ...ok, closesAt: '31.02.2027' }).ok).toBe(false);
    const r = validatePost({ ...ok, closesAt: '05.12.2027' });
    expect(r.ok && r.value.closesAt).toMatch(/^2027-12-05T/);
  });
});
