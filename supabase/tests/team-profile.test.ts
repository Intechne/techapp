// Faz 3b Task 6 — rich team profile (migration *_team_profile.sql). Review focus 5: a minor's name never leaves the team.
// public.team_public_profile() is the ONLY public reading of who leads a team: counts for everyone, names only for active
// captains/mentors who are 18+ (computed on the server from birth_date, Europe/Istanbul) AND discoverable. Projects are a new
// table with RLS (read = team visible, write = upsert/delete RPCs for active captains/mentors and platform admins).
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createUser, expectFail, pool } from './helpers';

const PERMISSION_DENIED = /permission denied/;
const MIGRATIONS = join(__dirname, '..', 'migrations');
const MINOR_CAPTAIN = 'Reşit Olmayan Kaptan';
const HIDDEN_MENTOR = 'Gizli Mentor';
const AGED_DOWN = 'Yaşı Düzeltilen Mentor';
const NO_BIRTH_DATE = 'Doğum Tarihsiz Mentor';
const LEFT_CAPTAIN = 'Ayrılan Kaptan';
const PLAIN_MEMBER = 'Açık Üye';
const MINOR_MEMBER = 'Reşit Olmayan Üye';
const SECRETS = [MINOR_CAPTAIN, HIDDEN_MENTOR, AGED_DOWN, NO_BIRTH_DATE, LEFT_CAPTAIN, PLAIN_MEMBER, MINOR_MEMBER];

const discoverable = (uid: string) => asUser(uid, (q) => q(`update public.profiles set discoverable = true where id = $1`, [uid]));
const addMember = (team: string, uid: string, role: string, status = 'active') =>
  admin(`insert into public.team_memberships (team_id, user_id, role, status) values ($1, $2, $3, $4)`, [team, uid, role, status]);
/** Fixture only: rewrite a birth date (the app never can — birth_date is write-once). */
async function setBirthDate(uid: string, date: string | null) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.allow_birth_date_write', 'on', true)`);
    await c.query(`update public.profile_private set birth_date = $2 where user_id = $1`, [uid, date]);
    await c.query('commit');
  } finally { c.release(); }
}
const profile = (who: string | null, team: string) =>
  (who ? asUser(who, (q) => q(`select public.team_public_profile($1) p`, [team])) : asAnon((q) => q(`select public.team_public_profile($1) p`, [team])))
    .then((r) => r.rows[0].p as {
      member_count: number; role_counts: Record<string, number>; leaders: { display_name: string; role: string }[];
      projects_count: number; events: unknown[];
    });

/**
 * Team founded by a 16-year-old captain. Active: minor captain, two 18+ discoverable captains (Zeynep, Ahmet), an 18+
 * discoverable mentor (Can), an 18+ NON-discoverable mentor, a mentor who was discoverable but whose birth date was corrected
 * to 16, a mentor with no birth date, an 18+ discoverable plain member and a minor member. Not active: a discoverable adult
 * captain who left, a pending applicant.
 */
