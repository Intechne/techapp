// Pilot journey privacy regressions (Task 9). The subject is a 16-year-old team member: a minor's name, birth date,
// contact data, card and CV must stay with the people the product says may see them — and nobody else.
// Each `it` is one promise; a positive path sits next to every refusal so a refusal cannot pass by accident.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createEvent, createOrg, createUser, expectFail, pool, register } from './helpers';

const MINOR_NAME = 'Defne Gizli Reşit Değil';
const JOIN_NOTE = 'Kaptana not: okulum Test Lisesi, telefonum 0555 000 11 22.';

/** Captain (adult) + accepted 16-year-old member + accepted adult member + pending applicant + outsider. */
async function teamWithMinor() {
  const captain = await createUser({ name: 'Kaptan Yetişkin' });
  const minor = await createUser({ age: 16, name: MINOR_NAME });
  const member = await createUser({ name: 'Üye Yetişkin' });
  const applicant = await createUser({ name: 'Bekleyen Aday' });
  const outsider = await createUser({ name: 'Takım Dışı' });
  const team = (await asUser(captain, (q) => q(`select * from public.create_team($1)`, [`Gizlilik ${randomUUID().slice(0, 6)}`]))).rows[0];
  for (const user of [minor, member]) {
    const m = (await asUser(user, (q) => q(`select * from public.request_team_join($1, $2)`, [team.id, JOIN_NOTE]))).rows[0];
    await asUser(captain, (q) => q(`select public.decide_team_join($1, true)`, [m.id]));
  }
  await asUser(applicant, (q) => q(`select * from public.request_team_join($1)`, [team.id]));
  return { captain, minor, member, applicant, outsider, teamId: team.id as string };
}

/** A confirmed registration of a 16-year-old for an event that is inside the check-in window right now. */
async function minorWithCard() {
  const staff = await createUser({ name: 'Görevli' }); const editor = await createUser(); const reviewer = await createUser();
  const org = await createOrg({ [staff]: 'checkin_staff', [editor]: 'editor', [reviewer]: 'reviewer' });
  const otherStaff = await createUser();
  await createOrg({ [otherStaff]: 'checkin_staff' });
  const event = await createEvent(org, {
    guardian_required_under: null,
    starts_at: new Date(Date.now() + 36e5), ends_at: new Date(Date.now() + 5 * 36e5), registration_closes_at: new Date(Date.now() + 30 * 6e4),
  });
  const minor = await createUser({ age: 16, name: MINOR_NAME });
  const reg = await register(minor, event);
  expect(reg.status).toBe('confirmed');
  const card = (await asUser(minor, (q) => q(`select public.get_participation_card($1) c`, [reg.id]))).rows[0].c;
  return { org, event, minor, reg, card, staff, editor, reviewer, otherStaff };
}

const PERMISSION_DENIED = /permission denied/;

