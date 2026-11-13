-- TechApp · Faz 3b Task 7 fix round 1 (13 Kasım 2026) — managers decide recruitment applications knowing WHO applied, and
-- recruitment_posts.created_by can no longer be spoofed.
--
-- 1. public.team_recruitment_applications(p_post_id): what the Takım alanı > İlanlar tab shows. Before this, a captain accepted or
--    rejected an application blind (profiles of non-discoverable people are not readable, and team_roster only covers memberships).
--    Same visibility rule as the join-request flow: managers already see a requester's display_name and note through team_roster()
--    because the person asked to join. An applicant likewise consents by applying (the apply sheet says "Başvurduğunda takım
--    yöneticileri adını ve notunu görür."). Only active captains/mentors of the post's team (and platform admins, as for projects)
--    may call it; everyone else, an unknown post included, gets the same 403. It returns the display name, a server-computed
--    is_minor flag (app.age_years < 18; NO birth date counts as minor, like team_public_profile treats it as "not adult"), the
--    note, the status and the date. NEVER a user id, birth date or e-mail.
create or replace function public.team_recruitment_applications(p_post_id uuid)
returns table (application_id uuid, display_name text, is_minor boolean, message text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_team uuid;
begin
  select p.team_id into v_team from public.recruitment_posts p where p.id = p_post_id;
  if v_team is null or not (app.is_team_manager(v_team) or app.is_platform_admin()) then
    perform app.fail(403, 'team_manage_forbidden');
  end if;
  return query
    select a.id, pr.display_name, coalesce(app.age_years(a.user_id), 0) < 18, a.message, a.status::text, a.created_at
      from public.recruitment_applications a
      left join public.profiles pr on pr.id = a.user_id
     where a.post_id = p_post_id
       and a.status = 'submitted'  -- decided rows drop out, like rejected join requests leave team_roster
     order by a.created_at, a.id;
end $$;
revoke execute on function public.team_recruitment_applications(uuid) from public, anon;
grant execute on function public.team_recruitment_applications(uuid) to authenticated;

-- 2. recruitment_posts.created_by is the founder's identity (hidden from every client since 20261112000300) but the insert policy
--    only checked app.is_team_manager, so a manager could write someone else's uid over REST. Now: on INSERT an authenticated caller
--    gets their own uid whatever they sent (service role / migrations, where auth.uid() is NULL, keep the given value); on UPDATE the
--    column is immutable for API callers (auth.uid() set); the ON DELETE SET NULL of the user FK runs without a JWT and still clears it.
--    Column grants are unchanged.
create or replace function app.recruitment_post_creator() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then new.created_by := (select auth.uid()); end if;
  elsif (select auth.uid()) is not null then
    -- an API caller can neither change nor clear it; the user FK's ON DELETE SET NULL runs without a JWT (auth.uid() is NULL)
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
create trigger recruitment_posts_creator before insert or update on public.recruitment_posts
  for each row execute function app.recruitment_post_creator();
