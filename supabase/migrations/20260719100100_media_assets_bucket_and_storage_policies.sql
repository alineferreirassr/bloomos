-- Media Library migration 2 of 6: dedicated Storage bucket + policies.
--
-- A new, dedicated private bucket — deliberately NOT the existing
-- `documents` bucket from the Supabase Foundation phase
-- (20260715150700_storage_buckets_and_policies.sql), which was provisioned
-- with the (still mock-only) Documents module specifically in mind. The
-- Media Library is designed to be completely independent of Documents, so
-- it gets its own bucket, even though the policy shape below is otherwise
-- identical.
--
-- Path convention: {workspace_id}/{owner_type}/{owner_id}/{media_asset_id}/
-- v{version}/{stored_filename} — see src/lib/media/mediaFile.ts's
-- generateStoragePath(). Private (public = false) — no anonymous read, no
-- permanent public URLs. All access is via short-lived signed URLs
-- (getMediaAssetDownloadUrl) or direct authenticated download/upload
-- through the repository, gated by these same policies.

insert into storage.buckets (id, name, public)
values ('media-assets', 'media-assets', false)
on conflict (id) do nothing;

-- media-assets/{workspace_id}/... — gated on Workspace membership, exactly
-- like the documents/avatars policies. The first path segment
-- (storage.foldername(name))[1] is the workspace_id.
create policy "media_assets_select_workspace_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media-assets'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "media_assets_insert_workspace_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media-assets'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "media_assets_update_workspace_member"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media-assets'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'media-assets'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "media_assets_delete_workspace_member"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media-assets'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