describe('pilot privacy · a 16-year-old team member', () => {
  it('anon cannot read the minor’s name through profiles, team_memberships or team_roster', async () => {
    const { minor, teamId } = await teamWithMinor();
    const profiles = await asAnon((q) => q(`select display_name from public.profiles where id = $1 or display_name = $2`, [minor, MINOR_NAME]))
      .then((r) => r.rowCount, (e: Error) => (PERMISSION_DENIED.test(e.message) ? 0 : Promise.reject(e)));
    expect(profiles).toBe(0);
    const memberships = await asAnon((q) => q(`select user_id from public.team_memberships where team_id = $1`, [teamId]))
      .then((r) => r.rowCount, (e: Error) => (PERMISSION_DENIED.test(e.message) ? 0 : Promise.reject(e)));
    expect(memberships).toBe(0);
    await expect(asAnon((q) => q(`select * from public.team_roster($1)`, [teamId]))).rejects.toThrow(PERMISSION_DENIED);
  });

  it('a signed-in non-member cannot read the minor’s name through profiles, team_memberships or team_roster', async () => {
    const { minor, outsider, teamId } = await teamWithMinor();
    expect((await asUser(outsider, (q) => q(`select 1 from public.profiles where id = $1 or display_name = $2`, [minor, MINOR_NAME]))).rowCount).toBe(0);
    expect((await asUser(outsider, (q) => q(`select 1 from public.team_memberships where team_id = $1 or user_id = $2`, [teamId, minor]))).rowCount).toBe(0);
    await expectFail(asUser(outsider, (q) => q(`select * from public.team_roster($1)`, [teamId])), 403, 'team_members_only');
  });

  it('a pending applicant is not a member yet: no roster, no membership rows of others', async () => {
    const { minor, applicant, teamId } = await teamWithMinor();
    await expectFail(asUser(applicant, (q) => q(`select * from public.team_roster($1)`, [teamId])), 403, 'team_members_only');
    expect((await asUser(applicant, (q) => q(`select 1 from public.team_memberships where user_id = $1`, [minor]))).rowCount).toBe(0);
  });

  it('a fellow member DOES see the minor in team_roster (the positive path), but still not their profiles row', async () => {
    const { minor, member, captain, teamId } = await teamWithMinor();
    for (const viewer of [member, captain]) {
      const roster = (await asUser(viewer, (q) => q(`select user_id, display_name, status from public.team_roster($1)`, [teamId]))).rows;
      expect(roster).toContainEqual({ user_id: minor, display_name: MINOR_NAME, status: 'active' });
    }
    // The roster is the only door: membership does not open the profile table (no headline/bio/city of a minor).
    expect((await asUser(member, (q) => q(`select 1 from public.profiles where id = $1`, [minor]))).rowCount).toBe(0);
    // A member who left loses the roster again.
    await asUser(member, (q) => q(`select public.leave_team($1)`, [teamId]));
    await expectFail(asUser(member, (q) => q(`select * from public.team_roster($1)`, [teamId])), 403, 'team_members_only');
  });

  it('the join note the minor wrote to the captain is not readable by fellow members (roster rule holds on the table too)', async () => {
    const { minor, member, captain, teamId } = await teamWithMinor();
    // the roster shows the note to managers only …
    const asMember = (await asUser(member, (q) => q(`select message from public.team_roster($1) where user_id = $2`, [teamId, minor]))).rows;
    expect(asMember).toEqual([{ message: null }]);
    const asCaptain = (await asUser(captain, (q) => q(`select message from public.team_roster($1) where user_id = $2`, [teamId, minor]))).rows;
    expect(asCaptain).toEqual([{ message: JOIN_NOTE }]);
    // … and the table must not hand it out either
    const direct = await asUser(member, (q) => q(`select message from public.team_memberships where team_id = $1 and user_id = $2`, [teamId, minor]))
      .then((r) => r.rows.map((x) => x.message), (e: Error) => (PERMISSION_DENIED.test(e.message) ? [] : Promise.reject(e)));
    expect(direct.filter((m) => m !== null)).toEqual([]);
    // the writer and the team's managers still read it (fix: 20261111000100_team_membership_notes_privacy)
    for (const reader of [minor, captain]) {
      const rows = (await asUser(reader, (q) => q(`select message from public.team_memberships where team_id = $1 and user_id = $2 and status = 'active'`, [teamId, minor]))).rows;
      expect(rows).toEqual([{ message: JOIN_NOTE }]);
    }
  });

  it('nobody else can obtain the minor’s participation card (404, never their data)', async () => {
    const { minor, reg, card, staff } = await minorWithCard();
    expect(card.holder_name).toBe(MINOR_NAME); // the owner gets it
    const outsider = await createUser();
    for (const other of [outsider, staff]) {
      await expectFail(asUser(other, (q) => q(`select public.get_participation_card($1)`, [reg.id])), 404, 'registration_not_found');
    }
    await expect(asAnon((q) => q(`select public.get_participation_card($1)`, [reg.id]))).rejects.toThrow(PERMISSION_DENIED);
    // the QR payload carries no personal data: prefix, registration id, signature
    expect(card.qr_payload).toMatch(/^TA1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);
    expect(card.qr_payload).not.toContain(minor);
  });

  it('a participant cannot check themselves in; only that event’s check-in staff can', async () => {
    const { reg, card, minor } = await minorWithCard();
    await expectFail(asUser(minor, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 403, 'checkin_forbidden');
    expect((await admin(`select count(*)::int n from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].n).toBe(0);
  });

  it('a non-staff user cannot check anyone in: outsider, editor, reviewer and other-org staff all get 403', async () => {
    const { reg, card, staff, editor, reviewer, otherStaff } = await minorWithCard();
    const outsider = await createUser();
    for (const who of [outsider, editor, reviewer, otherStaff]) {
      await expectFail(asUser(who, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 403, 'checkin_forbidden');
    }
    await expect(asAnon((q) => q(`select public.check_in_participant($1)`, [card.qr_payload]))).rejects.toThrow(PERMISSION_DENIED);
    expect((await admin(`select count(*)::int n from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].n).toBe(0);
    // positive path: the event's own staff checks the minor in, and learns only the display name
    const result = (await asUser(staff, (q) => q(`select public.check_in_participant($1) r`, [card.qr_payload]))).rows[0].r;
    expect(result.result).toBe('checked_in');
    expect(Object.keys(result).sort()).toEqual(['checked_in_at', 'event_id', 'holder_name', 'registration_id', 'result']);
  });

  it('the minor cannot switch on CV sharing, and public_cv serves nothing for a minor even if a token exists', async () => {
    const minor = await createUser({ age: 16, name: MINOR_NAME });
    await expectFail(asUser(minor, (q) => q(`select public.set_cv_sharing(true)`)), 403, 'cv_sharing_adults_only');
    const planted = randomUUID().replaceAll('-', '') + 'x';
    await expect(asUser(minor, (q) => q(`update public.profile_private set cv_share_token = $2 where user_id = $1`, [minor, planted]))).rejects.toThrow(PERMISSION_DENIED);
    // a token that exists anyway (legacy row) on a dedicated connection, so the bypass setting cannot leak into the pool
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('app.allow_cv_token_write', 'on', true)`);
      await client.query(`update public.profile_private set cv_share_token = $2 where user_id = $1`, [minor, planted]);
      await client.query('commit');
    } finally { client.release(); }
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [planted])), 404, 'cv_not_found');
    await expectFail(asUser(await createUser(), (q) => q(`select public.public_cv($1)`, [planted])), 404, 'cv_not_found');
    // positive path: the same call serves an adult's link
    const adult = await createUser({ name: 'Yetişkin CV' });
    const token = (await asUser(adult, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t;
    expect((await asAnon((q) => q(`select public.public_cv($1) j`, [token]))).rows[0].j.profile.display_name).toBe('Yetişkin CV');
  });

  it('the minor cannot make themselves discoverable (discoverable_requires_adult)', async () => {
    const minor = await createUser({ age: 16, name: MINOR_NAME });
    await expectFail(asUser(minor, (q) => q(`update public.profiles set discoverable = true where id = $1`, [minor])), 403, 'discoverable_requires_adult');
    expect((await admin(`select discoverable from public.profiles where id = $1`, [minor])).rows[0].discoverable).toBe(false);
    // other own-profile edits still work, so the refusal is about discoverability only
    expect((await asUser(minor, (q) => q(`update public.profiles set headline = 'Robotik' where id = $1`, [minor]))).rowCount).toBe(1);
  });

  it('the minor’s profile_private (birth date, contact) is readable by the minor only', async () => {
    const { minor, captain, member } = await teamWithMinor();
    await asUser(minor, (q) => q(`update public.profile_private set phone = '05550001122', school_name = 'Test Lisesi' where user_id = $1`, [minor]));
    const own = (await asUser(minor, (q) => q(`select birth_date, phone from public.profile_private where user_id = $1`, [minor]))).rows;
    expect(own).toHaveLength(1);
    expect(own[0].phone).toBe('05550001122');
    // the organiser of an event the minor registered for is no exception
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    await register(minor, await createEvent(org, { guardian_required_under: null }));
    for (const viewer of [captain, member, owner, await createUser()]) {
      expect((await asUser(viewer, (q) => q(`select 1 from public.profile_private where user_id = $1`, [minor]))).rowCount).toBe(0);
    }
    const anon = await asAnon((q) => q(`select 1 from public.profile_private where user_id = $1`, [minor]))
      .then((r) => r.rowCount, (e: Error) => (PERMISSION_DENIED.test(e.message) ? 0 : Promise.reject(e)));
    expect(anon).toBe(0);
    // nor can anyone write the minor's contact fields
    expect((await asUser(captain, (q) => q(`update public.profile_private set phone = '0' where user_id = $1`, [minor]))).rowCount).toBe(0);
  });

  it('the helpers that read another person’s birth date, CV, ticket or profile snapshot are not callable by API roles', async () => {
    const internals = ['app.age_years(uuid)', 'app.cv_document(uuid, boolean)', 'app.ticket_token(public.event_registrations)',
      'app.build_application_snapshot(uuid, text[])'];
    for (const fn of internals) {
      const { rows } = await admin(`select has_function_privilege('anon', $1::regprocedure, 'execute') anon,
                                           has_function_privilege('authenticated', $1::regprocedure, 'execute') auth`, [fn]);
      expect([fn, rows[0]]).toEqual([fn, { anon: false, auth: false }]);
    }
    const minor = await createUser({ age: 16 }); const other = await createUser();
    await expect(asUser(other, (q) => q(`select app.age_years($1)`, [minor]))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asUser(other, (q) => q(`select app.cv_document($1, false)`, [minor]))).rejects.toThrow(PERMISSION_DENIED);
  });

  it('the guardian e-mail stays masked for the minor and invisible to everyone else, organisers included', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createEvent(org, { capacity: 5 });
    const minor = await createUser({ age: 16, name: MINOR_NAME });
    const reg = await register(minor, event);
    expect(reg.status).toBe('pending_guardian');
    await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'anne.gizli@example.test', 'Anne Gizli')`, [reg.id]));
    const own = (await asUser(minor, (q) => q(`select * from public.my_guardian_requests`))).rows;
    expect(own[0].guardian_email_masked).toBe('a•••@example.test');
    expect(JSON.stringify(own)).not.toMatch(/anne\.gizli|Anne Gizli/);
    for (const viewer of [owner, await createUser()]) {
      expect((await asUser(viewer, (q) => q(`select 1 from public.my_guardian_requests`))).rowCount).toBe(0);
      const direct = await asUser(viewer, (q) => q(`select 1 from public.guardian_requests where subject_id = $1`, [reg.id]))
        .then((r) => r.rowCount, (e: Error) => (PERMISSION_DENIED.test(e.message) ? 0 : Promise.reject(e)));
      expect(direct).toBe(0);
    }
    const list = (await asUser(owner, (q) => q(`select * from public.admin_event_registrations($1)`, [event]))).rows;
    expect(JSON.stringify(list)).not.toMatch(/anne\.gizli|Anne Gizli/);
    expect(list[0].guardian_status).toBe('pending');
  });

  it('the organiser’s registration list carries minimum PII, and only for that event’s staff', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createEvent(org, { guardian_required_under: null });
    const minor = await createUser({ age: 16, name: MINOR_NAME });
    await asUser(minor, (q) => q(`update public.profile_private set phone = '05550001122' where user_id = $1`, [minor]));
    await register(minor, event);
    const { rows, fields } = await asUser(owner, (q) => q(`select * from public.admin_event_registrations($1)`, [event]));
    expect(fields.map((f) => f.name).sort()).toEqual(['checked_in_at', 'confirmed_at', 'created_at', 'display_name', 'guardian_status',
      'registration_id', 'status', 'status_reason']);
    expect(rows[0].display_name).toBe(MINOR_NAME);
    expect(JSON.stringify(rows)).not.toMatch(/05550001122|example\.test|"\d{4}-\d{2}-\d{2}"/);
    // staff of another organisation and a plain user get nothing
    const foreignOwner = await createUser(); await createOrg({ [foreignOwner]: 'owner' });
    for (const who of [foreignOwner, minor, await createUser()]) {
      await expectFail(asUser(who, (q) => q(`select * from public.admin_event_registrations($1)`, [event])), 403, 'forbidden');
    }
    // and the organiser cannot read the participant's profile row itself
    expect((await asUser(owner, (q) => q(`select 1 from public.profiles where id = $1`, [minor]))).rowCount).toBe(0);
  });
});

