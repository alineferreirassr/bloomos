-- Team foundation migration 1 of 11: roles.
--
-- The canonical internal role catalog — owner/admin/manager/staff. A real
-- table (not just a CHECK constraint) so role_permissions (migration 3) can
-- FK against it and future roles can be added by inserting a row, not by
-- rewriting every RLS policy that mentions a role. `id` is the role slug
-- itself (stable, human-referenceable, already what workspace_members.role
-- stores as plain text) rather than a surrogate UUID — a role is a fixed
-- identity, not a business record with its own lifecycle.
--
-- Client Portal/Team Portal roles are explicitly out of scope for this
-- phase — see docs/permissions.md. Only the four internal roles below
-- exist today.

create table if not exists public.roles (
  id text primary key,
  name text not null,
  description text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_id_check check (id in ('owner', 'admin', 'manager', 'staff'))
);

comment on table public.roles is
  'Canonical internal Workspace role catalog (owner/admin/manager/staff). Global, not Workspace-scoped — every Workspace shares the same role definitions. Seeded once (migration 11), read-only to the app thereafter.';
