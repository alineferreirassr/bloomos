-- Team foundation migration 3 of 11: role_permissions.
--
-- The role -> permission default matrix, as data rather than code — the
-- entire point of splitting roles/permissions/role_permissions into three
-- tables instead of one. Adding a permission to a role (or a future role
-- entirely) is a data change here, never an RLS rewrite. A pure join table
-- (composite PK, no independent lifecycle) — no surrogate id, no
-- updated_at; a grant either exists or it doesn't, it isn't edited in
-- place.
--
-- Member-specific permission overrides (a grant/revoke narrower than the
-- member's role) are deliberately NOT implemented in this phase — nothing
-- in Phase 2's foundation scope requires them, and adding an unused
-- override table now would be speculative. Documented as future scope in
-- docs/permissions.md if/when a concrete need arises.

create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

comment on table public.role_permissions is
  'The role -> permission default grant matrix. Global, not Workspace-scoped. Seeded once (migration 11) with the canonical owner/admin/manager/staff matrix — see docs/permissions.md.';

create index if not exists role_permissions_permission_id_idx on public.role_permissions (permission_id);
