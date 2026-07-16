-- Supabase Foundation — migration 8 of 8: Storage buckets + policies.
--
-- Both buckets are private (public = false) — no anonymous read, no public
-- URLs, ever. Future access is expected to go entirely through short-lived
-- signed URLs generated per-request (docs/permissions.md, docs/integrations.md).
-- No upload UI exists yet and no Documents metadata is migrated to Supabase
-- in this phase — these buckets and policies are infrastructure only.
--
-- Path conventions (relative to the bucket root — storage.objects.name does
-- not repeat the bucket name as a path segment):
--   documents bucket: {workspace_id}/{owner_type}/{owner_id}/{document_id}/{file_name}
--   avatars bucket:    {user_id}/{file_name}

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- documents/{workspace_id}/... — gated on Workspace membership. The first
-- path segment (storage.foldername(name))[1] is the workspace_id.
create policy "documents_select_workspace_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_insert_workspace_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_update_workspace_member"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "documents_delete_workspace_member"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- avatars/{user_id}/... — gated on the requesting user owning that folder.
create policy "avatars_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
