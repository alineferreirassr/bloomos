-- Supabase Foundation — migration 4 of 8: workspace_members.
--
-- Join table between auth.users and workspaces, carrying role + status.
-- Unique on (workspace_id, user_id) — a user has exactly one membership row
-- per Workspace. `status = 'suspended'` is expected to fail every RLS
-- membership check (see is_workspace_member()/has_workspace_role() in
-- migration 6) without needing a separate "is this account disabled"
-- concept.

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_members_role_check check (role in ('owner', 'admin', 'manager', 'team', 'viewer')),
  constraint workspace_members_status_check check (status in ('active', 'invited', 'suspended')),
  constraint workspace_members_workspace_user_unique unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Membership + role of a user within a Workspace. Unique on (workspace_id, user_id). A suspended member must not access Workspace data — see docs/permissions.md.';

create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
