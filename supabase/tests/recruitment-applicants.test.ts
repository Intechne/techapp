// Faz 3b Task 7 fix round 1 — managers see who applied (name + minor flag, never ids); recruitment_posts.created_by is server-set.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createUser, expectFail, pool } from './helpers';

const addMember = (team: string, uid: string, role: string) =>
  admin(`insert into public.team_memberships (team_id, user_id, role, status) values ($1, $2, $3, 'active')`, [team, uid, role]);
async function setBirthDate(uid: string, date: string | null) {
  const c = await pool.connect();
  try {
    await c.query('begin'); await c.query(`select set_config('app.allow_birth_date_write', 'on', true)`);
    await c.query(`update public.profile_private set birth_date = $2 where user_id = $1`, [uid, date]); await c.query('commit');
  } finally { c.release(); }
}
async function fixture() {
  const captain = await createUser({ age: 30, name: 'Kaptan Ayşe' });
  const team = (await asUser(captain, (q) => q(`select * from public.create_team($1)`, [`Başvuru ${randomUUID().slice(0, 6)}`]))).rows[0];
  const mentor = await createUser({ age: 28, name: 'Mentor Can' }); await addMember(team.id, mentor, 'mentor');
  const member = await createUser({ age: 21, name: 'Düz Üye' }); await addMember(team.id, member, 'member');
  const post = (await asUser(captain, (q) => q(`insert into public.recruitment_posts (team_id, title) values ($1, 'Mekanik ekibi') returning id`, [team.id]))).rows[0];
  const adult = await createUser({ age: 22, name: 'Yetişkin Başvuran' });
  const minor = await createUser({ age: 16, name: 'Genç Başvuran' });
  const noBirth = await createUser({ age: 25, name: 'Doğum Tarihsiz Başvuran' }); 
  for (const [u, m] of [[adult, 'Atölyeye gelirim'], [minor, null], [noBirth, 'Not var']] as const) {
    await asUser(u, (q) => q(`select public.apply_to_recruitment($1, $2)`, [post.id, m]));
  }
  await setBirthDate(noBirth, null); // apply_to_recruitment needs a birth date; it can vanish afterwards (support correction)
  const otherCaptain = await createUser({ age: 40, name: 'Başka Kaptan' });
  await asUser(otherCaptain, (q) => q(`select * from public.create_team($1)`, [`Dış ${randomUUID().slice(0, 6)}`]));
  const outsider = await createUser({ age: 20 });
  return { captain, mentor, member, post: post.id as string, team: team.id as string, adult, minor, noBirth, otherCaptain, outsider };
}
const list = (uid: string, post: string) => asUser(uid, (q) => q(`select * from public.team_recruitment_applications($1)`, [post]));

describe('team_recruitment_applications', () => {
  it('a captain and a mentor see names, notes, status and is_minor (16-year-old and missing birth date are minors)', async () => {
    const f = await fixture();
    for (const who of [f.captain, f.mentor]) {
      const rows = (await list(who, f.post)).rows;
      const by = Object.fromEntries(rows.map((r) => [r.display_name, r]));
      expect(Object.keys(by).sort()).toEqual(['Doğum Tarihsiz Başvuran', 'Genç Başvuran', 'Yetişkin Başvuran']);
      expect(by['Yetişkin Başvuran']).toMatchObject({ is_minor: false, message: 'Atölyeye gelirim', status: 'submitted' });
      expect(by['Genç Başvuran'].is_minor).toBe(true);
      expect(by['Doğum Tarihsiz Başvuran'].is_minor).toBe(true);
    }
  });
  it('never returns a user id, birth date or e-mail', async () => {
    const f = await fixture();
    const res = await list(f.captain, f.post);
    expect(res.fields.map((x) => x.name)).toEqual(['application_id', 'display_name', 'is_minor', 'message', 'status', 'created_at']);
    const text = JSON.stringify(res.rows);
    for (const id of [f.adult, f.minor, f.noBirth, f.captain]) expect(text).not.toContain(id);
    expect(text).not.toMatch(/@|birth/);
  });
  it('a plain member, an outsider, another team’s captain, an unknown post → 403; anon has no access', async () => {
    const f = await fixture();
    for (const who of [f.member, f.outsider, f.otherCaptain, f.adult]) await expectFail(list(who, f.post), 403, 'team_manage_forbidden');
    await expectFail(list(f.captain, randomUUID()), 403, 'team_manage_forbidden');
    await expect(asAnon((q) => q(`select * from public.team_recruitment_applications($1)`, [f.post]))).rejects.toMatchObject({ code: '42501' });
  });
  it('a former mentor (left) loses access', async () => {
    const f = await fixture();
    await admin(`update public.team_memberships set status = 'left' where team_id = $1 and user_id = $2`, [f.team, f.mentor]);
    await expectFail(list(f.mentor, f.post), 403, 'team_manage_forbidden');
  });
});

describe('recruitment_posts.created_by', () => {
  it('a manager inserting with another uid gets their own uid stored', async () => {
    const f = await fixture();
    const id = (await asUser(f.mentor, (q) => q(`insert into public.recruitment_posts (team_id, title, created_by) values ($1, 'Sahte', $2) returning id`, [f.team, f.otherCaptain]))).rows[0].id;
    expect((await admin(`select created_by from public.recruitment_posts where id = $1`, [id])).rows[0].created_by).toBe(f.mentor);
  });
  it('an update cannot change it', async () => {
    const f = await fixture();
    await asUser(f.captain, (q) => q(`update public.recruitment_posts set created_by = $2, title = 'Yeni başlık' where id = $1`, [f.post, f.otherCaptain]));
    const row = (await admin(`select created_by, title from public.recruitment_posts where id = $1`, [f.post])).rows[0];
    expect(row).toEqual({ created_by: f.captain, title: 'Yeni başlık' });
  });
  it('the service role / migrations (no auth.uid) keep a given value, and deleting the creator still clears it', async () => {
    const f = await fixture();
    const id = (await admin(`insert into public.recruitment_posts (team_id, title, created_by) values ($1, 'Servis', $2) returning id`, [f.team, f.otherCaptain])).rows[0].id;
    expect((await admin(`select created_by from public.recruitment_posts where id = $1`, [id])).rows[0].created_by).toBe(f.otherCaptain);
    await admin(`delete from auth.users where id = $1`, [f.otherCaptain]);
    expect((await admin(`select created_by from public.recruitment_posts where id = $1`, [id])).rows[0].created_by).toBeNull();
  });
});
