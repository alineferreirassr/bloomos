-- SOCIAL-06B — Inspiration & Reference Library data foundation. Purely
-- additive, purely schema: no repository, no Server Action, no UI, no AI,
-- no external fetching (SOCIAL-06C+ own those). See SOCIAL-06A's own
-- architecture-gate report for the full reasoning behind every decision
-- below — this migration implements exactly that design, nothing more.
--
-- ONE new table only. Deliberately does NOT build on `media_folders`/
-- `media_collections` (SOCIAL-06A's own finding: both are still fully
-- unmigrated mock-only infrastructure, and `media_collections.asset_ids`
-- is hard-typed to real MediaAsset rows anyway — an Inspiration reference
-- is not an uploaded asset). Deliberately does NOT add a
-- `platform_caption`/`full_caption`/`transcript`/`original_text`/
-- `source_text`/`verbatim_content` column of any kind — this is the exact
-- schema-level enforcement of the product's own "never store a copy of
-- the external wording" rule (SOCIAL-06A Phase 12): only the founder's
-- own structural observations (hook/cta/why_it_works/notes) are ever
-- persisted. Deliberately has no `status`/`is_archived`/`used_at` column —
-- `archived_at` alone is the entire workflow model, mirroring
-- `media_assets`/`media_folders`' own established "never physically
-- deleted, archived_at is the only state" convention exactly.

create table if not exists public.inspiration_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  title text not null,

  source_type text not null,
  -- The raw, founder-pasted URL, exactly as entered — never mutated.
  source_url text,
  -- Derived at write time from source_url by SOCIAL-06C's own pure
  -- normalization utility (lib/inspiration/normalizeUrl.ts) — this
  -- migration only reserves the column and its own idempotency index; it
  -- is never computed by a database trigger (no existing table in this
  -- schema uses one for a derived text column, and the transformation is
  -- pure application logic, not something SQL should own). NULL exactly
  -- when source_url is NULL — enforced by application code (SOCIAL-06C),
  -- never trusted from a browser-supplied value.
  normalized_source_url text,

  creator_name text,
  creator_handle text,
  platform_content_id text,

  content_format text,

  -- Founder-authored structural observations only — deliberately never a
  -- copy of the source's own wording (see this migration's own header).
  hook text,
  cta text,
  why_it_works text,
  notes text,

  duration_seconds integer,
  published_at timestamptz,

  -- Optional reference to a real, BloomOS-owned uploaded asset — never a
  -- duplicate binary store. The FK alone cannot prove this asset belongs
  -- to the same workspace as this Inspiration row (Postgres has no
  -- cross-table equality constraint short of a trigger this schema
  -- doesn't otherwise use for this purpose) — SOCIAL-06C's own repository
  -- layer must re-verify workspace ownership before ever accepting a
  -- caller-supplied media_asset_id, exactly like `validateOwnedApprovedImageAsset`
  -- already does for Social Posts. Mirrors `documents.media_asset_id`'s
  -- own exact `on delete set null` convention (20260722100000_documents.sql).
  media_asset_id uuid references public.media_assets (id) on delete set null,

  archived_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inspiration_items_source_type_check
    check (source_type in ('instagram', 'tiktok', 'youtube', 'pinterest', 'website', 'manual', 'other')),
  constraint inspiration_items_content_format_check
    check (content_format is null or content_format in ('reel', 'carousel', 'story', 'static', 'video', 'other')),
  constraint inspiration_items_duration_seconds_check
    check (duration_seconds is null or duration_seconds >= 0)
);

comment on table public.inspiration_items is
  'SOCIAL-06B — external/internal creative reference material a workspace member saves for study (Instagram/TikTok/YouTube/Pinterest/website/manual). Never stores a copy of the source''s own wording — only founder-authored structural observations (hook/cta/why_it_works/notes). archived_at is the only lifecycle state; rows are never physically deleted.';
comment on column public.inspiration_items.normalized_source_url is
  'Derived from source_url by SOCIAL-06C''s pure normalization utility (lowercased hostname, tracking params stripped, fragment/trailing-slash removed) — the real workspace-scoped duplicate-detection key. NULL exactly when source_url is NULL. Never trusted as a caller-supplied value.';
comment on column public.inspiration_items.media_asset_id is
  'Optional reference to an existing, BloomOS-owned MediaAsset — never a duplicated upload. Cross-workspace ownership is re-verified at the application layer (SOCIAL-06C), not provable by this FK alone.';

create index if not exists inspiration_items_workspace_source_type_idx
  on public.inspiration_items (workspace_id, source_type);
create index if not exists inspiration_items_workspace_archived_idx
  on public.inspiration_items (workspace_id, archived_at);
create index if not exists inspiration_items_workspace_created_idx
  on public.inspiration_items (workspace_id, created_at desc);

-- Duplicate protection (SOCIAL-06A Phase 7): a manual, URL-less,
-- content-id-less reference is always allowed — both indexes are partial,
-- scoped only to rows that actually carry the relevant value, so they
-- never restrict a manual entry.
create unique index if not exists inspiration_items_workspace_normalized_url_unique
  on public.inspiration_items (workspace_id, normalized_source_url)
  where normalized_source_url is not null;
create unique index if not exists inspiration_items_workspace_source_content_id_unique
  on public.inspiration_items (workspace_id, source_type, platform_content_id)
  where platform_content_id is not null;

drop trigger if exists trg_inspiration_items_set_updated_at on public.inspiration_items;
create trigger trg_inspiration_items_set_updated_at
  before update on public.inspiration_items
  for each row execute function public.set_updated_at();

alter table public.inspiration_items enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id).
-- SOCIAL-06A's own permission-model finding (re-verified fresh this
-- checkpoint): no `inspiration.*` or `social.manage` permission exists or
-- is created here — the real permission set remains exactly
-- social.view/social.create/social.publish, and SOCIAL-06C's own Server
-- Action layer is where social.view (read) / social.create (create/edit/
-- archive) actually gate access, matching every other Social action's own
-- established split (RLS enforces workspace isolation, application code
-- enforces role/permission — never the reverse). No DELETE policy — an
-- Inspiration row is never physically deleted, archived_at is the only
-- lifecycle state, mirroring social_posts' own "no delete policy" precedent
-- exactly.
create policy "inspiration_items_select_workspace_member"
  on public.inspiration_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "inspiration_items_insert_workspace_member"
  on public.inspiration_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "inspiration_items_update_workspace_member"
  on public.inspiration_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
