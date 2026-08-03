-- Team foundation migration 2 of 11: permissions.
--
-- The canonical permission catalog — granular action-level grants
-- (`team.invite`, `leads.create`, ...) rather than relying on role name
-- comparisons everywhere. This is what lets a future role be added, or an
-- existing role's grants be adjusted, by changing role_permissions data
-- (migration 3) instead of rewriting RLS policies across every business
-- table. `id` is the permission key itself (`module.action` shape),
-- matching how `roles.id` is the role slug itself.
--
-- Business-module RLS (leads/clients/events/contracts/finance/documents)
-- is NOT rewritten to consume this catalog in this phase — those tables
-- keep their existing Workspace-isolation-only policies unchanged. This
-- catalog exists so the team-management surface (and any future
-- permission-aware UI) has real data to key off, without redesigning
-- five modules' RLS in the same phase that introduces roles at all.

create table if not exists public.permissions (
  id text primary key,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.permissions is
  'Canonical granular permission catalog (module.action keys). Global, not Workspace-scoped. Seeded once (migration 11), read-only to the app thereafter.';