// 20261112000300: who founded a team / wrote a recruitment post is a user UUID — for a minor founder, a handle that can later
// be joined to their profile. The API roles read every column of teams and recruitment_posts EXCEPT created_by.
// + cover_path, cover_blurhash granted in 20261113000100_covers (public content, like name/tagline).
// + category_key granted in 20261113000200_team_profile (public content, like category).
const TEAM_PUBLIC = 'id, organization_id, slug, name, kind, category, tagline, about, city, topic_interest_id, tone, accepts_join_requests, moderation_status, member_count, is_demo, created_at, updated_at, cover_path, cover_blurhash, category_key';
const POST_PUBLIC = 'id, team_id, title, role_label, description, skills, is_open, closes_at, created_at, updated_at';
/** Columns the API roles must NOT read. Every other column must be granted (checked below), so a new column is a decision. */
const CREATOR_DENIED: Record<string, string[]> = { teams: ['created_by'], recruitment_posts: ['created_by'] };

/** A 16-year-old founds a team and has an open recruitment post signed with their user id. */
async function teamFoundedByMinor() {
  const founder = await createUser({ age: 16, name: MINOR_NAME });
  const member = await createUser({ name: 'Üye Yetişkin' });
  const outsider = await createUser({ name: 'Takım Dışı' });
  const team = (await asUser(founder, (q) => q(`select * from public.create_team($1)`, [`Kurucu ${randomUUID().slice(0, 6)}`]))).rows[0];
  const m = (await asUser(member, (q) => q(`select * from public.request_team_join($1)`, [team.id]))).rows[0];
  await asUser(founder, (q) => q(`select public.decide_team_join($1, true)`, [m.id]));
  const post = (await admin(`insert into public.recruitment_posts (team_id, title, created_by) values ($1, 'Yazılımcı arıyoruz', $2) returning id`,
    [team.id, founder])).rows[0];
  return { founder, member, outsider, teamId: team.id as string, postId: post.id as string };
}

