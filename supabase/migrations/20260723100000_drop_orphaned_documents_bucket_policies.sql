-- Phase 1 cleanup: drop the 4 orphaned storage.objects policies left
-- behind from the legacy 'documents' Storage bucket.
--
-- That bucket (supabase/migrations/20260715150700_storage_buckets_and_policies.sql)
-- was superseded by the Shared Media Library's 'media-assets' bucket and
-- deleted via the Storage API once confirmed empty, during the Documents
-- migration (see supabase/migrations/20260722100200_media_library_document_integration.sql's
-- own comment — Supabase's hosted Postgres rejects a direct
-- `delete from storage.buckets` inside a SQL migration, so the bucket row
-- itself was removed out-of-band; these 4 policies were left behind and
-- are now inert, matching zero rows since no bucket_id = 'documents' can
-- exist anymore).
--
-- This migration only drops policies. It does not touch storage.buckets,
-- the avatars or media-assets buckets, media_assets RLS, or any policy
-- belonging to an active bucket.

drop policy if exists "documents_select_workspace_member" on storage.objects;
drop policy if exists "documents_insert_workspace_member" on storage.objects;
drop policy if exists "documents_update_workspace_member" on storage.objects;
drop policy if exists "documents_delete_workspace_member" on storage.objects;
