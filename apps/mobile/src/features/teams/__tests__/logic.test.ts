import { canAdvanceTask, groupTasks, onlyMine, isOverdue, isoToDisplayDate, nextStatus, parseDueDate, permissionsFor, type TaskLike } from '../logic';

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