async function teamWithMinorCaptain() {
  const minorCaptain = await createUser({ age: 16, name: MINOR_CAPTAIN });
  const team = (await asUser(minorCaptain, (q) => q(`select * from public.create_team($1)`, [`Profil ${randomUUID().slice(0, 6)}`]))).rows[0];
  const zeynep = await createUser({ age: 30, name: 'Zeynep Kaptan' }); await discoverable(zeynep); await addMember(team.id, zeynep, 'captain');
  const ahmet = await createUser({ age: 18, name: 'Ahmet Kaptan' }); await discoverable(ahmet); await addMember(team.id, ahmet, 'captain');
  const can = await createUser({ age: 25, name: 'Can Mentor' }); await discoverable(can); await addMember(team.id, can, 'mentor');
  const hidden = await createUser({ age: 40, name: HIDDEN_MENTOR }); await addMember(team.id, hidden, 'mentor');
  const agedDown = await createUser({ age: 19, name: AGED_DOWN }); await discoverable(agedDown); await addMember(team.id, agedDown, 'mentor');
  await setBirthDate(agedDown, new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10)); // still discoverable=true
  const noBirth = await createUser({ age: 22, name: NO_BIRTH_DATE }); await discoverable(noBirth); await addMember(team.id, noBirth, 'mentor');
  await setBirthDate(noBirth, null);
  const member = await createUser({ age: 21, name: PLAIN_MEMBER }); await discoverable(member); await addMember(team.id, member, 'member');
  const minorMember = await createUser({ age: 15, name: MINOR_MEMBER }); await addMember(team.id, minorMember, 'member');
  const left = await createUser({ age: 33, name: LEFT_CAPTAIN }); await discoverable(left); await addMember(team.id, left, 'captain', 'left');
  const pending = await createUser({ age: 20, name: 'Bekleyen Başvuru' }); await addMember(team.id, pending, 'member', 'pending');
  const outsider = await createUser({ name: 'Takım Dışı' });
  // the fixtures really are what the test relies on: the flag says yes, only the server-side age says no
  const flags = (await admin(`select p.id, p.discoverable, p.onboarded_at is not null onboarded, app.age_years(p.id) age
                               from public.profiles p where p.id = any($1)`, [[agedDown, noBirth, hidden, minorCaptain]])).rows;
  const flag = (id: string) => flags.find((r) => r.id === id);
  expect(flag(agedDown)).toMatchObject({ discoverable: true, onboarded: true });
  expect(flag(agedDown)!.age).toBeLessThan(18);
  expect(flag(noBirth)).toMatchObject({ discoverable: true, onboarded: true, age: null });
  expect(flag(hidden)).toMatchObject({ discoverable: false, onboarded: true });
  expect(flag(minorCaptain)!.age).toBe(16);
  return { teamId: team.id as string, minorCaptain, zeynep, ahmet, can, hidden, member, minorMember, outsider,
           userIds: [minorCaptain, zeynep, ahmet, can, hidden, agedDown, noBirth, member, minorMember, left, pending] };
}

async function simpleTeam() {
  const captain = await createUser({ age: 30, name: 'Proje Kaptanı' });
  const team = (await asUser(captain, (q) => q(`select * from public.create_team($1)`, [`Proje ${randomUUID().slice(0, 6)}`]))).rows[0];
  const mentor = await createUser({ age: 35 }); await addMember(team.id, mentor, 'mentor');
  const member = await createUser({ age: 17 }); await addMember(team.id, member, 'member');
  const formerMentor = await createUser({ age: 40 }); await addMember(team.id, formerMentor, 'mentor', 'left');
  const outsider = await createUser();
  return { teamId: team.id as string, captain, mentor, member, formerMentor, outsider };
}
const upsert = (uid: string, team: string, project: string | null, title: string, summary: string | null = null,
                year: number | null = 2026, url: string | null = 'https://example.org/proje') =>
  asUser(uid, (q) => q(`select * from public.upsert_team_project($1, $2, $3, $4, $5, $6)`, [team, project, title, summary, year, url]))
    .then((r) => r.rows[0] as { id: string; team_id: string; title: string; summary: string | null; year: number | null; url: string | null; cover_path: string | null });
const suspend = (team: string) => admin(`update public.teams set moderation_status = 'suspended' where id = $1`, [team]);

