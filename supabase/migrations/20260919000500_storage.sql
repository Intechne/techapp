-- TechApp · 0005 storage: private buckets. Evidence files are never public; access is by
-- owner folder (<uid>/...) and short-lived signed URLs created for authorised reviewers server-side.
-- The automated test database has no `storage` schema, so this migration is a no-op there.
do $$
begin
  if to_regnamespace('storage') is null then
    return;
  end if;

  execute $sql$
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('evidence', 'evidence', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
      ('avatars', 'avatars', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
  $sql$;

  execute $sql$
    create policy evidence_owner_select on storage.objects for select to authenticated
      using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy evidence_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy evidence_owner_delete on storage.objects for delete to authenticated
      using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;

  execute $sql$
    create policy avatars_owner_select on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy avatars_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy avatars_owner_update on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  execute $sql$
    create policy avatars_owner_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $sql$;
  -- No anon policies and no cross-user read policy: reviewers and other users receive
  -- signed URLs minted by a server function after an authorisation check.
end $$;