describe('pilot privacy · who founded a team or wrote a recruitment post', () => {
  it('anon and a non-member cannot select teams.created_by or recruitment_posts.created_by (permission denied)', async () => {
    const { member, outsider, teamId, postId } = await teamFoundedByMinor();
    const attempts = [
      [`select created_by from public.teams where id = $1`, teamId],
      [`select * from public.teams where id = $1`, teamId],
      [`select id from public.teams where created_by is not null and id = $1`, teamId], // not even as a filter
      [`select created_by from public.recruitment_posts where id = $1`, postId],
      [`select * from public.recruitment_posts where id = $1`, postId],
    ] as const;
    for (const [sql, id] of attempts) {
      await expect(asAnon((q) => q(sql, [id])), `anon: ${sql}`).rejects.toThrow(PERMISSION_DENIED);
      // a signed-in outsider — and a member too: no client screen needs the founder's id
      for (const viewer of [outsider, member]) {
        await expect(asUser(viewer, (q) => q(sql, [id])), `user: ${sql}`).rejects.toThrow(PERMISSION_DENIED);
      }
    }
  });

  it('the public column list of teams still reads for anon', async () => {
    const { outsider, teamId, postId } = await teamFoundedByMinor();
    const team = (await asAnon((q) => q(`select ${TEAM_PUBLIC} from public.teams where id = $1`, [teamId]))).rows;
    expect(team).toHaveLength(1);
    expect(team[0]).toMatchObject({ id: teamId, member_count: 2, moderation_status: 'active' });
    expect(team[0]).not.toHaveProperty('created_by');
    const post = (await asAnon((q) => q(`select ${POST_PUBLIC} from public.recruitment_posts where id = $1`, [postId]))).rows;
    expect(post).toHaveLength(1);
    expect(post[0]).toMatchObject({ id: postId, team_id: teamId, is_open: true });
    // the same lists for a signed-in user (the Takımlarım embed is covered by the Expo-web probe, not here)
    expect((await asUser(outsider, (q) => q(`select ${TEAM_PUBLIC} from public.teams where id = $1`, [teamId]))).rowCount).toBe(1);
    expect((await asUser(outsider, (q) => q(`select ${POST_PUBLIC} from public.recruitment_posts where id = $1`, [postId]))).rowCount).toBe(1);
  });

  it('create_team and recruitment RPCs still work (definer path unaffected)', async () => {
    const captain = await createUser(); const applicant = await createUser();
    const team = (await asUser(captain, (q) => q(`select * from public.create_team($1)`, [`Definer ${randomUUID().slice(0, 6)}`]))).rows[0];
    expect(team.created_by).toBe(captain); // the caller's own id, returned to the caller by the definer function
    const post = (await asUser(captain, (q) => q(`insert into public.recruitment_posts (team_id, title, created_by) values ($1, 'Mekanikçi arıyoruz', $2) returning id`,
      [team.id, captain]))).rows[0];
    const app = (await asUser(applicant, (q) => q(`select * from public.apply_to_recruitment($1, 'Ben varım')`, [post.id]))).rows[0];
    expect(app.status).toBe('submitted');
    const decided = (await asUser(captain, (q) => q(`select * from public.decide_recruitment_application($1, true)`, [app.id]))).rows[0];
    expect(decided.status).toBe('accepted');
    expect((await asUser(applicant, (q) => q(`select user_id from public.team_roster($1)`, [team.id]))).rows.map((r) => r.user_id)).toContain(applicant);
    // the per-founder team limit (create_team reads created_by as owner) still counts
    for (let i = 0; i < 4; i += 1) await asUser(captain, (q) => q(`select public.create_team($1)`, [`Sınır ${i} ${randomUUID().slice(0, 4)}`]));
    await expectFail(asUser(captain, (q) => q(`select public.create_team('Altıncı takım')`)), 429, 'team_create_limit');
  });

  it('a team manager still updates and deletes their recruitment post and team through the table (RLS path unaffected)', async () => {
    const { founder, member, teamId, postId } = await teamFoundedByMinor();
    const updated = (await asUser(founder, (q) => q(`update public.recruitment_posts set title = 'Yazılımcı ve tasarımcı' where id = $1 returning id, title`, [postId]))).rows;
    expect(updated).toEqual([{ id: postId, title: 'Yazılımcı ve tasarımcı' }]);
    expect((await asUser(founder, (q) => q(`update public.teams set tagline = 'Robotik' where id = $1 returning id, tagline`, [teamId]))).rows)
      .toEqual([{ id: teamId, tagline: 'Robotik' }]);
    // a plain member is still not a manager
    expect((await asUser(member, (q) => q(`update public.recruitment_posts set title = 'ele geçirildi' where id = $1`, [postId]))).rowCount).toBe(0);
    expect((await asUser(member, (q) => q(`delete from public.recruitment_posts where id = $1`, [postId]))).rowCount).toBe(0);
    // asking for the creator back is refused even to the manager
    await expect(asUser(founder, (q) => q(`update public.recruitment_posts set title = 'x x x' where id = $1 returning created_by`, [postId])))
      .rejects.toThrow(PERMISSION_DENIED);
    expect((await asUser(founder, (q) => q(`delete from public.recruitment_posts where id = $1 returning id`, [postId]))).rows).toEqual([{ id: postId }]);
    expect((await admin(`select created_by from public.teams where id = $1`, [teamId])).rows[0].created_by).toBe(founder); // data kept
  });

  it('every column of teams and recruitment_posts is either granted to the API roles or explicitly denied (new columns cannot slip through)', async () => {
    for (const [table, denied] of Object.entries(CREATOR_DENIED)) {
      // a table-level SELECT grant would cover every column, so it must be gone
      const t = (await admin(`select has_table_privilege('anon', $1, 'select') anon, has_table_privilege('authenticated', $1, 'select') auth`, [`public.${table}`])).rows[0];
      expect([table, t]).toEqual([table, { anon: false, auth: false }]);
      const { rows } = await admin(`select column_name,
          has_column_privilege('anon', $1, column_name, 'select') anon,
          has_column_privilege('authenticated', $1, column_name, 'select') auth
        from information_schema.columns where table_schema = 'public' and table_name = $2 order by ordinal_position`, [`public.${table}`, table]);
      expect(rows.length).toBeGreaterThan(denied.length);
      for (const r of rows) {
        const want = !denied.includes(r.column_name);
        // a failure here: a new column was added without a decision — grant it in a migration or add it to CREATOR_DENIED
        expect([table, r.column_name, r.anon, r.auth]).toEqual([table, r.column_name, want, want]);
      }
    }
    // the hard-coded public lists above are exactly the granted columns
    expect(TEAM_PUBLIC.split(', ').sort()).toEqual((await admin(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name <> 'created_by'`)).rows.map((r) => r.column_name).sort());
    expect(POST_PUBLIC.split(', ').sort()).toEqual((await admin(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'recruitment_posts' and column_name <> 'created_by'`)).rows.map((r) => r.column_name).sort());
  });
});
