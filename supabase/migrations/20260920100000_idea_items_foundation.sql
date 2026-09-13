-- SOCIAL-07B — Ideas data foundation. Purely additive, purely schema: no
-- repository, no Server Action, no UI, no AI, no Knowledge Graph runtime
-- behavior, no Tag persistence (SOCIAL-07C+ own those). See SOCIAL-07A's
-- own read-only architecture audit for the full reasoning behind every
-- decision below — this migration implements exactly that design, nothing
-- more.
--
-- ONE new table only. An Idea is an original Amoré Bloom content concept —
-- something that does not yet exist — never a copy or transformation of an
-- Inspiration reference. `source_inspiration_id` records only that an
-- Inspiration triggered the Idea, never any of its content. Deliberately
-- has no `content_pillar`/`due_at`/`client_id`/`event_id`/`lead_id`/
-- `idea_type`/`angle`/`why_it_works` column — SOCIAL-07A found no driving
-- use case or codebase precedent for any of them yet. Deliberately has no
-- `status` values beyond active/archived — `archived_at` plus `status`
-- together are the entire lifecycle model, mirroring
-- `inspiration_items`/`media_assets`' own established "never physically
-- deleted" convention exactly. Deliberately imposes no title uniqueness —
-- SOCIAL-07A confirmed no title/name-uniqueness precedent exists anywhere
-- in this schema, and Ideas may legitimately share a title.

create table if not exists public.idea_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  title text not null,
  description text not null,

  status text not null default 'active',

  -- Optional reference to the Inspiration that triggered this Idea. Never a
  -- copy operation — SOCIAL-07C's own repository/action layer must
  -- re-verify workspace ownership before ever accepting a caller-supplied
  -- source_inspiration_id, exactly like `validateOwnedMediaAssetReference`
  -- already does for Inspiration's own MediaAsset link.
  source_inspiration_id uuid references public.inspiration_items (id) on delete set null,

  content_format text,

  -- Founder-authored concept notes for Amoré Bloom's own not-yet-created
  -- output — never a description of an existing external artifact (that is
  -- Inspiration's own job).
  hook text,
  cta text,
  audience text,
  notes text,

  -- Optional reference to a real, BloomOS-owned uploaded asset — never a
  -- duplicate binary store. Mirrors `inspiration_items.media_asset_id`'s own
  -- exact `on delete set null` convention. Cross-workspace ownership
  -- validation belongs to SOCIAL-07C, not this migration.
  media_asset_id uuid references public.media_assets (id) on delete set null,

  priority text,

  archived_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint idea_items_status_check
    check (status in ('active', 'archived')),
  constraint idea_items_priority_check
    check (priority is null or priority in ('low', 'normal', 'high')),
  constraint idea_items_content_format_check
    check (content_format is null or content_format in ('reel', 'carousel', 'story', 'static', 'video', 'other'))
);

comment on table public.idea_items is
  'SOCIAL-07B — an original Amoré Bloom content concept, optionally triggered by an Inspiration reference but never a copy of one. status is active/archived only, no destructive delete; archived_at is the archive timestamp.';
comment on column public.idea_items.source_inspiration_id is
  'Optional reference to the Inspiration item that triggered this Idea. Never copies Inspiration content. Cross-workspace ownership is re-verified at the application layer (SOCIAL-07C), not provable by this FK alone.';
comment on column public.idea_items.media_asset_id is
  'Optional reference to an existing, BloomOS-owned MediaAsset — never a duplicated upload. Cross-workspace ownership is re-verified at the application layer (SOCIAL-07C), not provable by this FK alone.';

create index if not exists idea_items_workspace_archived_idx
  on public.idea_items (workspace_id, archived_at);
create index if not exists idea_items_workspace_created_idx
  on public.idea_items (workspace_id, created_at desc);
create index if not exists idea_items_workspace_status_idx
  on public.idea_items (workspace_id, status);

drop trigger if exists trg_idea_items_set_updated_at on public.idea_items;
create trigger trg_idea_items_set_updated_at
  before update on public.idea_items
  for each row execute function public.set_updated_at();

alter table public.idea_items enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id).
-- SOCIAL-07A's own permission-model finding (re-verified fresh this
-- checkpoint): no new permission is created here — the real permission set
-- remains exactly social.view/social.create/social.publish, and
-- SOCIAL-07C's own Server Action layer is where social.view (read) /
-- social.create (create/edit/archive) actually gate access, matching
-- Inspiration's own established split (RLS enforces workspace isolation,
-- application code enforces role/permission — never the reverse). No
-- DELETE policy — an Idea row is never physically deleted, archived_at is
-- the only destructive-adjacent lifecycle state, mirroring
-- inspiration_items' own "no delete policy" precedent exactly.
create policy "idea_items_select_workspace_member"
  on public.idea_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "idea_items_insert_workspace_member"
  on public.idea_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "idea_items_update_workspace_member"
  on public.idea_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
