-- SOCIAL-03 — social_posts: one real, persisted, workspace-scoped Social
-- Post, one platform (Meta), one Asset. Not a multi-platform composer, not
-- a scheduler (no scheduled_at — SOCIAL-04's own scope), not analytics.
--
-- asset_id references the existing, real media_assets table directly —
-- never a parallel Social media/upload system. target_connection_id
-- references the existing integration_connections row (the workspace's
-- Meta connection from SOCIAL-02) so a post always knows exactly which
-- connection it was created against, even if the workspace's currently
-- *selected* identity changes later — never implicitly re-resolved at
-- publish time.
--
-- Timeline integration is deliberately NOT wired for this table this
-- checkpoint (see SOCIAL03-AH's own explicit "report decision" allowance):
-- this row's own status/published_at/provider_error columns already carry
-- adequate lifecycle history for this checkpoint's scope, and adding it
-- would require a third migration (widening timeline_activities' own
-- owner_type CHECK constraint) beyond the two this checkpoint's own
-- migration budget calls for.
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,

  status text not null default 'draft',
  caption text not null default '',
  asset_id uuid not null references public.media_assets (id),

  target_provider text not null default 'meta',
  target_connection_id uuid not null references public.integration_connections (id),
  target_page_id text not null,
  target_instagram_account_id text not null,

  provider_container_id text,
  provider_post_id text,
  provider_permalink text,
  provider_error text,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint social_posts_status_check check (status in ('draft', 'publishing', 'published', 'failed')),
  constraint social_posts_target_provider_check check (target_provider = 'meta')
);

comment on table public.social_posts is
  'SOCIAL-03 — one Social Post, one Asset, one Meta/Instagram destination. Immediate publish only (no scheduled_at). asset_id/target_connection_id reference the existing media_assets/integration_connections tables directly — no parallel Social media or provider-connection system.';

create index if not exists social_posts_workspace_status_idx on public.social_posts (workspace_id, status);

drop trigger if exists trg_social_posts_set_updated_at on public.social_posts;
create trigger trg_social_posts_set_updated_at
  before update on public.social_posts
  for each row execute function public.set_updated_at();

alter table public.social_posts enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id), no
-- owner/admin role gating here (application-level social.view/social.create/
-- social.publish permission checks happen in the Server Action layer, not
-- in RLS — matching contracts/leads/clients/events' own established
-- division of responsibility). No delete policy — a Social Post is never
-- physically deleted by this checkpoint's own action set.
create policy "social_posts_select_workspace_member"
  on public.social_posts for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "social_posts_insert_workspace_member"
  on public.social_posts for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "social_posts_update_workspace_member"
  on public.social_posts for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