describe('team_public_profile · who is named outside the team', () => {
  it('names only active 18+ discoverable captains/mentors, in role then name order; never a minor, a hidden adult, or anyone else', async () => {
    const t = await teamWithMinorCaptain();
    for (const viewer of [null, t.outsider, t.member, t.minorCaptain]) {
      const p = await profile(viewer, t.teamId);
      expect(p.leaders).toEqual([
        { display_name: 'Ahmet Kaptan', role: 'captain' },
        { display_name: 'Zeynep Kaptan', role: 'captain' },
        { display_name: 'Can Mentor', role: 'mentor' },
      ]);
      const text = JSON.stringify(p);
      for (const name of SECRETS) expect([viewer, name, text.includes(name)]).toEqual([viewer, name, false]);
      for (const id of t.userIds) expect(text.includes(id)).toBe(false); // no user ids
      expect(text).not.toMatch(/birth|@|email|user_id|discoverable/);
    }
  });

  it('an 18+ discoverable captain who stops being discoverable disappears; a minor never appears even as captain', async () => {
    const t = await teamWithMinorCaptain();
    await asUser(t.zeynep, (q) => q(`update public.profiles set discoverable = false where id = $1`, [t.zeynep]));
    expect((await profile(null, t.teamId)).leaders.map((l) => l.display_name)).toEqual(['Ahmet Kaptan', 'Can Mentor']);
    // a team led only by a minor has no public leader at all
    const solo = await createUser({ age: 16, name: MINOR_CAPTAIN });
    const team = (await asUser(solo, (q) => q(`select * from public.create_team($1)`, [`Tek ${randomUUID().slice(0, 6)}`]))).rows[0];
    expect((await profile(null, team.id)).leaders).toEqual([]);
  });

  it('role_counts count ACTIVE memberships only and add up to member_count (= teams.member_count)', async () => {
    const t = await teamWithMinorCaptain();
    const p = await profile(null, t.teamId);
    expect(p.role_counts).toEqual({ captain: 3, mentor: 4, member: 2 });
    expect(p.member_count).toBe(9);
    expect(Object.values(p.role_counts).reduce((a, b) => a + b, 0)).toBe(p.member_count);
    expect((await admin(`select member_count from public.teams where id = $1`, [t.teamId])).rows[0].member_count).toBe(p.member_count);
    expect(Object.keys(p).sort()).toEqual(['events', 'leaders', 'member_count', 'projects_count', 'role_counts']);
    expect(p.events).toEqual([]); // Faz 3a (team registration) is not built yet
    expect(p.projects_count).toBe(0);
  });

  it('suspended team: 404 for anon and outsiders, still readable by its members and platform admins; unknown id → 404', async () => {
    const t = await teamWithMinorCaptain();
    const platformAdmin = await createUser(); await admin(`insert into public.platform_admins (user_id) values ($1)`, [platformAdmin]);
    await suspend(t.teamId);
    await expectFail(asAnon((q) => q(`select public.team_public_profile($1)`, [t.teamId])), 404, 'team_not_found');
    await expectFail(asUser(t.outsider, (q) => q(`select public.team_public_profile($1)`, [t.teamId])), 404, 'team_not_found');
    expect((await profile(t.member, t.teamId)).member_count).toBe(9);
    expect((await profile(platformAdmin, t.teamId)).member_count).toBe(9);
    await expectFail(asAnon((q) => q(`select public.team_public_profile($1)`, [randomUUID()])), 404, 'team_not_found');
  });
});

