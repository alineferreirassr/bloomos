-- Media Library migration 1 of 6: media_assets table.
--
-- The single reusable attachment system for BloomOS — every module (Lead,
-- Client, Event today; Document, Contract, Invoice, Payment, Expense, Team/
-- Client Knowledge Base Article, Notification, Automation in the future)
-- attaches files here via owner_type/owner_id, the same polymorphic pattern
-- already established by notes/timeline_activities/checklist_items. This
-- table represents storage objects only — pure reusable file metadata
-- (name, MIME type, size, checksum, storage location, version). It
-- deliberately carries no business-specific fields (no category, folder,
-- visibility, or workflow status — those belong to the *owning* record).
--
-- Mirrors src/types/mediaAsset.ts exactly.
--
-- owner_type is intentionally narrow today (lead/client/event only) —
-- only owner types with a live Supabase parent table are accepted, widened
-- one migration at a time exactly like notes/timeline_activities/
-- checklist_items. See src/lib/media/ownerTypes.ts for the full planned
-- owner-type set versus what's enforced here.
--
-- Versioning is in-place (version increments on the same row) rather than a
-- row chain — "replace version" updates this row's file_size/checksum/
-- mime_type/version, while the storage path embeds the version number so a
-- prior version's bytes are never overwritten in Storage even though only
-- the latest metadata row is kept. See docs/database.md for how this stays
-- additive-compatible with a future dedicated version-history table.
--
-- Soft delete only (archived_at) — no deleted_at, no physical DELETE from
-- the app; matches the Events table precedent (reversible via
-- restoreMediaAsset(), never a hard delete).

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  original_filename text not null,
  stored_filename text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  extension text not null,
  file_size bigint not null,
  checksum text not null,
  width integer,
  height integer,
  duration numeric,
  version integer not null default 1,
  uploaded_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint media_assets_owner_type_check check (owner_type in ('lead', 'client', 'event')),
  constraint media_assets_file_size_check check (file_size > 0),
  constraint media_assets_version_check check (version > 0)
);

comment on table public.media_assets is
  'Polymorphic, business-agnostic storage-object metadata shared across owner types (owner_type + owner_id) — pure file metadata, never business fields. Every query MUST filter by workspace_id together with owner_type/owner_id, never owner_id alone — see docs/database.md.';
