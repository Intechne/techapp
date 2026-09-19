import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createEvent, createOrg, createUser, register } from './helpers';

const SENSITIVE = ['profiles', 'profile_private', 'profile_interests', 'organization_members', 'platform_admins', 'event_registrations',
  'event_check_ins', 'guardian_requests', 'consents', 'applications', 'application_status_history', 'team_memberships', 'team_tasks',
  'recruitment_applications', 'experiences', 'experience_evidence', 'attestations', 'course_progress', 'bookmarks', 'notifications',
  'devices', 'reports', 'moderation_actions', 'audit_events'];

describe('RLS audit', () => {
  it('every table in the public schema has row level security enabled', async () => {
    const { rows } = await admin(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('no SECURITY DEFINER function in public is callable without a pinned search_path', async () => {
    const { rows } = await admin(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it('an anonymous visitor reads nothing from any sensitive table, even when data exists', async () => {
    const org = await createOrg(); const event = await createEvent(org); const user = await createUser();
    await register(user, event);
    await asUser(user, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'event', $2)`, [user, event]));
    for (const table of SENSITIVE) {
      const result = await asAnon((q) => q(`select count(*)::int n from public.${table}`)).then((r) => r.rows[0].n, () => 'denied');
      expect([table, result === 'denied' ? 0 : result]).toEqual([table, 0]);
    }
  });

  it('a member manages only their own profile and bookmarks', async () => {
    const org = await createOrg(); const event = await createEvent(org);
    const alice = await createUser(); const bob = await createUser();
    await asUser(alice, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'event', $2)`, [alice, event]));
    expect((await asUser(alice, (q) => q(`update public.profiles set headline = 'Robotik meraklısı' where id = $1`, [alice]))).rowCount).toBe(1);
    expect((await asUser(bob, (q) => q(`update public.profiles set headline = 'ele geçirildi' where id = $1`, [alice]))).rowCount).toBe(0);
    expect((await asUser(bob, (q) => q(`delete from public.bookmarks where user_id = $1`, [alice]))).rowCount).toBe(0);
    await expect(asUser(bob, (q) => q(`insert into public.bookmarks (user_id, target_type, target_id) values ($1, 'event', $2)`, [alice, event]))).rejects.toThrow(/row-level security/);
    expect((await asUser(alice, (q) => q(`delete from public.bookmarks where user_id = $1`, [alice]))).rowCount).toBe(1);
  });

  it('nobody can mint a verification, a check-in, an org role or an admin seat by writing tables directly', async () => {
    const org = await createOrg(); const event = await createEvent(org); const user = await createUser();
    const reg = await register(user, event);
    const attempts = [
      [`insert into public.attestations (experience_id, organization_id, status) values (gen_random_uuid(), $1, 'verified')`, [org]],
      [`insert into public.event_check_ins (registration_id, checked_in_by) values ($1, $2)`, [reg.id, user]],
      [`insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [org, user]],
      [`insert into public.platform_admins (user_id) values ($1)`, [user]],
      [`insert into public.consents (user_id, purpose, policy_version, granted_by) values ($1, 'event_participation', 'x', 'guardian')`, [user]],
    ] as const;
    for (const [sql, params] of attempts) {
      await expect(asUser(user, (q) => q(sql, [...params])), sql).rejects.toThrow(/row-level security|permission denied/);
    }
  });
});
