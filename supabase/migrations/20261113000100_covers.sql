-- TechApp · Faz 3b Task 3 (13 Kasım 2026) — cover images for events, opportunities and teams.
--
-- Path contract (bucket `covers`; public bucket = objects are served by URL, but listing/select through the API is owner-only):
--   events/<organization_id>/<uuid>.webp · opportunities/<organization_id>/<uuid>.webp · teams/<team_id>/<uuid>.webp
-- The first segment is the entity kind, the second is the OWNER folder (organisation or team id). The uploader produces two
-- files: the main image and a 640 px copy with the same name plus `-640` (`<uuid>-640.webp`). The thumbnail name is a client
-- convention only: the database stores the main path; clients derive the thumbnail by replacing `.webp` with `-640.webp`.
-- No image transformation service (paid plan feature). The bucket accepts image/webp only: clients (T4 admin, T5 mobile)
-- MUST re-encode every picture to WebP before upload, which also strips EXIF/GPS metadata from camera photos.
--
-- Who may write a folder (app.can_write_cover_folder — the same rule backs set_cover AND the storage policies):
--   events / opportunities → owner | admin | editor of that organisation · teams → an ACTIVE captain of that team ·
--   platform admin → every folder.
--
-- One write path: public.set_cover(). A trigger refuses any other write of cover_path / cover_blurhash. set_cover marks its own
-- UPDATE with the transaction-local setting app.cover_write = '<table>:<row id>' and clears it right after. API clients cannot
-- set a setting: PostgREST runs no client SQL, pg_catalog.set_config is not in an exposed schema, request headers / JWT claims
-- only populate request.*, and no public function passes a caller-chosen name to set_config (covers.test.ts checks this).
-- Defence in depth, independent of the flag: CHECK constraints pin the folder to the row's own owner, and the critical-field
-- re-review trigger (cover_path is critical) fires on any change of a published row.
--
-- Re-review (spec §4): cover_path joins app.event_critical_fields() / app.opportunity_critical_fields(), so the existing
-- app.rereview_on_critical_edit() trigger handles it — a published event/opportunity whose cover is set, replaced OR removed
-- by organisation staff gets a content_revisions row (approved snapshot incl. the old cover) and goes back to in_review.
-- Removal counts: the approved listing showed that image; what the public sees changes, and remove-then-set must not be a way
-- around review. Platform admins are the review (existing rule). cover_blurhash alone is not critical (a placeholder derived
-- from the image). Teams have no publish state; a team cover change is audited (ids only).
--
-- Storage objects are immutable: no UPDATE policy (no overwrite or rename in place, so an approved image cannot be swapped
-- under the same path). A file that a row currently uses (main or -640) can be neither deleted NOR uploaded again — for
-- anyone, platform admins included — so a bound path can never be (re)filled with a different image behind review's back.
-- With storage present, set_cover requires both files to exist, so a path cannot be bound first and filled after approval.
-- Listing / API select of `covers` objects is limited to the folder's writers; bound covers are still served by public URL.
--
-- Takedown (moderation, a parent's request, an organisation's request): ALWAYS two steps —
--   1. public.set_cover(<entity>, <id>, null) — clears the row (re-review / audit as usual; a platform admin's change is the
--      review), after which the files are no longer in use;
--   2. delete BOTH files (`<uuid>.webp`, `<uuid>-640.webp`) through the Storage API (never SQL DELETE on storage.objects).
--   The delete policy enforces the order: a file in use cannot be deleted.
--   CDN caveat: public URLs may be cached at the CDN / in clients (expo-image disk cache) for a while after the delete.
--
-- Orphan policy: the T4 (admin) and T5 (mobile) clients delete the old file pair through the Storage API after a successful
-- replace or remove. Files left behind (failed uploads, crashes) are removed by a scheduled cleanup that is NOT built yet:
-- an Edge Function on a schedule, using the Storage API (not SQL DELETE), deleting `covers` objects that are not in use
-- (app.cover_object_in_use) and older than 24 h. Target: Faz 6 ops (no Faz 3b task fits).
--
-- Deploy order: 20261112000300_hide_creator_columns MUST be applied BEFORE this file (held from staging until the
-- client-first rollout after the pilot). Its bulk `revoke select on public.teams from anon, authenticated` also revokes every
-- column-level SELECT on teams — including the cover_path / cover_blurhash grant below — so applying this file first (e.g.
-- out of order) would leave team covers unreadable. In file order (000300, then this) the grant survives.

