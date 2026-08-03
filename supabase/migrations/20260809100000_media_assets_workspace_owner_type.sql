-- v2.0 Checkpoint 25 (Digital Asset Management Platform): widen
-- media_assets' owner_type CHECK constraint to accept 'workspace'.
--
-- The Asset Library (Step 1) is a general-purpose file store — Brand Kits,
-- Templates, and other assets that don't belong to any single Client/Event/
-- Vendor row. 'workspace' is already a live EntityType used the same way by
-- Documents (see ownerLabelFor's own "case 'workspace': return 'Workspace'"
-- fallback); this migration gives MediaAsset the same option.
--
-- No table shape changes, no data migration — existing rows are unaffected.

alter table public.media_assets drop constraint media_assets_owner_type_check;
alter table public.media_assets add constraint media_assets_owner_type_check
  check (owner_type in ('lead', 'client', 'event', 'document', 'inventory_item', 'vendor', 'purchase', 'event_service', 'workspace'));
