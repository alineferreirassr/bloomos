-- Event Service Workspace (Checkpoint 10): widen media_assets' owner_type
-- CHECK constraint to accept 'event_service'.
--
-- notes/timeline_activities were already widened for 'service'/
-- 'event_service' back in 20260806101100_service_owner_type_widening.sql,
-- whose own comment explicitly deferred media_assets: "deliberately NOT
-- widened here — unlike every prior module, no Core Files/Attachments
-- front-door delegation exists yet for Services... deferred to whichever
-- future phase actually builds that delegation." This is that phase — the
-- Workspace's Attachments section needs a real MediaAsset owner_type to
-- attach reference material/invoices/images to a specific EventService.
--
-- Only 'event_service' is added, not 'service' — the catalog Service has
-- no Attachments UI being built in this checkpoint, so it isn't added
-- speculatively, matching src/lib/media/ownerTypes.ts's own documented
-- "never pre-populated speculatively" discipline.
--
-- src/lib/media/ownerTypes.ts's MEDIA_ASSET_OWNER_TYPES and
-- LIVE_MEDIA_ASSET_OWNER_TYPES get the matching one-line addition in the
-- same commit.
--
-- No table shape changes, no data migration — existing rows are unaffected.

alter table public.media_assets drop constraint media_assets_owner_type_check;
alter table public.media_assets add constraint media_assets_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'document', 'inventory_item', 'vendor', 'purchase', 'event_service'));
