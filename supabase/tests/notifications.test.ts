// Faz 3b Task 9 — in-app notifications (server): status triggers, 24 h reminder, read + preference RPCs, retention.
// Rules under test: copy lives on the server (app.notification_copy, one source for in-app and later push); the text never
// carries a person's name, e-mail or age (only the content title); one reminder per (user, event) ever; the only client
// write path is mark_notifications_read / set_notification_preferences.
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createEvent, createOrg, createUser, expectFail, register } from './helpers';

const KINDS = [
  'registration.confirmed', 'registration.promoted', 'registration.rejected', 'registration.expired', 'guardian.denied',
  'application.status_changed', 'team_join.accepted', 'team_join.rejected', 'team_join.requested',
  'event.reminder_24h', 'event.cancelled',
];
/** Letters only, so the "no digits (age) in the text" check below is meaningful. */
const tag = () => randomUUID().replace(/[^a-f]/g, '').slice(0, 6).padEnd(4, 'x');
const H = 36e5;

const notes = async (uid: string) =>
  (await admin(`select id, kind, title, body, target_type, target_id, read_at from public.notifications where user_id = $1 order by created_at, id`, [uid])).rows;
const kinds = async (uid: string) => (await notes(uid)).map((n) => n.kind);

async function guardianToken(minor: string, regId: string) {
  // unique recipient per call: the per-recipient guardian send limit is global and other test files share this database
  const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2, 'Ayşe Demir') id`, [regId, `veli-${randomUUID()}@example.test`]))).rows[0].id;
  const issued = (await asService((q) => q(`select public.issue_guardian_token($1) j`, [reqId]))).rows[0].j;
  const preview = (await asAnon((q) => q(`select public.guardian_request_preview($1) j`, [issued.token]))).rows[0].j;
  return { reqId: reqId as string, token: issued.token as string, policy: preview.policy_version as string };
}
const guardianDecide = (t: { token: string; policy: string }, approve: boolean) =>
  asAnon((q) => q(`select public.guardian_decide($1, $2, 'Ayşe Demir', $3)`, [t.token, approve, t.policy]));

async function createOpportunity(orgId: string) {
  const id = randomUUID();
  await admin(`insert into public.opportunities (id, organization_id, slug, title, summary, type, status, is_demo, closes_at, shared_fields)
               values ($1, $2, $3, 'Robotik Stajı', 'Özet', 'internship', 'published', true, now() + interval '7 days', '{display_name}')`,
              [id, orgId, `opp-${id.slice(0, 8)}`]);
  return id;
}
const createTeam = async (captain: string, name: string) =>
  (await asUser(captain, (q) => q(`select * from public.create_team($1)`, [name]))).rows[0].id as string;
const addMember = (team: string, uid: string, role: string) =>
  admin(`insert into public.team_memberships (team_id, user_id, role, status) values ($1, $2, $3, 'active')`, [team, uid, role]);
const requestJoin = async (uid: string, team: string) =>
  (await asUser(uid, (q) => q(`select * from public.request_team_join($1, 'Merhaba, ben de varım')`, [team]))).rows[0].id as string;
const queue = async () => (await admin(`select app.queue_event_reminders() n`)).rows[0].n as number;

describe('registration triggers', () => {
  it('pending_guardian → confirmed creates registration.confirmed for the participant only (no separate "guardian approved")', async () => {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 5 });
    const minor = await createUser({ age: 16, name: 'Elif Demir' });
    const reg = await register(minor, event);
    expect(reg.status).toBe('pending_guardian');
    await guardianDecide(await guardianToken(minor, reg.id), true);
    const rows = await notes(minor);
    expect(rows.map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['registration.confirmed', 'event_registration', reg.id]]);
    expect(rows[0].body).toContain('Test Etkinliği');
    // nobody else (no organiser, no guardian account) got a row about this registration or event
    expect((await admin(`select count(*)::int n from public.notifications where target_id in ($1, $2) and user_id <> $3`, [reg.id, event, minor])).rows[0].n).toBe(0);
    expect((await admin(`select count(*)::int n from public.notifications where kind like 'guardian.approv%'`)).rows[0].n).toBe(0);
  });

  it('guardian approval on a review event → nothing yet; organiser approval → one registration.confirmed', async () => {
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const event = await createEvent(org, { requires_review: true });
    const minor = await createUser({ age: 15 }); const reg = await register(minor, event);
    await guardianDecide(await guardianToken(minor, reg.id), true);
    expect((await admin(`select status from public.event_registrations where id = $1`, [reg.id])).rows[0].status).toBe('pending_review');
    expect(await kinds(minor)).toEqual([]);
    await asUser(reviewer, (q) => q(`select public.review_event_registration($1, true)`, [reg.id]));
    expect(await kinds(minor)).toEqual(['registration.confirmed']);
    expect(await kinds(reviewer)).toEqual([]);
  });

  it('guardian denial → guardian.denied only (the cancel it causes is not a second notification)', async () => {
    const org = await createOrg(); const event = await createEvent(org);
    const minor = await createUser({ age: 16 }); const reg = await register(minor, event);
    await guardianDecide(await guardianToken(minor, reg.id), false);
    const rows = await notes(minor);
    expect(rows.map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['guardian.denied', 'event_registration', reg.id]]);
  });

  it('guardian request expiry → registration.expired', async () => {
    const org = await createOrg(); const event = await createEvent(org);
    const minor = await createUser({ age: 16 }); const reg = await register(minor, event);
    const t = await guardianToken(minor, reg.id);
    await admin(`update public.guardian_requests set expires_at = now() - interval '1 minute' where id = $1`, [t.reqId]);
    await admin(`select app.expire_guardian_requests()`);
    expect(await kinds(minor)).toEqual(['registration.expired']);
  });

  it('organiser rejects a pending_review registration → registration.rejected', async () => {
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const event = await createEvent(org, { requires_review: true });
    const user = await createUser(); const reg = await register(user, event);
    await asUser(reviewer, (q) => q(`select public.review_event_registration($1, false, 'Kontenjan doldu')`, [reg.id]));
    expect(await kinds(user)).toEqual(['registration.rejected']);
  });

  it('waitlisted → confirmed creates registration.promoted (not registration.confirmed); self-service register/cancel create nothing', async () => {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 1, waitlist_enabled: true });
    const first = await createUser(); const second = await createUser();
    const r1 = await register(first, event); const r2 = await register(second, event);
    expect([r1.status, r2.status]).toEqual(['confirmed', 'waitlisted']);
    await asUser(first, (q) => q(`select public.cancel_event_registration($1)`, [r1.id]));
    expect((await notes(second)).map((n) => [n.kind, n.target_id])).toEqual([['registration.promoted', r2.id]]);
    expect(await kinds(first)).toEqual([]);
  });

  it('event cancelled → event.cancelled (target: the event) to every live registrant, not to people who already left', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createEvent(org, { capacity: 1, waitlist_enabled: true });
    const confirmed = await createUser(); const waiting = await createUser(); const gone = await createUser();
    const rGone = await register(gone, event);
    await asUser(gone, (q) => q(`select public.cancel_event_registration($1)`, [rGone.id]));
    await register(confirmed, event); await register(waiting, event);
    await asUser(owner, (q) => q(`update public.events set status = 'cancelled' where id = $1`, [event]));
    for (const u of [confirmed, waiting]) {
      expect((await notes(u)).map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['event.cancelled', 'event', event]]);
    }
    expect(await kinds(gone)).toEqual([]);
    expect(await kinds(owner)).toEqual([]);
  });

  it('a notification row outlives its target: the event goes away, the row keeps its text and stays readable (Review Focus 1)', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createEvent(org, { requires_review: true });
    const user = await createUser(); const reg = await register(user, event);
    await asUser(owner, (q) => q(`select public.review_event_registration($1, true)`, [reg.id]));
    const before = (await notes(user))[0];
    await asUser(owner, (q) => q(`update public.events set status = 'cancelled' where id = $1`, [event]));
    await admin(`update public.events set status = 'archived' where id = $1`, [event]);
    const mine = (await asUser(user, (q) => q(`select kind, title, body, target_type, target_id from public.notifications order by created_at, id`))).rows;
    expect(mine.map((n) => n.kind)).toEqual(['registration.confirmed', 'event.cancelled']);
    expect(mine[0]).toMatchObject({ title: before.title, body: before.body, target_id: reg.id });
  });
});

describe('application and team triggers', () => {
  it('organisation moves an application → application.status_changed (target: the application); applicant withdraw → nothing', async () => {
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const opp = await createOpportunity(org); const user = await createUser({ name: 'Başvuran Kişi' });
    const app = (await asUser(user, (q) => q(`select * from public.submit_application($1, $2, 'Öğrenmek istiyorum.')`, [opp, randomUUID()]))).rows[0];
    expect(await kinds(user)).toEqual([]);
    await asUser(reviewer, (q) => q(`select public.set_application_status($1, 'in_review')`, [app.id]));
    await asUser(reviewer, (q) => q(`select public.set_application_status($1, 'accepted')`, [app.id]));
    const rows = await notes(user);
    expect(rows.map((n) => [n.kind, n.target_type, n.target_id])).toEqual([
      ['application.status_changed', 'application', app.id], ['application.status_changed', 'application', app.id]]);
    expect(rows[0].body).toContain('Robotik Stajı');
    expect(await kinds(reviewer)).toEqual([]);

    const other = await createUser(); const opp2 = await createOpportunity(org);
    const app2 = (await asUser(other, (q) => q(`select * from public.submit_application($1, $2, null)`, [opp2, randomUUID()]))).rows[0];
    await asUser(other, (q) => q(`select public.withdraw_application($1)`, [app2.id]));
    expect(await kinds(other)).toEqual([]);
  });

  it('team join request → team_join.requested to the active captain and mentor only, with the team name and no requester name', async () => {
    const captain = await createUser({ age: 30 }); const name = `Bildirim Takımı ${tag()}`;
    const team = await createTeam(captain, name);
    const mentor = await createUser({ age: 28 }); await addMember(team, mentor, 'mentor');
    const member = await createUser(); await addMember(team, member, 'member');
    const formerMentor = await createUser(); await addMember(team, formerMentor, 'mentor');
    await admin(`update public.team_memberships set status = 'left' where team_id = $1 and user_id = $2`, [team, formerMentor]);
    const requester = await createUser({ age: 16, name: 'İsteyen Zeynep' });
    await requestJoin(requester, team);
    for (const u of [captain, mentor]) {
      const rows = await notes(u);
      expect(rows.map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['team_join.requested', 'team', team]]);
      expect(`${rows[0].title} ${rows[0].body}`).toContain(name);
      expect(`${rows[0].title} ${rows[0].body}`).not.toMatch(/Zeynep|İsteyen/);
    }
    for (const u of [member, formerMentor, requester]) expect(await kinds(u)).toEqual([]);
  });

  it('withdraw + request again while the manager has not read it → still one unread team_join.requested', async () => {
    const captain = await createUser(); const team = await createTeam(captain, `Tekrar Takımı ${tag()}`);
    const requester = await createUser();
    const m1 = await requestJoin(requester, team);
    await asUser(requester, (q) => q(`select public.withdraw_team_join($1)`, [m1]));
    await requestJoin(requester, team);
    expect(await kinds(captain)).toEqual(['team_join.requested']);
    await asUser(captain, (q) => q(`select public.mark_notifications_read()`));
    const m2 = (await admin(`select id from public.team_memberships where team_id = $1 and user_id = $2 and status = 'pending'`, [team, requester])).rows[0].id;
    await asUser(requester, (q) => q(`select public.withdraw_team_join($1)`, [m2]));
    await requestJoin(requester, team);
    expect(await kinds(captain)).toEqual(['team_join.requested', 'team_join.requested']); // read → a new request may notify again
  });

  it('captain accepts / rejects → team_join.accepted / team_join.rejected to the requester (target: the team)', async () => {
    const captain = await createUser(); const team = await createTeam(captain, `Karar Takımı ${tag()}`);
    const yes = await createUser(); const no = await createUser();
    const mYes = await requestJoin(yes, team); const mNo = await requestJoin(no, team);
    await asUser(captain, (q) => q(`select public.decide_team_join($1, true)`, [mYes]));
    await asUser(captain, (q) => q(`select public.decide_team_join($1, false)`, [mNo]));
    expect((await notes(yes)).map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['team_join.accepted', 'team', team]]);
    expect((await notes(no)).map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['team_join.rejected', 'team', team]]);
    expect(await kinds(captain)).toEqual(['team_join.requested']);
  });
});

describe('notification copy', () => {
  it('app.notification_kinds() is exactly the eleven kinds', async () => {
    expect((await admin(`select app.notification_kinds() k`)).rows[0].k).toEqual(KINDS);
  });

  it('every kind has a short Turkish title + body built only from the content title: no @, no exclamation, no name', async () => {
    const names = (await admin(`select display_name from public.profiles where display_name is not null`)).rows.map((r) => r.display_name as string);
    expect(names.length).toBeGreaterThan(5);
    for (const kind of KINDS) {
      const { rows } = await admin(`select * from app.notification_copy($1, 'Yaz Atölyesi')`, [kind]);
      expect([kind, rows.length]).toEqual([kind, 1]);
      const { title, body } = rows[0];
      expect([kind, title.length > 3 && title.length <= 120, body.length <= 400]).toEqual([kind, true, true]);
      expect([kind, `${title} ${body}`.includes('Yaz Atölyesi')]).toEqual([kind, true]);
      expect([kind, /[@!]/.test(`${title} ${body}`)]).toEqual([kind, false]);
      for (const n of names) expect([kind, n, `${title} ${body}`.includes(n)]).toEqual([kind, n, false]);
    }
  });

  it('an unknown kind is refused (no silent generic text); a very long content title is cut to fit', async () => {
    await expect(admin(`select * from app.notification_copy('team_join.approved_by_guardian', 'X')`)).rejects.toThrow(/notification_kind_unknown/);
    const { rows } = await admin(`select * from app.notification_copy('event.cancelled', repeat('a', 500))`);
    expect(rows[0].body.length).toBeLessThanOrEqual(400);
  });

  it('stored rows from every trigger path carry no display name, e-mail, age or digits', async () => {
    // a fresh run of several paths with recognisable names
    const reviewer = await createUser({ name: 'Değerlendiren Mert' }); const org = await createOrg({ [reviewer]: 'reviewer' });
    const event = await createEvent(org, { requires_review: true, title: 'Sahada Bir Gün' });
    const minor = await createUser({ age: 16, name: 'Küçük Deniz' }); const reg = await register(minor, event);
    await guardianDecide(await guardianToken(minor, reg.id), true);
    await asUser(reviewer, (q) => q(`select public.review_event_registration($1, true)`, [reg.id]));
    const captain = await createUser({ name: 'Kaptan Selin' }); const team = await createTeam(captain, `Gizlilik Takımı ${tag()}`);
    const m = await requestJoin(minor, team);
    await asUser(captain, (q) => q(`select public.decide_team_join($1, true)`, [m]));
    const rows = (await admin(`select n.user_id, n.title, n.body, p.display_name, u.email from public.notifications n
                                 join public.profiles p on p.id = n.user_id join auth.users u on u.id = n.user_id
                                where n.user_id = any ($1::uuid[])`, [[reviewer, minor, captain]])).rows;
    expect(rows.map((r) => r.title).sort()).toEqual(['Kaydın onaylandı.', 'Takıma katıldın.', 'Takımına katılmak isteyen var.']);
    const everyone = ['Değerlendiren Mert', 'Küçük Deniz', 'Kaptan Selin', 'Ayşe Demir', 'example.test'];
    for (const r of rows) {
      const text = `${r.title} ${r.body}`;
      for (const n of [...everyone, r.display_name, r.email, r.user_id]) expect([n, text.includes(n)]).toEqual([n, false]);
      expect(text).not.toMatch(/@|\d|yaş/i);
    }
  });
});

describe('event reminders', () => {
  async function remindFixture() {
    const org = await createOrg();
    const at = (h: number) => ({ starts_at: new Date(Date.now() + h * H), ends_at: new Date(Date.now() + (h + 3) * H), registration_closes_at: new Date(Date.now() + (h - 1) * H) });
    const inWindow = await createEvent(org, { ...at(24), title: 'Yarınki Atölye' });
    const tooSoon = await createEvent(org, { ...at(22.5) }); const tooLate = await createEvent(org, { ...at(25.5) });
    return { org, at, inWindow, tooSoon, tooLate };
  }

  it('confirmed registrations starting in 23–25 h get one reminder; running the job twice still one', async () => {
    const f = await remindFixture();
    const user = await createUser(); await register(user, f.inWindow); await register(user, f.tooSoon); await register(user, f.tooLate);
    expect(await queue()).toBeGreaterThanOrEqual(1);
    expect(await queue()).toBe(0);
    const rows = await notes(user);
    expect(rows.map((n) => [n.kind, n.target_type, n.target_id])).toEqual([['event.reminder_24h', 'event', f.inWindow]]);
    expect(rows[0].body).toContain('Yarınki Atölye');
  });

  it('only confirmed registrations on published events: waitlisted, pending, cancelled registrations and a cancelled event get none', async () => {
    const f = await remindFixture();
    const full = await createEvent(f.org, { ...f.at(24), capacity: 1, waitlist_enabled: true });
    const holder = await createUser(); const waiting = await createUser(); const minor = await createUser({ age: 16 });
    const leaver = await createUser();
    await register(holder, full); expect((await register(waiting, full)).status).toBe('waitlisted');
    expect((await register(minor, f.inWindow)).status).toBe('pending_guardian');
    const rl = await register(leaver, f.inWindow); await asUser(leaver, (q) => q(`select public.cancel_event_registration($1)`, [rl.id]));
    const owner = await createUser(); const org2 = await createOrg({ [owner]: 'owner' });
    const cancelled = await createEvent(org2, { ...f.at(24) }); const late = await createUser(); await register(late, cancelled);
    await asUser(owner, (q) => q(`update public.events set status = 'cancelled' where id = $1`, [cancelled]));
    await queue();
    expect(await kinds(holder)).toEqual(['event.reminder_24h']);
    for (const u of [waiting, minor, leaver]) expect(await kinds(u)).toEqual([]);
    expect(await kinds(late)).toEqual(['event.cancelled']);
  });

  it('event_reminders = false → no reminder, but transactional notifications still arrive', async () => {
    const f = await remindFixture();
    const user = await createUser();
    await asUser(user, (q) => q(`select public.set_notification_preferences(false)`));
    await register(user, f.inWindow);
    await queue();
    expect(await kinds(user)).toEqual([]);
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const reviewed = await createEvent(org, { requires_review: true }); const reg = await register(user, reviewed);
    await asUser(reviewer, (q) => q(`select public.review_event_registration($1, true)`, [reg.id]));
    expect(await kinds(user)).toEqual(['registration.confirmed']);
    await asUser(user, (q) => q(`select public.set_notification_preferences(true)`));
    await queue();
    expect(await kinds(user)).toEqual(['registration.confirmed', 'event.reminder_24h']);
  });

  it('starts_at moves into a new 23–25 h window after the reminder → no second reminder (same user, kind, target)', async () => {
    const f = await remindFixture();
    const user = await createUser(); await register(user, f.inWindow);
    await queue();
    // the organiser moves the event two days later, then it enters the window again
    await admin(`update public.events set starts_at = starts_at + interval '2 days', ends_at = ends_at + interval '2 days',
                 registration_closes_at = registration_closes_at + interval '2 days' where id = $1`, [f.inWindow]);
    await admin(`update public.events set starts_at = now() + interval '24 hours', ends_at = now() + interval '27 hours',
                 registration_closes_at = now() + interval '23 hours' where id = $1`, [f.inWindow]);
    await queue();
    expect(await kinds(user)).toEqual(['event.reminder_24h']);
    // the unique index itself holds even through app.notify (no error, still one)
    await admin(`select app.notify($1, 'event.reminder_24h', 'event', $2, 'Tekrar')`, [user, f.inWindow]);
    expect(await kinds(user)).toEqual(['event.reminder_24h']);
    // cancel + re-register (new registration id) does not reopen it either: the target is the event, not the registration
    const reg = (await admin(`select id from public.event_registrations where event_id = $1 and user_id = $2 and status = 'confirmed'`, [f.inWindow, user])).rows[0].id;
    await asUser(user, (q) => q(`select public.cancel_event_registration($1)`, [reg]));
    await register(user, f.inWindow);
    await queue();
    expect(await kinds(user)).toEqual(['event.reminder_24h']);
    const idx = (await admin(`select indexdef from pg_indexes where schemaname = 'public' and tablename = 'notifications' and indexname = 'notifications_one_reminder'`)).rows[0];
    expect(idx.indexdef).toMatch(/UNIQUE INDEX .*\(user_id, kind, target_id\) WHERE \(kind = 'event\.reminder_24h'::text\)/);
  });
});

describe('reading, marking, preferences', () => {
  async function twoUsersWithNotes() {
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const a = await createUser(); const b = await createUser();
    for (const u of [a, a, b]) {
      const ev = await createEvent(org, { requires_review: true }); const reg = await register(u, ev);
      await asUser(reviewer, (q) => q(`select public.review_event_registration($1, true)`, [reg.id]));
    }
    return { a, b };
  }

  it('a user cannot read another user’s notifications', async () => {
    const { a, b } = await twoUsersWithNotes();
    const seen = (await asUser(b, (q) => q(`select user_id from public.notifications`))).rows;
    expect(seen.length).toBe(1);
    expect(seen.every((r) => r.user_id === b)).toBe(true);
    expect((await asUser(b, (q) => q(`select count(*)::int n from public.notifications where user_id = $1`, [a]))).rows[0].n).toBe(0);
  });

  it('mark_notifications_read: own ids only (another user’s ids count 0 and stay unread); null = all own unread; idempotent', async () => {
    const { a, b } = await twoUsersWithNotes();
    const aIds = (await notes(a)).map((n) => n.id);
    expect((await asUser(b, (q) => q(`select public.mark_notifications_read($1::uuid[]) n`, [aIds]))).rows[0].n).toBe(0);
    expect((await notes(a)).every((n) => n.read_at === null)).toBe(true);
    expect((await asUser(a, (q) => q(`select public.mark_notifications_read($1::uuid[]) n`, [[aIds[0]]]))).rows[0].n).toBe(1);
    expect((await asUser(a, (q) => q(`select public.mark_notifications_read($1::uuid[]) n`, [[aIds[0]]]))).rows[0].n).toBe(0);
    expect((await asUser(a, (q) => q(`select public.mark_notifications_read() n`))).rows[0].n).toBe(1);
    expect((await asUser(a, (q) => q(`select public.mark_notifications_read('{}'::uuid[]) n`))).rows[0].n).toBe(0);
    expect((await notes(a)).every((n) => n.read_at !== null)).toBe(true);
    expect((await notes(b)).every((n) => n.read_at === null)).toBe(true);
  });

  it('the direct table path is closed: update / insert / delete → permission denied, never the raw notification_read_only', async () => {
    const { a } = await twoUsersWithNotes();
    const id = (await notes(a))[0].id;
    const attempts = [
      [`update public.notifications set read_at = now() where id = $1`, [id]],
      [`update public.notifications set title = 'Sahte' where id = $1`, [id]],
      [`delete from public.notifications where id = $1`, [id]],
      [`insert into public.notifications (user_id, kind, title) values ($1, 'registration.confirmed', 'Sahte')`, [a]],
    ] as const;
    for (const [sql, params] of attempts) {
      const err = await asUser(a, (q) => q(sql, [...params])).then(() => null, (e: { code?: string; message?: string }) => e);
      expect([sql, err?.code, err?.message === 'notification_read_only']).toEqual([sql, '42501', false]);
    }
    expect((await notes(a))[0]).toMatchObject({ id, read_at: null });
    expect((await admin(`select count(*)::int n from pg_policies where tablename = 'notifications' and cmd <> 'SELECT'`)).rows[0].n).toBe(0);
  });

  it('anon can neither read notifications nor call the RPCs', async () => {
    await expect(asAnon((q) => q(`select count(*) from public.notifications`))).rejects.toMatchObject({ code: '42501' });
    await expect(asAnon((q) => q(`select public.mark_notifications_read()`))).rejects.toMatchObject({ code: '42501' });
    await expect(asAnon((q) => q(`select public.set_notification_preferences(false)`))).rejects.toMatchObject({ code: '42501' });
    await expect(asAnon((q) => q(`select count(*) from public.notification_preferences`))).rejects.toMatchObject({ code: '42501' });
  });

  it('notification_preferences: own row only, written only through set_notification_preferences', async () => {
    const a = await createUser(); const b = await createUser();
    const row = (await asUser(a, (q) => q(`select * from public.set_notification_preferences(false)`))).rows[0];
    expect(row).toMatchObject({ user_id: a, event_reminders: false });
    expect((await asUser(a, (q) => q(`select * from public.set_notification_preferences(true)`))).rows[0].event_reminders).toBe(true);
    expect((await admin(`select count(*)::int n from public.notification_preferences where user_id = $1`, [a])).rows[0].n).toBe(1);
    expect((await asUser(a, (q) => q(`select event_reminders from public.notification_preferences`))).rows).toEqual([{ event_reminders: true }]);
    expect((await asUser(b, (q) => q(`select count(*)::int n from public.notification_preferences`))).rows[0].n).toBe(0);
    for (const sql of [
      `insert into public.notification_preferences (user_id, event_reminders) values ('${b}', false)`,
      `update public.notification_preferences set event_reminders = false where user_id = '${a}'`,
      `delete from public.notification_preferences where user_id = '${a}'`,
    ]) await expect(asUser(b, (q) => q(sql))).rejects.toMatchObject({ code: '42501' });
    await expectFail(asUser(a, (q) => q(`select public.set_notification_preferences(null)`)), 422, 'notification_preferences_invalid');
  });

  it('server helpers are not callable by API roles', async () => {
    const u = await createUser();
    for (const sql of [
      `select app.notify('${u}', 'event.cancelled', 'event', gen_random_uuid(), 'X')`,
      `select app.queue_event_reminders()`, `select app.prune_notifications()`,
      `select * from app.notification_copy('event.cancelled', 'X')`, `select app.notification_retention_days()`,
    ]) {
      await expect(asUser(u, (q) => q(sql))).rejects.toMatchObject({ code: '42501' });
      await expect(asService((q) => q(sql))).rejects.toMatchObject({ code: '42501' });
    }
  });
});

describe('retention + schedule', () => {
  it('prune deletes READ rows older than app.notification_retention_days(); keeps unread, recent and future-event reminders', async () => {
    const days = (await admin(`select app.notification_retention_days() d`)).rows[0].d as number;
    expect(days).toBeGreaterThan(0);
    const u = await createUser(); const org = await createOrg();
    const future = await createEvent(org); const past = randomUUID();
    const ins = (kind: string, target: string, ageDays: number, read: boolean) => admin(
      `insert into public.notifications (user_id, kind, title, target_type, target_id, created_at, read_at)
       values ($1, $2, 'Başlık', 'event', $3, now() - make_interval(days => $4), case when $5 then now() end) returning id`,
      [u, kind, target, ageDays, read]).then((r) => r.rows[0].id as string);
    const oldRead = await ins('event.cancelled', past, days + 1, true);
    const oldUnread = await ins('event.cancelled', randomUUID(), days + 1, false);
    const recentRead = await ins('event.cancelled', randomUUID(), days - 1, true);
    const oldReminderFuture = await ins('event.reminder_24h', future, days + 1, true);
    const oldReminderGone = await ins('event.reminder_24h', past, days + 1, true);
    expect((await admin(`select app.prune_notifications() n`)).rows[0].n).toBeGreaterThanOrEqual(2);
    const left = (await admin(`select id from public.notifications where user_id = $1`, [u])).rows.map((r) => r.id).sort();
    expect(left).toEqual([oldUnread, recentRead, oldReminderFuture].sort());
    expect(left).not.toContain(oldRead); expect(left).not.toContain(oldReminderGone);
  });

  it('the cron block is guarded (applies without pg_cron) and schedules both jobs where pg_cron exists', async () => {
    const dir = join(__dirname, '..', 'migrations');
    const file = readdirSync(dir).find((f) => f.endsWith('_notifications.sql'))!;
    const sql = readFileSync(join(dir, file), 'utf8');
    expect(sql).toMatch(/if not exists \(select 1 from pg_available_extensions where name = 'pg_cron'\)/);
    expect(sql).toContain(`cron.schedule('techapp-event-reminders', '*/15 * * * *', 'select app.queue_event_reminders()')`);
    expect(sql).toMatch(/cron\.schedule\('techapp-prune-notifications', '[^']+', 'select app\.prune_notifications\(\)'\)/);
    expect((await admin(`select count(*)::int n from pg_available_extensions where name = 'pg_cron'`)).rows[0].n).toBe(0); // embedded: no cron
  });
});
