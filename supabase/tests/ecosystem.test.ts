import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createOrg, createUser, expectFail } from './helpers';

async function createTeam(captain: string, name = 'Test Takımı') {
  return (await asUser(captain, (q) => q(`select * from public.create_team($1)`, [name]))).rows[0];
}
async function joinTeam(teamId: string, captain: string, user: string) {
  const m = (await asUser(user, (q) => q(`select * from public.request_team_join($1, 'Merhaba')`, [teamId]))).rows[0];
  return (await asUser(captain, (q) => q(`select * from public.decide_team_join($1, true)`, [m.id]))).rows[0];
}
async function createOpportunity(orgId: string, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const base: Record<string, unknown> = {
    id, organization_id: orgId, slug: `opp-${id.slice(0, 8)}`, title: 'Test Fırsatı', summary: 'Özet',
    type: 'internship', status: 'published', is_demo: true, closes_at: new Date(Date.now() + 7 * 864e5),
    shared_fields: ['display_name', 'education_stage'], ...overrides,
  };
  const cols = Object.keys(base);
  await admin(`insert into public.opportunities (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(base));
  return id;
}
const submit = (user: string, opp: string, key: string = randomUUID(), motivation = 'Öğrenmek istiyorum.') =>
  asUser(user, async (q) => (await q(`select * from public.submit_application($1, $2, $3)`, [opp, key, motivation])).rows[0]);

describe('teams', () => {
  it('join request flow: pending → accepted by the captain of that team only', async () => {
    const captain = await createUser(); const otherCaptain = await createUser(); const user = await createUser();
    const team = await createTeam(captain); await createTeam(otherCaptain, 'Başka Takım');
    const req = (await asUser(user, (q) => q(`select * from public.request_team_join($1, 'Yazılım tarafında çalışmak isterim')`, [team.id]))).rows[0];
    const dup = (await asUser(user, (q) => q(`select * from public.request_team_join($1)`, [team.id]))).rows[0];
    expect(req.status).toBe('pending');
    expect(dup.id).toBe(req.id);

    await expectFail(asUser(otherCaptain, (q) => q(`select public.decide_team_join($1, true)`, [req.id])), 403, 'team_manage_forbidden');
    await expectFail(asUser(user, (q) => q(`select public.decide_team_join($1, true)`, [req.id])), 403, 'team_manage_forbidden');
    expect((await asUser(otherCaptain, (q) => q(`select * from public.team_memberships where id = $1`, [req.id]))).rowCount).toBe(0);
    await expectFail(asUser(user, (q) => q(`select * from public.team_roster($1)`, [team.id])), 403, 'team_members_only');

    const accepted = (await asUser(captain, (q) => q(`select * from public.decide_team_join($1, true)`, [req.id]))).rows[0];
    expect(accepted).toMatchObject({ status: 'active', role: 'member' });
    expect((await admin(`select member_count from public.teams where id = $1`, [team.id])).rows[0].member_count).toBe(2);
    expect((await asUser(user, (q) => q(`select * from public.team_roster($1)`, [team.id]))).rowCount).toBe(2);
  });

  it('members cannot self-promote or write memberships; outsiders cannot mutate roles', async () => {
    const captain = await createUser(); const member = await createUser(); const outsider = await createUser();
    const team = await createTeam(captain); const m = await joinTeam(team.id, captain, member);

    expect((await asUser(member, (q) => q(`update public.team_memberships set role = 'captain' where id = $1`, [m.id]))).rowCount).toBe(0);
    await expect(asUser(outsider, (q) => q(
      `insert into public.team_memberships (team_id, user_id, role, status) values ($1, $2, 'captain', 'active')`, [team.id, outsider])))
      .rejects.toThrow(/row-level security/);
    await expectFail(asUser(member, (q) => q(`select public.set_team_member_role($1, 'captain')`, [m.id])), 403, 'team_manage_forbidden');
    await expectFail(asUser(outsider, (q) => q(`select public.set_team_member_role($1, 'mentor')`, [m.id])), 403, 'team_manage_forbidden');
    expect((await asUser(outsider, (q) => q(`update public.teams set name = 'Ele geçirildi' where id = $1`, [team.id]))).rowCount).toBe(0);

    const promoted = (await asUser(captain, (q) => q(`select * from public.set_team_member_role($1, 'mentor')`, [m.id]))).rows[0];
    expect(promoted.role).toBe('mentor');
    // a mentor manages join requests and tasks but still cannot hand out roles
    const capRow = (await admin(`select id from public.team_memberships where team_id = $1 and user_id = $2`, [team.id, captain])).rows[0];
    await expectFail(asUser(member, (q) => q(`select public.set_team_member_role($1, 'member')`, [capRow.id])), 403, 'team_manage_forbidden');
  });

  it('protects the last captain and forbids changing your own role', async () => {
    const captain = await createUser(); const second = await createUser();
    const team = await createTeam(captain); const m = await joinTeam(team.id, captain, second);
    const capRow = (await admin(`select id from public.team_memberships where team_id = $1 and user_id = $2`, [team.id, captain])).rows[0];

    await expectFail(asUser(captain, (q) => q(`select public.set_team_member_role($1, 'member')`, [capRow.id])), 403, 'cannot_change_own_role');
    await expectFail(asUser(captain, (q) => q(`select public.leave_team($1)`, [team.id])), 409, 'last_captain');

    await asUser(captain, (q) => q(`select public.set_team_member_role($1, 'captain')`, [m.id]));
    await asUser(second, (q) => q(`select public.set_team_member_role($1, 'member')`, [capRow.id])); // now allowed: two captains
    await expectFail(asUser(second, (q) => q(`select public.leave_team($1)`, [team.id])), 409, 'last_captain');
  });

  it('tasks: managers manage, the assignee moves only their own task, other teams see nothing', async () => {
    const captain = await createUser(); const a = await createUser(); const b = await createUser(); const outsider = await createUser();
    const team = await createTeam(captain); await joinTeam(team.id, captain, a); await joinTeam(team.id, captain, b);
    const task = (await asUser(captain, (q) => q(
      `insert into public.team_tasks (team_id, title, assignee_id) values ($1, 'Şasi çizimi', $2) returning *`, [team.id, a]))).rows[0];

    await expect(asUser(a, (q) => q(`insert into public.team_tasks (team_id, title) values ($1, 'İzinsiz görev')`, [team.id])))
      .rejects.toThrow(/row-level security/);
    await expectFail(asUser(captain, (q) => q(`insert into public.team_tasks (team_id, title, assignee_id) values ($1, 'Dış görev', $2)`, [team.id, outsider])), 422, 'assignee_not_team_member');
    await expectFail(asUser(b, (q) => q(`select public.set_team_task_status($1, 'done')`, [task.id])), 403, 'task_forbidden');
    await expectFail(asUser(outsider, (q) => q(`select public.set_team_task_status($1, 'done')`, [task.id])), 404, 'task_not_found');
    expect((await asUser(outsider, (q) => q(`select * from public.team_tasks`))).rowCount).toBe(0);

    const moved = (await asUser(a, (q) => q(`select * from public.set_team_task_status($1, 'doing')`, [task.id]))).rows[0];
    expect(moved.status).toBe('doing');
    const done = (await asUser(captain, (q) => q(`select * from public.set_team_task_status($1, 'done')`, [task.id]))).rows[0];
    expect(done.completed_at).not.toBeNull();
  });

  it('recruitment: accepted applicant becomes a member; only that team decides', async () => {
    const captain = await createUser(); const otherCaptain = await createUser(); const applicant = await createUser();
    const team = await createTeam(captain); await createTeam(otherCaptain, 'Rakip');
    const post = (await asUser(captain, (q) => q(
      `insert into public.recruitment_posts (team_id, title) values ($1, 'Yazılımcı arıyoruz') returning *`, [team.id]))).rows[0];
    expect((await asAnon((q) => q(`select id from public.recruitment_posts where id = $1`, [post.id]))).rowCount).toBe(1);
    const app = (await asUser(applicant, (q) => q(`select * from public.apply_to_recruitment($1, 'Ben varım')`, [post.id]))).rows[0];
    await expectFail(asUser(otherCaptain, (q) => q(`select public.decide_recruitment_application($1, true)`, [app.id])), 403, 'team_manage_forbidden');
    await asUser(captain, (q) => q(`select public.decide_recruitment_application($1, true)`, [app.id]));
    expect((await asUser(applicant, (q) => q(`select * from public.team_roster($1)`, [team.id]))).rowCount).toBe(2);
  });
});

describe('opportunity applications', () => {
  it('is idempotent and enforces deadline, age and guardian rules on the server', async () => {
    const org = await createOrg(); const opp = await createOpportunity(org, { min_age: 18, guardian_required_under: null });
    const user = await createUser({ age: 21 }); const key = randomUUID();
    const [a, b] = await Promise.all([submit(user, opp, key), submit(user, opp, key)]);
    const c = await submit(user, opp);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    expect(a.status).toBe('submitted');
    expect((await admin(`select count(*)::int n from public.applications where opportunity_id = $1`, [opp])).rows[0].n).toBe(1);

    await expectFail(submit(await createUser({ age: 16 }), opp), 403, 'below_min_age');
    const minorsNeedGuardian = await createOpportunity(org, { guardian_required_under: 18 });
    await expectFail(submit(await createUser({ age: 16 }), minorsNeedGuardian), 403, 'guardian_consent_unavailable');
    const closed = await createOpportunity(org, { closes_at: new Date(Date.now() - 1000) });
    await expectFail(submit(await createUser(), closed), 409, 'applications_closed');
    const draft = await createOpportunity(org, { status: 'draft' });
    await expectFail(submit(await createUser(), draft), 404, 'opportunity_not_found');
    await expectFail(submit(await createUser({ age: null }), opp), 409, 'profile_incomplete');
  });

  it('snapshot holds only shared_fields and does not follow later profile edits', async () => {
    const org = await createOrg();
    const opp = await createOpportunity(org, { shared_fields: ['display_name', 'city', 'interests'] });
    const user = await createUser({ name: 'Deniz Yılmaz' });
    await asUser(user, (q) => q(`update public.profiles set city = 'İzmir', bio = 'Gizli kalsın' where id = $1`, [user]));
    await asUser(user, (q) => q(`update public.profile_private set phone = '+905550000000', legal_name = 'Deniz Yılmaz Resmi' where user_id = $1`, [user]));

    const preview = (await asUser(user, (q) => q(`select public.application_share_preview($1) j`, [opp]))).rows[0].j;
    const app = await submit(user, opp);
    expect(app.snapshot).toEqual({ display_name: 'Deniz Yılmaz', city: 'İzmir', interests: [] });
    expect(preview.snapshot).toEqual(app.snapshot);
    const raw = JSON.stringify(app.snapshot);
    for (const leaked of ['Gizli', '+90555', 'Resmi', 'example.test']) expect(raw).not.toContain(leaked);

    await asUser(user, (q) => q(`update public.profiles set city = 'Ankara', display_name = 'Başka Ad' where id = $1`, [user]));
    const after = (await asUser(user, (q) => q(`select snapshot from public.applications where id = $1`, [app.id]))).rows[0];
    expect(after.snapshot.city).toBe('İzmir');
    expect((await asUser(user, (q) => q(`update public.applications set snapshot = '{}' where id = $1`, [app.id]))).rowCount).toBe(0);
    await expectFail(admin(`update public.applications set snapshot = '{"display_name":"x"}' where id = $1`, [app.id]), 409, 'application_snapshot_immutable');
  });

  it('tenant isolation: an organisation sees only its own applications and never applicant profiles', async () => {
    const revA = await createUser(); const revB = await createUser(); const editorA = await createUser();
    const orgA = await createOrg({ [revA]: 'reviewer', [editorA]: 'editor' }); const orgB = await createOrg({ [revB]: 'owner' });
    const oppA = await createOpportunity(orgA); await createOpportunity(orgB);
    const user = await createUser(); const app = await submit(user, oppA);

    expect((await asUser(revA, (q) => q(`select id from public.applications`))).rows.map((r) => r.id)).toEqual([app.id]);
    expect((await asUser(revB, (q) => q(`select id from public.applications`))).rowCount).toBe(0);
    expect((await asUser(editorA, (q) => q(`select id from public.applications`))).rowCount).toBe(0);
    expect((await asUser(revA, (q) => q(`select * from public.profile_private where user_id = $1`, [user]))).rowCount).toBe(0);
    expect((await asUser(revA, (q) => q(`select * from public.profiles where id = $1`, [user]))).rowCount).toBe(0);
    expect((await asUser(revA, (q) => q(`select * from public.profiles`))).rowCount).toBe(1); // only their own
    await expectFail(asUser(revB, (q) => q(`select public.set_application_status($1, 'in_review')`, [app.id])), 403, 'application_review_forbidden');
    await expectFail(asUser(user, (q) => q(`select public.set_application_status($1, 'accepted')`, [app.id])), 403, 'application_review_forbidden');
  });

  it('validates status transitions and records history visible to the applicant', async () => {
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const opp = await createOpportunity(org); const user = await createUser(); const app = await submit(user, opp);
    const set = (s: string, note?: string) => asUser(reviewer, (q) => q(`select * from public.set_application_status($1, $2, $3)`, [app.id, s, note ?? null]));

    await expectFail(set('accepted'), 409, 'application_transition_invalid');
    await set('in_review'); await set('info_requested', 'Portföy bağlantını ekler misin?'); await set('in_review'); await set('accepted');
    await expectFail(set('declined'), 409, 'application_transition_invalid');
    await expectFail(asUser(user, (q) => q(`select public.withdraw_application($1)`, [app.id])), 409, 'application_not_withdrawable');

    const history = await asUser(user, (q) => q(`select from_status, to_status, actor_kind, note from public.application_status_history where application_id = $1 order by id`, [app.id]));
    expect(history.rows.map((r) => r.to_status)).toEqual(['submitted', 'in_review', 'info_requested', 'in_review', 'accepted']);
    expect(history.rows[2].note).toBe('Portföy bağlantını ekler misin?');
    expect((await asUser(await createUser(), (q) => q(`select * from public.application_status_history where application_id = $1`, [app.id]))).rowCount).toBe(0);
  });

  it('withdrawn applications free the slot for a fresh application', async () => {
    const org = await createOrg(); const opp = await createOpportunity(org); const user = await createUser();
    const first = await submit(user, opp);
    await asUser(user, (q) => q(`select public.withdraw_application($1)`, [first.id]));
    const second = await submit(user, opp);
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('submitted');
  });

  it('organisations cannot self-publish opportunities', async () => {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' });
    const draft = await createOpportunity(org, { status: 'draft' });
    await expectFail(asUser(editor, (q) => q(`update public.opportunities set status = 'published' where id = $1`, [draft])), 403, 'publish_requires_platform_approval');
  });
});

describe('experiences and attestations', () => {
  async function publishedExperience(user: string, visibility = 'profile') {
    return (await asUser(user, (q) => q(
      `insert into public.experiences (user_id, title, role, contribution, status, visibility)
       values ($1, 'Çizgi izleyen robot', 'Yazılım', 'PID kontrol yazdım', 'published', $2) returning *`, [user, visibility]))).rows[0];
  }

  it('starts as self-reported; the owner cannot verify it, not even as an org reviewer', async () => {
    const owner = await createUser(); const reviewer = await createUser(); const stranger = await createUser();
    const org = await createOrg({ [reviewer]: 'reviewer', [owner]: 'owner' });
    const exp = await publishedExperience(owner);
    expect((await asUser(owner, (q) => q(`select is_verified from public.experiences_with_status where id = $1`, [exp.id]))).rows[0].is_verified).toBe(false);

    await expect(asUser(owner, (q) => q(
      `insert into public.attestations (experience_id, organization_id, status, requested_by) values ($1, $2, 'verified', $3)`, [exp.id, org, owner])))
      .rejects.toThrow(/row-level security/);
    const att = (await asUser(owner, (q) => q(`select * from public.request_attestation($1, $2, 'Yarışmada yazılım ekibinde görev aldı')`, [exp.id, org]))).rows[0];
    expect(att.status).toBe('requested');
    expect((await asUser(owner, (q) => q(`update public.attestations set status = 'verified' where id = $1`, [att.id]))).rowCount).toBe(0);
    await expectFail(asUser(owner, (q) => q(`select public.decide_attestation($1, 'verified')`, [att.id])), 403, 'self_attestation_forbidden');
    await expectFail(asUser(stranger, (q) => q(`select public.decide_attestation($1, 'verified')`, [att.id])), 403, 'attestation_forbidden');

    const decided = (await asUser(reviewer, (q) => q(`select * from public.decide_attestation($1, 'verified', null, null, 'organizatör kaydı')`, [att.id]))).rows[0];
    expect(decided).toMatchObject({ status: 'verified', decided_by: reviewer, source: 'organizatör kaydı' });
    expect(decided.decided_at).not.toBeNull();
    expect((await asUser(owner, (q) => q(`select is_verified from public.experiences_with_status where id = $1`, [exp.id]))).rows[0].is_verified).toBe(true);
  });

  it('revocation and substantive edits remove the verified status', async () => {
    const owner = await createUser(); const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const exp = await publishedExperience(owner);
    const verify = async () => {
      const att = (await asUser(owner, (q) => q(`select * from public.request_attestation($1, $2, 'Katkı verdi')`, [exp.id, org]))).rows[0];
      await asUser(reviewer, (q) => q(`select public.decide_attestation($1, 'verified')`, [att.id]));
      return att.id as string;
    };
    const isVerified = async () => (await asUser(owner, (q) => q(`select is_verified from public.experiences_with_status where id = $1`, [exp.id]))).rows[0].is_verified;

    const first = await verify();
    expect(await isVerified()).toBe(true);
    await expectFail(asUser(owner, (q) => q(`select public.revoke_attestation($1, 'ben istedim')`, [first])), 403, 'attestation_forbidden');
    await asUser(reviewer, (q) => q(`select public.revoke_attestation($1, 'Kayıt hatalı girilmiş')`, [first]));
    expect(await isVerified()).toBe(false);

    await verify();
    expect(await isVerified()).toBe(true);
    await asUser(owner, (q) => q(`update public.experiences set contribution = 'Her şeyi ben yaptım' where id = $1`, [exp.id]));
    expect(await isVerified()).toBe(false);
  });

  it('drafts and evidence stay private; reviewers see evidence only through a live request', async () => {
    const owner = await createUser(); const reviewer = await createUser(); const stranger = await createUser();
    const org = await createOrg({ [reviewer]: 'reviewer' });
    const exp = await publishedExperience(owner, 'private');
    await asUser(owner, (q) => q(
      `insert into public.experience_evidence (experience_id, user_id, storage_path, mime_type, size_bytes) values ($1, $2, $3, 'application/pdf', 1000)`,
      [exp.id, owner, `${owner}/belge.pdf`]));
    await expect(asUser(owner, (q) => q(
      `insert into public.experience_evidence (experience_id, user_id, storage_path, mime_type, size_bytes) values ($1, $2, 'baskasi/belge.pdf', 'application/pdf', 1000)`,
      [exp.id, owner]))).rejects.toThrow(/row-level security/);

    for (const who of [stranger, reviewer]) {
      expect((await asUser(who, (q) => q(`select * from public.experiences where id = $1`, [exp.id]))).rowCount).toBe(0);
      expect((await asUser(who, (q) => q(`select * from public.experience_evidence`))).rowCount).toBe(0);
    }
    expect((await asAnon((q) => q(`select * from public.experience_evidence`))).rowCount).toBe(0);
    await asUser(owner, (q) => q(`select public.request_attestation($1, $2, 'Kapsam')`, [exp.id, org]));
    expect((await asUser(reviewer, (q) => q(`select * from public.experience_evidence`))).rowCount).toBe(1);
    expect((await asUser(stranger, (q) => q(`select * from public.experience_evidence`))).rowCount).toBe(0);
  });
});

describe('bookmarks, learning, devices', () => {
  it('bookmarks are private, unique and point at real published content', async () => {
    const org = await createOrg(); const opp = await createOpportunity(org); const hidden = await createOpportunity(org, { status: 'draft' });
    const alice = await createUser(); const bob = await createUser();
    await asUser(alice, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'opportunity', $2)`, [alice, opp]));
    await expect(asUser(alice, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'opportunity', $2)`, [alice, opp]))).rejects.toThrow(/duplicate key/);
    await expect(asUser(bob, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'opportunity', $2)`, [alice, opp]))).rejects.toThrow(/row-level security/);
    await expectFail(asUser(bob, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'opportunity', $2)`, [bob, hidden])), 404, 'bookmark_target_not_found');
    expect((await asUser(bob, (q) => q(`select * from public.bookmarks`))).rowCount).toBe(0);
    expect((await asUser(bob, (q) => q(`delete from public.bookmarks where user_id = $1`, [alice]))).rowCount).toBe(0);
    expect((await asUser(alice, (q) => q(`select * from public.bookmarks`))).rowCount).toBe(1);
  });

  it('course progress is computed by the server and cannot be written by the client', async () => {
    const course = randomUUID();
    await admin(`insert into public.courses (id, slug, title, summary, status, is_demo) values ($1, $2, 'Test Kursu', 'Özet', 'published', true)`, [course, `course-${course.slice(0, 8)}`]);
    const lessons = [randomUUID(), randomUUID(), randomUUID()];
    for (const [i, id] of lessons.entries()) {
      await admin(`insert into public.lessons (id, course_id, title, body, sort_order) values ($1, $2, $3, 'İçerik', $4)`, [id, course, `Ders ${i + 1}`, i + 1]);
    }
    expect((await admin(`select lesson_count from public.courses where id = $1`, [course])).rows[0].lesson_count).toBe(3);
    const user = await createUser();
    await expect(asUser(user, (q) => q(`insert into public.course_progress (user_id, course_id, percent) values ($1, $2, 100)`, [user, course]))).rejects.toThrow(/row-level security/);

    const complete = async (id: string) => (await asUser(user, (q) => q(`select * from public.complete_lesson($1)`, [id]))).rows[0];
    expect((await complete(lessons[0])).percent).toBe(33);
    expect((await complete(lessons[0])).percent).toBe(33); // repeat does not inflate
    expect((await complete(lessons[1])).percent).toBe(66);
    expect((await asUser(user, (q) => q(`update public.course_progress set percent = 100 where user_id = $1`, [user]))).rowCount).toBe(0);
    const done = await complete(lessons[2]);
    expect(done.percent).toBe(100);
    expect(done.completed_at).not.toBeNull();
    await expectFail(asUser(user, (q) => q(`select public.complete_lesson($1)`, [randomUUID()])), 404, 'lesson_not_found');
    expect((await asUser(await createUser(), (q) => q(`select * from public.course_progress`))).rowCount).toBe(0);
  });

  it('a device install keeps exactly one active push provider', async () => {
    const user = await createUser(); const install = `install-${randomUUID()}`;
    const reg = (p: string, t: string) => asUser(user, (q) => q(`select * from public.register_device($1, $2, $3, 'android')`, [install, p, t]));
    await reg('fcm', `fcm-token-${randomUUID()}`);
    await reg('hms', `hms-token-${randomUUID()}`);
    const rows = (await asUser(user, (q) => q(`select provider, is_active from public.devices where device_install_id = $1 order by created_at`, [install]))).rows;
    expect(rows).toEqual([{ provider: 'fcm', is_active: false }, { provider: 'hms', is_active: true }]);
    await expectFail(asUser(user, (q) => q(`select public.register_device($1, 'apns', 'apns-token-123456', 'android')`, [install])), 422, 'device_invalid');
  });
});

describe('seed data', () => {
  it('loads twice without error and yields the documented demo content', async () => {
    const seed = readFileSync(join(__dirname, '..', 'seed.sql'), 'utf8');
    await admin(seed); await admin(seed);
    const count = async (sql: string) => (await admin(sql)).rows[0].n as number;
    const demo = `id::text like '00000000-0000-4000-a00%'`;
    expect(await count(`select count(*)::int n from public.events where ${demo} and status = 'published' and is_demo`)).toBe(12);
    expect(await count(`select count(*)::int n from public.opportunities where ${demo} and is_demo`)).toBe(8);
    expect(await count(`select count(*)::int n from public.teams where ${demo} and is_demo`)).toBe(6);
    expect(await count(`select count(*)::int n from public.courses where ${demo} and is_demo`)).toBe(3);
    expect(await count(`select count(*)::int n from public.lessons l join public.courses c on c.id = l.course_id where c.${demo}`)).toBe(9);
    expect(await count(`select count(distinct type)::int n from public.events where ${demo}`)).toBe(8);
    expect(await count(`select count(distinct event_id)::int n from public.event_sessions where event_${demo}`)).toBeGreaterThanOrEqual(3);
    expect(await count(`select count(*)::int n from public.organizations where ${demo} and name !~ '^(Örnek|Intechne \\(demo\\))'`)).toBe(0);
    // anonymous discovery works against the seed exactly as through the API
    expect((await asAnon((q) => q(`select id from public.events where is_demo and id::text like '00000000-0000-4000-a001%'`))).rowCount).toBe(12);
  });
});
