-- SOCIAL-10C — Carousel Studio data foundation. Purely additive, purely
-- schema: no repository/action/UI logic, no AI, no publishing. See
-- SOCIAL-10A's own read-only audit (confirmed no Carousel domain existed)
-- and SOCIAL-10B's own architecture decision for the full reasoning behind
-- every choice below.
--
-- TWO new tables, deliberately mirroring script_items/script_blocks'
-- exact two-table parent+ordered-children shape — SOCIAL-10B's own
-- comparison against three possible slide-storage models (parent+children
-- rows / single-row JSONB array / another normalized shape) selected the
-- parent+children shape as the one consistent with this schema's own
-- repeated "typed columns over JSONB unless genuinely justified" house
-- style, and with every other ordered-child-content precedent in this
-- codebase (script_blocks).
--
-- carousel_items is the parent record (one per Carousel), mirroring
-- script_items' own top-level shape almost exactly: workspace_id, title,
-- status (active/archived only — no destructive delete), source_idea_id
-- (optional, ownership-checked at the application layer in a future
-- checkpoint, never copies Idea content or syncs with it — SOCIAL-10B's
-- own explicit "no automatic synchronization" decision), created_by/
-- created_at/updated_at/archived_at. Deliberately has no source_script_id
-- (SOCIAL-10B decided Carousel has no Script relationship at all — a
-- carousel-format Idea and a reel/video-format Idea are mutually exclusive
-- content_format values, so nothing flows from Script into Carousel), no
-- source_inspiration_id (the established "one hop back" chain is
-- Carousel → Idea → Inspiration, never a direct second-hop reference), no
-- media_asset_id (media lives on the slides, never the parent — a
-- Carousel's own visual content is its ordered slides, not itself), no
-- content_format/priority/notes/version fields (none justified by
-- SOCIAL-10B's own "content-outline composer, not a copy of Idea" purpose
-- decision).
--
-- carousel_slides is the ordered child-content table, scoped to
-- carousel_id directly — never through an intermediate "version" row,
-- unlike script_blocks (scoped to script_version_id). SOCIAL-10B explicitly
-- decided against any versioning layer for Carousel: Script's own version
-- model exists for a real, evidenced reason (an immutable, reproducible
-- snapshot once *published*, mirroring service_versions), and Carousel has
-- no publishing feature at all yet (SOCIAL-10B Section M), so the entire
-- premise for a version layer doesn't apply. Holds a single plain-text
-- `content` column (mirrors script_blocks' own minimalism — no title/body
-- split, no block "type") plus its own ordering (`sort_order`, same
-- convention as script_blocks_version_sort_idx) and exactly one optional
-- `media_asset_id` (SOCIAL-10B Section F: "one optional MediaAsset per
-- slide" — the simple nullable-FK pattern already used by
-- idea_items.media_asset_id/inspiration_items.media_asset_id, not the
-- heavier polymorphic owner_type/owner_id MediaAsset pattern, which would
-- need an unjustified schema widening for no benefit here). No unique
-- constraint on (carousel_id, sort_order) — mirrors script_blocks' own
-- precedent exactly (duplicate sort_order values are tolerated at the DB
-- layer; the application layer's own list ordering tie-breaks
-- deterministically on id, exactly like listScriptBlocks already does).
--
-- SOCIAL-10C's own explicit slide-DELETE decision (left open by
-- SOCIAL-10B, to be made here rather than via a later follow-up
-- migration): carousel_slides gets its own narrowly-scoped, workspace-
-- member-gated DELETE policy from the start, included in this same
-- migration. This mirrors the *eventual* shape SOCIAL-08D added to
-- script_blocks (20260922100000_script_blocks_delete_policy.sql) — the
-- exact same single-predicate policy, scoped to this table alone — but
-- included immediately here rather than left for a second migration,
-- since the precedent is already fully established and evidenced (SOCIAL-
-- 10B Section J), and this checkpoint's own authorization explicitly
-- instructs against needing a second migration merely to correct a
-- decision that could safely be made now. Removing a slide from an
-- ordered list is normal editing, not destructive deletion of the whole
-- Carousel — carousel_items itself gets no DELETE policy of any kind,
-- matching the archive-only convention every other parent content entity
-- in this schema already follows.

