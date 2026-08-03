-- Documents migration 3 of 8: Media Library integration adjustments.
--
-- Widen media_assets_owner_type_check to add 'document', the owner type
-- src/lib/media/ownerTypes.ts's MEDIA_ASSET_OWNER_TYPES has reserved since
-- the Media Library foundation phase specifically for this migration. Same
-- one-migration-at-a-time widening discipline already established for
-- notes/timeline_activities/checklist_items.
--
-- Retiring the legacy 'documents' Storage bucket (provisioned in the
-- Foundation phase "for this future migration," superseded by the Media
-- Library's own 'media-assets' bucket — see migration 20260719100100's own
-- comment) is intentionally NOT done here: Supabase's hosted Postgres
-- rejects a direct `delete from storage.buckets` inside a SQL migration
-- ("Direct deletion from storage tables is not allowed. Use the Storage
-- API instead."). Bucket removal is handled as a separate Storage
-- administration step (Management API/CLI), after confirming the bucket
-- is unused, once every other migration in this set has applied — not a
-- SQL statement. No second Storage bucket is introduced by this migration
-- either way; every Document file lives in 'media-assets' from this phase
-- forward regardless of when 'documents' is actually removed.

alter table public.media_assets drop constraint media_assets_owner_type_check;
alter table public.media_assets add constraint media_assets_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'document'));
