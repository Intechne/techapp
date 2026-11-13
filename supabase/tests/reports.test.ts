// Faz 3b Task 14 — "Bildir". The app files reports through the existing policies (no RPC): the reporter writes their own
// row, reads only their own, and a second OPEN report on the same target by the same person hits the partial unique index
// (the app turns SQLSTATE 23505 into `already_reported`). Platform admins read and update (no console yet: Faz 6 prerequisite).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createUser } from './helpers';

const TARGETS = ['event', 'opportunity', 'team', 'organization', 'profile', 'experience', 'recruitment_post', 'course', 'team_project'] as const;
const REASONS = ['inappropriate', 'misleading', 'spam', 'safety', 'harassment', 'privacy', 'other'] as const;

const file = (uid: string, type: string, target: string, reason = 'spam', details: string | null = null) =>
  asUser(uid, (q) => q(`insert into public.reports (reporter_id, target_type, target_id, reason, details) values ($1, $2, $3, $4, $5) returning id`, [uid, type, target, reason, details]))
    .then((r) => r.rows[0].id as string);
const mine = (uid: string) => asUser(uid, (q) => q(`select id, reporter_id from public.reports`)).then((r) => r.rows as { id: string; reporter_id: string }[]);

describe('reports', () => {
  it('every target type and every reason the app can send is accepted', async () => {
    const u = await createUser();
    for (const type of TARGETS) await expect(file(u, type, randomUUID(), 'other')).resolves.toBeTruthy();
    const t = randomUUID();
    for (const reason of REASONS) await expect(file(await createUser(), 'team', t, reason)).resolves.toBeTruthy();
    await expect(file(u, 'team', randomUUID(), 'not_a_reason')).rejects.toMatchObject({ code: '23514' });
    await expect(file(u, 'comment', randomUUID())).rejects.toMatchObject({ code: '23514' });
  });

  it('the reporter reads their own report and nobody else\'s', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const target = randomUUID();
    const ra = await file(a, 'event', target, 'misleading', 'Tarih yanlış');
    const rb = await file(b, 'event', target, 'spam');
    expect((await mine(a)).map((r) => r.id)).toEqual([ra]);
    expect((await mine(b)).map((r) => r.id)).toEqual([rb]);
    expect((await asUser(a, (q) => q(`select id from public.reports where id = $1`, [rb]))).rowCount).toBe(0);
  });

  it('a second open report on the same target by the same person is refused by the unique index; another person, another target, or a closed one is fine', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const target = randomUUID();
    const first = await file(a, 'team', target);
    await expect(file(a, 'team', target, 'safety')).rejects.toMatchObject({ code: '23505' });
    await expect(file(b, 'team', target)).resolves.toBeTruthy();
    await expect(file(a, 'team', randomUUID())).resolves.toBeTruthy();
    await admin(`update public.reports set status = 'resolved' where id = $1`, [first]);
    await expect(file(a, 'team', target)).resolves.toBeTruthy();
  });

  it('a person cannot file as someone else, cannot pre-resolve a report, and details are capped at 1000', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const t = randomUUID();
    await expect(asUser(a, (q) => q(`insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'team', $2, 'spam')`, [b, t]))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(a, (q) => q(`insert into public.reports (reporter_id, target_type, target_id, reason, status) values ($1, 'team', $2, 'spam', 'resolved')`, [a, t]))).rejects.toMatchObject({ code: '42501' });
    await expect(file(a, 'team', t, 'spam', 'x'.repeat(1001))).rejects.toMatchObject({ code: '23514' });
    await expect(file(a, 'team', t, 'spam', 'x'.repeat(1000))).resolves.toBeTruthy();
  });

  it('a reporter cannot edit or delete a report, and an anonymous caller can neither file nor read', async () => {
    const a = await createUser();
    const id = await file(a, 'event', randomUUID());
    expect((await asUser(a, (q) => q(`update public.reports set status = 'dismissed' where id = $1`, [id]))).rowCount).toBe(0);
    expect((await asUser(a, (q) => q(`delete from public.reports where id = $1`, [id]).catch(() => ({ rowCount: 0 })))).rowCount).toBe(0);
    expect((await admin(`select status from public.reports where id = $1`, [id])).rows[0].status).toBe('open');
    await expect(asAnon((q) => q(`insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'event', $2, 'spam')`, [a, randomUUID()]))).rejects.toMatchObject({ code: '42501' });
    expect((await asAnon((q) => q(`select id from public.reports`).catch(() => ({ rowCount: 0 })))).rowCount).toBe(0);
  });
});
