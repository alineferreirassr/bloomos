-- SOCIAL-08B — Script Studio data foundation. Purely additive, purely
-- schema: no repository, no Server Action, no UI, no AI (SOCIAL-08C+ own
-- those). See SOCIAL-08A's own read-only architecture audit for the full
-- reasoning behind every decision below.
--
-- THREE new tables, mirroring the audit's own comparison of three real
-- versioning precedents in this schema:
--   1. mock-only version list (Document Templates) — not DB-backed, ruled
--      out immediately since this checkpoint requires real persistence.
--   2. immutable-snapshot-per-version with version-scoped child rows
--      (service_versions + its template tables).
--   3. row-chain with is_latest_version (documents).
-- Pattern 2 is the better fit here: a Script's ordered scene/block content
-- needs its own version-scoped set of child rows the same way a Service's
-- included items/checklist/timeline do, and "draft vs. published, at most
-- one draft, version_number stamped only at publish" maps directly onto
-- Script's own lifecycle with no adaptation needed. Pattern 3 (documents)
-- chains whole rows of a flat, mostly-scalar record — it has no analogous
-- child-row concept at all, so it does not fit an ordered block list.
--
-- script_items is the parent record (one per Script), mirroring
-- idea_items' own top-level shape exactly: workspace_id, title,
-- status (active/archived only — no destructive delete), source_idea_id
-- (optional, ownership-checked at the application layer, never copies Idea
-- content), created_by/created_at/updated_at/archived_at.
--
-- script_versions mirrors service_versions' own exact shape, trimmed to
-- only what this checkpoint's scope requires (no Service-specific fields
-- like price/duration/difficulty): draft is the one mutable version every
-- Script always has; published is permanent once reached (enforced today
-- only by the published-fields-consistency check + the one-draft-per-
-- script unique index, matching service_versions' own migration-time
-- enforcement — a later checkpoint owns any true immutability trigger).
-- version_number/published_at/published_by are null on every draft and
-- stamped together only at publish time. Script's own title is not
-- versioned in this foundation — it lives on script_items itself; no
-- driving use case for a per-version title snapshot has been identified
-- yet, unlike Service's name/description which the domain model already
-- required to vary per version.
--
-- script_blocks is the ordered child-content table, scoped to
-- script_version_id (never script_id directly) — mirrors the
-- Services template family's own display_order convention exactly. Holds
-- only a single plain-text `content` column and its own ordering; no
-- block "type" (scene/dialogue/voiceover/note) exists yet — Phase 3 of the
-- audit found no established block-type precedent to mirror, and the
-- actual editing UI is not this checkpoint's scope, so no speculative
-- classification column is added ahead of a real use case.
--
-- Deliberate departure from the Services precedent: unlike
-- service_included_items and its sibling template tables (which allow
-- DELETE while their parent version is still a draft), this checkpoint's
-- own explicit instruction is that NO table here gets a DELETE policy —
-- archive-only for script_items, and script_versions/script_blocks stay
-- append/update-only for now. A future editing checkpoint can add DELETE
-- there if a real "remove a block" workflow needs it.

create table if not exists public.script_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  title text not null,

  status text not null default 'active',

  -- Optional reference to the Idea that triggered this Script. Never
  -- copies Idea content — SOCIAL-08C's own repository/action layer must
  -- re-verify workspace ownership before ever accepting a caller-supplied
  -- source_idea_id, exactly like `validateOwnedInspirationReference`
  -- already does for Idea's own Inspiration link.
  source_idea_id uuid references public.idea_items (id) on delete set null,

  archived_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint script_items_status_check
    check (status in ('active', 'archived'))
);

comment on table public.script_items is
  'SOCIAL-08B — the parent record for one Script, optionally triggered by an Idea but never a copy of one. status is active/archived only, no destructive delete; archived_at is the archive timestamp. Actual script content lives in script_versions/script_blocks.';
comment on column public.script_items.source_idea_id is
  'Optional reference to the Idea that triggered this Script. Never copies Idea content. Cross-workspace ownership is re-verified at the application layer (SOCIAL-08C), not provable by this FK alone.';