create table if not exists public.carousel_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  title text not null,

  status text not null default 'active',

  -- Optional reference to the Idea that triggered this Carousel. Never
  -- copies Idea content, never syncs. A future SOCIAL-10D Server Action
  -- must re-verify workspace ownership before ever accepting a
  -- caller-supplied source_idea_id, exactly like
  -- validateOwnedIdeaReference already does for Script's own Idea link.
  source_idea_id uuid references public.idea_items (id) on delete set null,

  archived_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint carousel_items_status_check
    check (status in ('active', 'archived'))
);

comment on table public.carousel_items is
  'SOCIAL-10C — the parent record for one Carousel, optionally triggered by an Idea but never a copy of one. status is active/archived only, no destructive delete; archived_at is the archive timestamp. Actual slide content lives in carousel_slides. No Script or Inspiration relationship (SOCIAL-10B).';
comment on column public.carousel_items.source_idea_id is
  'Optional reference to the Idea that triggered this Carousel. Never copies Idea content, never syncs. Cross-workspace ownership is re-verified at the application layer (a future SOCIAL-10D checkpoint), not provable by this FK alone.';

create index if not exists carousel_items_workspace_archived_idx
  on public.carousel_items (workspace_id, archived_at);
create index if not exists carousel_items_workspace_created_idx
  on public.carousel_items (workspace_id, created_at desc);
create index if not exists carousel_items_workspace_status_idx
  on public.carousel_items (workspace_id, status);

drop trigger if exists trg_carousel_items_set_updated_at on public.carousel_items;
create trigger trg_carousel_items_set_updated_at
  before update on public.carousel_items
  for each row execute function public.set_updated_at();

alter table public.carousel_items enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id). No new
-- permission is created here — social.view/social.create, matching
-- Idea/Script's own established split (read here, write inside a future
-- Server Action). No DELETE policy — a Carousel row is never physically
-- deleted, archived_at is the only destructive-adjacent lifecycle state.
create policy "carousel_items_select_workspace_member"
  on public.carousel_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "carousel_items_insert_workspace_member"
  on public.carousel_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "carousel_items_update_workspace_member"
  on public.carousel_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.carousel_slides (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid not null references public.carousel_items (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- Plain text only — no title/body split, no design metadata. Mirrors
  -- script_blocks' own minimalism exactly (this migration's own header
  -- comment explains why).
  content text not null default '',
  sort_order integer not null default 0,

  -- Exactly one optional MediaAsset per slide (SOCIAL-10B Section F). A
  -- slide may exist with no media — this is the same simple nullable-FK
  -- pattern idea_items.media_asset_id already uses, not the polymorphic
  -- owner_type/owner_id MediaAsset pattern.
  media_asset_id uuid references public.media_assets (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint carousel_slides_sort_order_check
    check (sort_order >= 0)
);

comment on table public.carousel_slides is
  'SOCIAL-10C — one ordered, plain-text content slide within a Carousel, scoped to carousel_id directly (no version layer — SOCIAL-10B decided Carousel needs no versioning). At most one optional media_asset_id per slide. No unique constraint on (carousel_id, sort_order) — mirrors script_blocks'' own tolerance of duplicate sort_order values; the application layer''s own list ordering tie-breaks deterministically on id.';
comment on column public.carousel_slides.media_asset_id is
  'At most one optional MediaAsset per slide (SOCIAL-10B Section F) — never multiple, never the polymorphic owner_type/owner_id MediaAsset pattern. A slide may exist with no media.';

create index if not exists carousel_slides_carousel_sort_idx
  on public.carousel_slides (carousel_id, sort_order);

drop trigger if exists trg_carousel_slides_set_updated_at on public.carousel_slides;
create trigger trg_carousel_slides_set_updated_at
  before update on public.carousel_slides
  for each row execute function public.set_updated_at();

alter table public.carousel_slides enable row level security;

create policy "carousel_slides_select_workspace_member"
  on public.carousel_slides for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "carousel_slides_insert_workspace_member"
  on public.carousel_slides for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "carousel_slides_update_workspace_member"
  on public.carousel_slides for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- SOCIAL-10C's own explicit slide-DELETE decision (see this migration's
-- own header comment) — the one physical deletion anywhere in Carousel
-- Studio, scoped to carousel_slides alone. Matches
-- script_blocks_delete_workspace_member's exact single-predicate shape.
create policy "carousel_slides_delete_workspace_member"
  on public.carousel_slides for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