describe('team_projects · write path (upsert / delete RPCs)', () => {
  it('a non-member, a plain member and a former mentor cannot add a project (403); anon cannot call the RPC at all', async () => {
    const t = await simpleTeam();
    for (const uid of [t.outsider, t.member, t.formerMentor]) {
      await expectFail(upsert(uid, t.teamId, null, 'Otonom Robot'), 403, 'team_manage_forbidden');
    }
    await expect(asAnon((q) => q(`select public.upsert_team_project($1, null, 'Otonom Robot', null, 2026, null)`, [t.teamId]))).rejects.toThrow(PERMISSION_DENIED);
    await expectFail(upsert(t.outsider, randomUUID(), null, 'Otonom Robot'), 403, 'team_manage_forbidden'); // unknown team: same answer
    expect((await admin(`select count(*)::int n from public.team_projects where team_id = $1`, [t.teamId])).rows[0].n).toBe(0);
  });

  it('captain creates, mentor edits, platform admin may edit; trims input; audit rows carry ids only', async () => {
    const t = await simpleTeam();
    const platformAdmin = await createUser(); await admin(`insert into public.platform_admins (user_id) values ($1)`, [platformAdmin]);
    const created = await upsert(t.captain, t.teamId, null, '  Otonom Robot  ', '  Görüntü işleme ile şerit takibi.  ', 2025, 'https://example.org/robot');
    expect(created).toMatchObject({ team_id: t.teamId, title: 'Otonom Robot', summary: 'Görüntü işleme ile şerit takibi.', year: 2025,
                                    url: 'https://example.org/robot', cover_path: null });
    const edited = await upsert(t.mentor, t.teamId, created.id, 'Otonom Robot v2', null, null, null);
    expect(edited).toMatchObject({ id: created.id, title: 'Otonom Robot v2', summary: null, year: null, url: null });
    expect((await upsert(platformAdmin, t.teamId, created.id, 'Moderasyon başlığı')).title).toBe('Moderasyon başlığı');
    const audits = (await admin(`select action, actor_id, target_type, metadata from public.audit_events where target_id = $1 order by id`, [created.id])).rows;
    expect(audits.map((a) => a.action)).toEqual(['team.project_created', 'team.project_updated', 'team.project_updated']);
    expect(audits.map((a) => a.actor_id)).toEqual([t.captain, t.mentor, platformAdmin]);
    for (const a of audits) {
      expect(a.target_type).toBe('team_project');
      expect(a.metadata).toEqual({ team_id: t.teamId });
    }
  });

  it('a project id of another team cannot be edited through this team (404), nor moved', async () => {
    const a = await simpleTeam(); const b = await simpleTeam();
    const pb = await upsert(b.captain, b.teamId, null, 'B Takımının Projesi');
    await expectFail(upsert(a.captain, a.teamId, pb.id, 'Ele geçirildi'), 404, 'team_project_not_found');
    await expectFail(upsert(a.captain, b.teamId, pb.id, 'Ele geçirildi'), 403, 'team_manage_forbidden');
    expect((await admin(`select title, team_id from public.team_projects where id = $1`, [pb.id])).rows[0]).toEqual({ title: 'B Takımının Projesi', team_id: b.teamId });
  });

  it('validates title / summary / year / url with friendly codes; only https links', async () => {
    const t = await simpleTeam();
    await expectFail(upsert(t.captain, t.teamId, null, ' ab '), 422, 'team_project_title_invalid');
    await expectFail(upsert(t.captain, t.teamId, null, 'x'.repeat(121)), 422, 'team_project_title_invalid');
    await expectFail(upsert(t.captain, t.teamId, null, 'Proje', 'x'.repeat(601)), 422, 'team_project_summary_too_long');
    await expectFail(upsert(t.captain, t.teamId, null, 'Proje', null, 1999), 422, 'team_project_year_invalid');
    await expectFail(upsert(t.captain, t.teamId, null, 'Proje', null, 2101), 422, 'team_project_year_invalid');
    for (const url of ['javascript:alert(1)', 'http://example.org', 'https://', 'https://exa mple.org', 'HTTPS://example.org', `https://${'a'.repeat(500)}.org`]) {
      await expectFail(upsert(t.captain, t.teamId, null, 'Proje', null, 2026, url), 422, 'team_project_url_invalid');
    }
    expect((await upsert(t.captain, t.teamId, null, 'Pro', 'x'.repeat(600), 2100, 'https://example.org/a?b=c#d')).title).toBe('Pro');
  });

  it('the table itself refuses javascript: links and any cover_path (CHECK), whoever writes', async () => {
    const t = await simpleTeam();
    await expect(admin(`insert into public.team_projects (team_id, title, url) values ($1, 'Proje', 'javascript:alert(1)')`, [t.teamId]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(admin(`insert into public.team_projects (team_id, title, cover_path) values ($1, 'Proje', $2)`, [t.teamId, `teams/${t.teamId}/${randomUUID()}.webp`]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(admin(`insert into public.team_projects (team_id, title) values ($1, 'ab')`, [t.teamId])).rejects.toMatchObject({ code: '23514' });
    await expect(admin(`insert into public.team_projects (team_id, title, year) values ($1, 'Proje', 1999)`, [t.teamId])).rejects.toMatchObject({ code: '23514' });
  });

  it('no client writes the table directly — not even the captain (permission denied)', async () => {
    const t = await simpleTeam();
    const p = await upsert(t.captain, t.teamId, null, 'Otonom Robot');
    for (const sql of [
      `insert into public.team_projects (team_id, title) values ('${t.teamId}', 'Doğrudan')`,
      `update public.team_projects set title = 'Doğrudan' where id = '${p.id}'`,
      `delete from public.team_projects where id = '${p.id}'`,
    ]) {
      await expect(asUser(t.captain, (q) => q(sql)), sql).rejects.toThrow(PERMISSION_DENIED);
      await expect(asAnon((q) => q(sql)), sql).rejects.toThrow(PERMISSION_DENIED);
    }
  });

  it('delete: captain/mentor/platform admin only; member and outsider 403; unknown 404; audit keeps the ids', async () => {
    const t = await simpleTeam();
    const p1 = await upsert(t.captain, t.teamId, null, 'Birinci'); const p2 = await upsert(t.captain, t.teamId, null, 'İkinci');
    for (const uid of [t.member, t.outsider, t.formerMentor]) {
      await expectFail(asUser(uid, (q) => q(`select public.delete_team_project($1)`, [p1.id])), 403, 'team_manage_forbidden');
    }
    await expectFail(asUser(t.captain, (q) => q(`select public.delete_team_project($1)`, [randomUUID()])), 404, 'team_project_not_found');
    await asUser(t.mentor, (q) => q(`select public.delete_team_project($1)`, [p1.id]));
    const platformAdmin = await createUser(); await admin(`insert into public.platform_admins (user_id) values ($1)`, [platformAdmin]);
    await asUser(platformAdmin, (q) => q(`select public.delete_team_project($1)`, [p2.id]));
    expect((await admin(`select count(*)::int n from public.team_projects where team_id = $1`, [t.teamId])).rows[0].n).toBe(0);
    const a = (await admin(`select actor_id, metadata from public.audit_events where target_id = $1 and action = 'team.project_deleted'`, [p1.id])).rows;
    expect(a).toEqual([{ actor_id: t.mentor, metadata: { team_id: t.teamId } }]);
  });

  it('at most 50 projects per team (429)', async () => {
    const t = await simpleTeam();
    await admin(`insert into public.team_projects (team_id, title) select $1, 'Proje ' || g from generate_series(1, 50) g`, [t.teamId]);
    await expectFail(upsert(t.captain, t.teamId, null, 'Elli birinci'), 429, 'team_project_limit');
    const existing = (await admin(`select id from public.team_projects where team_id = $1 limit 1`, [t.teamId])).rows[0].id;
    expect((await upsert(t.captain, t.teamId, existing, 'Düzenleme sınıra takılmaz')).title).toBe('Düzenleme sınıra takılmaz');
  });
});

describe('team_projects · who reads them', () => {
  it('active team: everyone reads its projects and projects_count; suspended: anon and outsiders read nothing, members still do', async () => {
    const t = await simpleTeam();
    await upsert(t.captain, t.teamId, null, 'Otonom Robot'); await upsert(t.captain, t.teamId, null, 'Hat İzleyen');
    const read = (who: string | null) => (who ? asUser(who, (q) => q(`select id, title, cover_path from public.team_projects where team_id = $1`, [t.teamId]))
      : asAnon((q) => q(`select id, title, cover_path from public.team_projects where team_id = $1`, [t.teamId]))).then((r) => r.rowCount);
    expect([await read(null), await read(t.outsider), await read(t.member)]).toEqual([2, 2, 2]);
    expect((await profile(null, t.teamId)).projects_count).toBe(2);
    await suspend(t.teamId);
    expect([await read(null), await read(t.outsider), await read(t.member), await read(t.captain)]).toEqual([0, 0, 2, 2]);
    expect(await read(t.formerMentor)).toBe(0);
  });
});

describe('teams.category_key', () => {
  it('maps free-text labels to a key (Turkish + English, Turkish İ/ı aware), unmatched → other', async () => {
    const cases: [string | null, string][] = [
      ['FRC takımı', 'robotics'], ['Robotik', 'robotics'], ['ROBOTİK', 'robotics'], ['First Lego League (FLL)', 'robotics'], ['VEX Robotics', 'robotics'],
      ['Yazılım', 'software'], ['YAZILIM', 'software'], ['Yapay Zekâ', 'software'], ['Software', 'software'], ['Kodlama Kulübü', 'software'],
      ['Girişimcilik', 'entrepreneurship'], ['Startup', 'entrepreneurship'],
      ['Bilim', 'science'], ['BİLİM KULÜBÜ', 'science'], ['Biyoloji', 'science'], ['Roket', 'science'],
      ['Tasarım', 'design'], ['UI/UX Design', 'design'],
      ['Sosyal Sorumluluk', 'social_impact'], ['Gönüllülük', 'social_impact'], ['Social Impact', 'social_impact'],
      ['Sosyal Medya', 'media'], ['Film ve Fotoğraf', 'media'], ['Podcast', 'media'],
      ['Satranç', 'other'], ['', 'other'], [null, 'other'], ['Maina', 'other'], ['Fırça', 'other'],
    ];
    for (const [label, key] of cases) {
      expect([label, (await admin(`select app.team_category_key_for($1) k`, [label])).rows[0].k]).toEqual([label, key]);
    }
  });

  it('the migration backfill (UPDATE) turns "FRC takımı" / "Robotik" into robotics and leaves unmatched teams as other', async () => {
    const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_team_profile.sql'));
    if (!file) throw new Error('team_profile migration not found');
    const block = readFileSync(join(MIGRATIONS, file), 'utf8').match(/-- team-category-backfill:begin\n([\s\S]*?)-- team-category-backfill:end/)?.[1];
    if (!block) throw new Error('backfill markers not found in ' + file);
    expect(block).toMatch(/^update public\.teams/m);
    const c = await pool.connect();
    try {
      await c.query('begin');
      const ids: Record<string, string> = {};
      for (const label of ['FRC takımı', 'Robotik', 'Girişimcilik', 'Satranç']) {
        const id = randomUUID(); ids[label] = id;
        await c.query(`insert into public.teams (id, slug, name, category, category_key) values ($1, $2, 'Eski Takım', $3, 'other')`,
          [id, `old-${id.slice(0, 8)}`, label]);
      }
      await c.query(block);
      const { rows } = await c.query(`select id, category_key from public.teams where id = any($1)`, [Object.values(ids)]);
      const byId = Object.fromEntries(rows.map((r) => [r.id, r.category_key]));
      expect(Object.fromEntries(Object.entries(ids).map(([label, id]) => [label, byId[id]])))
        .toEqual({ 'FRC takımı': 'robotics', Robotik: 'robotics', Girişimcilik: 'entrepreneurship', Satranç: 'other' });
    } finally {
      await c.query('rollback').catch(() => {});
      c.release();
    }
  });

  it('create_team derives the key from the label, accepts an explicit key, rejects an unknown one; anon reads the column', async () => {
    const u = await createUser();
    const derived = (await asUser(u, (q) => q(`select * from public.create_team('Nova', 'team', 'FRC takımı', null)`))).rows[0];
    expect(derived.category_key).toBe('robotics');
    const plain = (await asUser(u, (q) => q(`select * from public.create_team('Düz Takım')`))).rows[0];
    expect(plain.category_key).toBe('other');
    const explicit = (await asUser(u, (q) => q(`select * from public.create_team('Atölye', 'community', 'Robotik', null, 'design')`))).rows[0];
    expect(explicit.category_key).toBe('design');
    await expectFail(asUser(u, (q) => q(`select * from public.create_team('Bozuk', 'team', null, null, 'gaming')`)), 422, 'team_category_invalid');
    expect((await asAnon((q) => q(`select category_key from public.teams where id = $1`, [derived.id]))).rows).toEqual([{ category_key: 'robotics' }]);
    await expect(admin(`update public.teams set category_key = 'gaming' where id = $1`, [derived.id])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('reports', () => {
  it('a team project can be reported', async () => {
    const t = await simpleTeam();
    const p = await upsert(t.captain, t.teamId, null, 'Uygunsuz içerik');
    const r = (await asUser(t.outsider, (q) => q(`insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'team_project', $2, 'inappropriate') returning id`,
      [t.outsider, p.id]))).rowCount;
    expect(r).toBe(1);
  });
});
