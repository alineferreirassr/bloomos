-- SOCIAL-03-FIX-B — completes the pre-existing, already-designed Media
-- Asset Approval Workflow (`MediaAssetStatus`, v2.0 Checkpoint 25, Step 9)
-- in Supabase mode. Every field added here already exists on the
-- `MediaAsset` TypeScript type and is already fully implemented against
-- the mock repository (`mockRepository.ts`'s own `setMediaAssetStatus`) —
-- this migration is purely additive persistence catch-up, not a new
-- domain concept. `approved_by` is `text`, not a foreign key: the
-- established, repo-wide convention for every other `approved_by` field
-- (see `lib/data/media/repository.ts`'s own doc comment on
-- `setMediaAssetStatus`, and the identical shape on
-- OperationalPlanning/ExecutionPackage/Allocation's own `approved_by`
-- fields) is a human-readable display-name/email string for the audit
-- trail, never a member id — the real member reference, when one exists,
-- is recorded separately as a Knowledge Graph `approved_by`/`rejected_by`
-- relationship edge, not a foreign key on this row.
--
-- Live media_assets row count was verified as 0 immediately before this
-- migration (SOCIAL-03-FIX-A's own audit, re-verified in this checkpoint's
-- own pre-apply gate) — no backfill statement is needed; every existing
-- (i.e. future) row simply gets the same 'pending' default every new
-- MediaAsset already starts at per the domain's own "never auto-approved"
-- rule.
--
-- Deliberately scoped to only the 4 approval columns Social and the
-- existing Approval Workflow UI actually need. The remaining Checkpoint-25
-- additive fields (folder_id, tags, color_label, priority, ai_ready,
-- version_notes, metadata) share the same not-yet-migrated gap but are not
-- blocking Social or the client-portal approval gate — out of this
-- checkpoint's authorized scope, left for a separate, lower-priority
-- migration.

alter table public.media_assets
  add column if not exists status text not null default 'pending',
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.media_assets drop constraint if exists media_assets_status_check;
alter table public.media_assets add constraint media_assets_status_check
  check (status in ('pending', 'approved', 'rejected', 'needs_revision'));

comment on column public.media_assets.status is
  'v2.0 Checkpoint 25 Step 9 / SOCIAL-03-FIX-B — approval workflow state. Every asset starts pending; never auto-approved. Mirrors MediaAssetStatus exactly.';
comment on column public.media_assets.approved_by is
  'Display name/email of the reviewer who last set status to approved/rejected/needs_revision — an audit-trail label, not a foreign key (mirrors this codebase''s established approved_by convention). Null while pending.';
comment on column public.media_assets.approved_at is
  'Instant status was last set to approved. Null unless status = approved.';
comment on column public.media_assets.rejection_reason is
  'Reviewer-supplied reason, set only for rejected/needs_revision. Null otherwise.';