-- ================================================================ 1. columns
alter table public.events
  add column cover_path text check (cover_path ~ '^(events|opportunities|teams)/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  add column cover_blurhash text check (char_length(cover_blurhash) between 6 and 100);
alter table public.opportunities
  add column cover_path text check (cover_path ~ '^(events|opportunities|teams)/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  add column cover_blurhash text check (char_length(cover_blurhash) between 6 and 100);
alter table public.teams
  add column cover_path text check (cover_path ~ '^(events|opportunities|teams)/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  add column cover_blurhash text check (char_length(cover_blurhash) between 6 and 100);

-- The folder is the row's own owner, whatever path the write took (tenants are locked: events/opportunities organization_id
-- cannot change; a team's folder is its own id).
alter table public.events
  add constraint events_cover_own_folder check (cover_path is null or cover_path like 'events/' || organization_id::text || '/%'),
  add constraint events_cover_blurhash_needs_path check (cover_path is not null or cover_blurhash is null);
alter table public.opportunities
  add constraint opportunities_cover_own_folder check (cover_path is null or cover_path like 'opportunities/' || organization_id::text || '/%'),
  add constraint opportunities_cover_blurhash_needs_path check (cover_path is not null or cover_blurhash is null);
alter table public.teams
  add constraint teams_cover_own_folder check (cover_path is null or cover_path like 'teams/' || id::text || '/%'),
  add constraint teams_cover_blurhash_needs_path check (cover_path is not null or cover_blurhash is null);

-- teams has column-level SELECT grants once 20261112000300 is applied; new columns must be granted explicitly
-- (pilot-privacy.test.ts). Covers are public content, like the name and tagline.
grant select (cover_path, cover_blurhash) on public.teams to anon, authenticated;

-- ================================================================ 2. helpers (shared by set_cover and the storage policies)
-- Strict object name: kind / owner uuid / file uuid [-640] .webp — lowercase, exactly three segments.
create or replace function app.cover_object_pattern() returns text
language sql immutable set search_path = '' as $$
  select '^(events|opportunities|teams)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
         '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-640)?\.webp$';
$$;

create or replace function app.can_write_cover_folder(p_kind text, p_folder uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and p_folder is not null and (
    app.is_platform_admin()
    or (p_kind in ('events', 'opportunities')
        and app.has_org_role(p_folder, array['owner', 'admin', 'editor']::public.org_member_role[]))
    or (p_kind = 'teams' and app.is_team_captain(p_folder)));
$$;

-- Storage policy check for an object name: well-formed and inside a folder the caller may write.
create or replace function app.can_write_cover_object(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare m text[] := regexp_match(p_name, app.cover_object_pattern());
begin
  if m is null then return false; end if;
  return app.can_write_cover_folder(m[1], m[2]::uuid);
end $$;

-- True when a row currently uses this object as its cover (the main file or its -640 copy).
create or replace function app.cover_object_in_use(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  with p as (select regexp_replace(p_name, '-640\.webp$', '.webp') as main)
  select exists (select 1 from public.events e, p where e.cover_path = p.main)
      or exists (select 1 from public.opportunities o, p where o.cover_path = p.main)
      or exists (select 1 from public.teams t, p where t.cover_path = p.main);
$$;

-- Not callable by the API roles except where a storage policy needs it (policies run with the caller's privileges).
revoke execute on function app.cover_object_pattern(), app.can_write_cover_folder(text, uuid),
  app.can_write_cover_object(text), app.cover_object_in_use(text) from public, anon;
grant execute on function app.can_write_cover_object(text), app.cover_object_in_use(text) to authenticated;

-- ================================================================ 3. one write path
create or replace function app.guard_cover_columns() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.cover_path is null and new.cover_blurhash is null then return new; end if;
  elsif new.cover_path is not distinct from old.cover_path and new.cover_blurhash is not distinct from old.cover_blurhash then
    return new;
  end if;
  -- Set only by public.set_cover, for exactly this row, inside its own transaction. No role is exempt.
  if coalesce(current_setting('app.cover_write', true), '') = tg_table_name || ':' || new.id::text then
    return new;
  end if;
  perform app.fail(403, 'cover_write_forbidden');
  return null;
end $$;
-- "cover_guard" sorts before *_protect / *_rereview / *_status_machine / *_touch: a forbidden write fails first.
revoke execute on function app.guard_cover_columns() from public, anon;
create trigger events_cover_guard before insert or update on public.events
  for each row execute function app.guard_cover_columns();
create trigger opportunities_cover_guard before insert or update on public.opportunities
  for each row execute function app.guard_cover_columns();
create trigger teams_cover_guard before insert or update on public.teams
  for each row execute function app.guard_cover_columns();

-- ================================================================ 4. critical fields (re-review reuses the existing trigger)
create or replace function app.event_critical_fields() returns text[] language sql immutable set search_path = '' as $$
  select array['type', 'format', 'city', 'venue', 'online_url', 'starts_at', 'ends_at', 'timezone',
               'registration_opens_at', 'registration_closes_at', 'requires_review', 'registration_mode',
               'min_age', 'max_age', 'guardian_required_under', 'fee_minor_units', 'cancellation_policy',
               'cover_path'];
$$;
create or replace function app.opportunity_critical_fields() returns text[] language sql immutable set search_path = '' as $$
  select array['type', 'city', 'is_remote', 'min_age', 'max_age', 'guardian_required_under',
               'opens_at', 'closes_at', 'shared_fields', 'cover_path'];
$$;

-- ================================================================ 5. set_cover
-- p_entity: 'events' | 'opportunities' | 'teams' (the path's first segment). p_path null = remove the cover.
create or replace function public.set_cover(p_entity text, p_entity_id uuid, p_path text, p_blurhash text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;  -- the folder the path must be in: organisation id (events/opportunities) or team id (teams)
  v_org uuid;    -- for the audit row
  v_old_path text; v_old_blur text;
  v_blur text := p_blurhash;
  m text[];
  v_missing int;
  v_kind text;
begin
  if v_uid is null then perform app.fail(401, 'auth_required'); end if;
  if p_entity is null or p_entity not in ('events', 'opportunities', 'teams') then
    perform app.fail(422, 'cover_entity_invalid');
  end if;

  if p_entity = 'events' then
    select e.organization_id, e.organization_id, e.cover_path, e.cover_blurhash into v_owner, v_org, v_old_path, v_old_blur
      from public.events e where e.id = p_entity_id for update;
  elsif p_entity = 'opportunities' then
    select o.organization_id, o.organization_id, o.cover_path, o.cover_blurhash into v_owner, v_org, v_old_path, v_old_blur
      from public.opportunities o where o.id = p_entity_id for update;
  else
    select t.id, t.organization_id, t.cover_path, t.cover_blurhash into v_owner, v_org, v_old_path, v_old_blur
      from public.teams t where t.id = p_entity_id for update;
  end if;
  if v_owner is null then perform app.fail(404, 'cover_target_not_found'); end if;
  -- Removing is a write too: the same people.
  if not app.can_write_cover_folder(p_entity, v_owner) then perform app.fail(403, 'cover_forbidden'); end if;

  if p_path is null then
    if p_blurhash is not null then perform app.fail(422, 'cover_blurhash_invalid'); end if;
  else
    m := regexp_match(p_path, app.cover_object_pattern());
    if m is null or m[3] is not null then perform app.fail(422, 'cover_path_invalid'); end if; -- -640 copies are never bound
    -- the folder must be this entity's kind AND this entity's owner (not merely a folder the caller may write)
    if m[1] <> p_entity or m[2]::uuid <> v_owner then perform app.fail(403, 'cover_path_forbidden'); end if;
    if v_blur is not null and v_blur !~ '^[0-9A-Za-z#$%*+,.:;=?@\[\]^_{|}~-]{6,100}$' then
      perform app.fail(422, 'cover_blurhash_invalid');
    end if;
    -- Both files must already be uploaded (to this bucket), or a path could be bound now and filled after approval.
    -- The automated test database has no storage schema; there this check is skipped.
    if to_regclass('storage.objects') is not null then
      execute 'select count(*) from unnest($1::text[]) n
                where not exists (select 1 from storage.objects o where o.bucket_id = ''covers'' and o.name = n)'
        into v_missing using array[p_path, regexp_replace(p_path, '\.webp$', '-640.webp')];
      if v_missing > 0 then perform app.fail(409, 'cover_upload_missing'); end if;
    end if;
  end if;

  if p_path is not distinct from v_old_path and v_blur is not distinct from v_old_blur then return; end if;

  perform set_config('app.cover_write', p_entity || ':' || p_entity_id::text, true);
  if p_entity = 'events' then
    update public.events set cover_path = p_path, cover_blurhash = v_blur where id = p_entity_id;
  elsif p_entity = 'opportunities' then
    update public.opportunities set cover_path = p_path, cover_blurhash = v_blur where id = p_entity_id;
  else
    update public.teams set cover_path = p_path, cover_blurhash = v_blur where id = p_entity_id;
  end if;
  perform set_config('app.cover_write', '', true);

  v_kind := case p_entity when 'events' then 'event' when 'opportunities' then 'opportunity' else 'team' end;
  -- ids only (actor, target, organisation): no path, no blurhash, no names
  perform app.audit('user', v_kind || case when p_path is null then '.cover_removed' else '.cover_set' end,
                    v_kind, p_entity_id, v_org);
end $$;
revoke execute on function public.set_cover(text, uuid, text, text) from public, anon;
grant execute on function public.set_cover(text, uuid, text, text) to authenticated;

-- ================================================================ 6. storage: public bucket + folder-owner policies
-- The automated test database has no storage schema, so this block is a no-op there (covers.test.ts runs the block below
-- against a rolled-back stand-in; staging is checked by supabase/tests/remote/security-regression.sql 22–22g).
-- covers-storage:begin
do $$
begin
  if to_regnamespace('storage') is null then
    return;
  end if;

  execute $sql$
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('covers', 'covers', true, 2097152, array['image/webp'])
    on conflict (id) do update
      set public = true,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
  $sql$;

  -- Select/list only for the folder's writers (needed for upload responses and owner listing). Anyone else reaches a bound
  -- cover through the bucket's public URL, which does not go through these policies; nobody can enumerate the bucket.
  execute $sql$
    create policy covers_owner_select on storage.objects for select to authenticated
      using (bucket_id = 'covers' and app.can_write_cover_object(name))
  $sql$;
  -- A name that a row uses cannot be uploaded again (after any deletion of it), so a bound path is never refilled.
  execute $sql$
    create policy covers_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'covers' and app.can_write_cover_object(name) and not app.cover_object_in_use(name))
  $sql$;
  -- No UPDATE policy on purpose: objects are immutable (upload with upsert = false; a new image = a new uuid).
  -- Takedown = set_cover(..., null) first, then delete (see header). No exception for platform admins: the row is always
  -- cleared before its files disappear.
  execute $sql$
    create policy covers_owner_delete on storage.objects for delete to authenticated
      using (bucket_id = 'covers' and app.can_write_cover_object(name) and not app.cover_object_in_use(name))
  $sql$;
end $$;
-- covers-storage:end