create index if not exists script_items_workspace_archived_idx
  on public.script_items (workspace_id, archived_at);
create index if not exists script_items_workspace_created_idx
  on public.script_items (workspace_id, created_at desc);
create index if not exists script_items_workspace_status_idx
  on public.script_items (workspace_id, status);

drop trigger if exists trg_script_items_set_updated_at on public.script_items;
create trigger trg_script_items_set_updated_at
  before update on public.script_items
  for each row execute function public.set_updated_at();

alter table public.script_items enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id). No new
-- permission is created here — social.view/social.create, matching
-- Idea/Inspiration's own established split (read here, write inside each
-- future Server Action). No DELETE policy — a Script row is never
-- physically deleted, archived_at is the only destructive-adjacent
-- lifecycle state.
create policy "script_items_select_workspace_member"
  on public.script_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "script_items_insert_workspace_member"
  on public.script_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "script_items_update_workspace_member"
  on public.script_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.script_versions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.script_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  status text not null default 'draft',
  -- Null on every draft — no release identity yet. Stamped, permanently,
  -- only at publish time, mirroring service_versions' exact convention.
  version_number integer,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint script_versions_status_check
    check (status in ('draft', 'published')),
  constraint script_versions_version_number_check
    check (version_number is null or version_number > 0),
  -- Published-only fields: a draft has none of these set, a published
  -- version has all of them set — enforced together, mirroring
  -- service_versions' own published_fields_consistency_check exactly.
  constraint script_versions_published_fields_consistency_check check (
    (status = 'draft' and version_number is null and published_at is null and published_by is null)
    or
    (status = 'published' and version_number is not null and published_at is not null and published_by is not null)
  )
);

comment on table public.script_versions is
  'SOCIAL-08B — one draft-or-published version of a Script''s content, mirroring service_versions'' own immutable-snapshot lifecycle. version_number/published_at/published_by are null on every draft and stamped together only at publish time. Ordered content lives in script_blocks, scoped to script_version_id.';

create index if not exists script_versions_script_created_idx
  on public.script_versions (script_id, created_at desc);

-- Mirrors service_versions' own two concurrency-safety invariants exactly:
-- a version_number, once assigned, is never reused for this Script, and at
-- most one draft may exist per Script at a time.
create unique index if not exists script_versions_script_number_unique
  on public.script_versions (script_id, version_number)
  where version_number is not null;
create unique index if not exists script_versions_one_draft_per_script
  on public.script_versions (script_id)
  where status = 'draft';

drop trigger if exists trg_script_versions_set_updated_at on public.script_versions;
create trigger trg_script_versions_set_updated_at
  before update on public.script_versions
  for each row execute function public.set_updated_at();

alter table public.script_versions enable row level security;

create policy "script_versions_select_workspace_member"
  on public.script_versions for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "script_versions_insert_workspace_member"
  on public.script_versions for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "script_versions_update_workspace_member"
  on public.script_versions for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.script_blocks (
  id uuid primary key default gen_random_uuid(),
  script_version_id uuid not null references public.script_versions (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- Plain text only — no block "type" yet (see this migration's own header
  -- comment) and never HTML/rich content.
  content text not null default '',
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint script_blocks_sort_order_check
    check (sort_order >= 0)
);

comment on table public.script_blocks is
  'SOCIAL-08B — one ordered, plain-text content block within a script_versions row. Scoped to script_version_id (never script_id directly), mirroring the Services template family''s own display_order convention. No block-type column yet — no established precedent to mirror and no editing UI in this checkpoint''s scope.';

create index if not exists script_blocks_version_sort_idx
  on public.script_blocks (script_version_id, sort_order);

drop trigger if exists trg_script_blocks_set_updated_at on public.script_blocks;
create trigger trg_script_blocks_set_updated_at
  before update on public.script_blocks
  for each row execute function public.set_updated_at();

alter table public.script_blocks enable row level security;

create policy "script_blocks_select_workspace_member"
  on public.script_blocks for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "script_blocks_insert_workspace_member"
  on public.script_blocks for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "script_blocks_update_workspace_member"
  on public.script_blocks for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
