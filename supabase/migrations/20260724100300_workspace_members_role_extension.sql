-- Team foundation migration 4 of 11: extend workspace_members.
--
-- Replaces the Foundation phase's placeholder role set
-- ('owner','admin','manager','team','viewer' — 'team' and 'viewer' were
-- never implemented, never referenced by any RLS policy or application
-- code beyond their own enum definition, and the live Workspace's only
-- membership row is 'owner') with the canonical four-role model this phase
-- actually implements: owner/admin/manager/staff. Adds a real FK to
-- public.roles so role_permissions joins are meaningful, on top of the
-- existing CHECK (kept for defense in depth — the same "belt and
-- suspenders" pattern the rest of this schema already uses for enum-like
-- columns).

-- Seed the four canonical roles here, ahead of migration 11's own seed
-- pass, so the foreign key below can validate against a live database that
-- already has real workspace_members rows (e.g. the Workspace's existing
-- 'owner' membership from the Foundation phase) — on a fresh/empty
-- database this would be a no-op either way, since there'd be no existing
-- rows for the constraint to check. Migration 11's own
-- `insert ... on conflict (id) do nothing` remains the canonical seed
-- reference and simply no-ops when it runs after this one.
insert into public.roles (id, name, description, sort_order) values
  ('owner', 'Owner', 'Full Workspace control, including roles, invitations, and billing-related settings. Cannot be removed or demoted by anyone else, and the last active owner can never be removed.', 0),
  ('admin', 'Admin', 'Broad operational access across every business module; may invite and manage manager/staff roles. Cannot promote anyone to owner or remove/demote the owner.', 1),
  ('manager', 'Manager', 'Operational access to leads, clients, events, contracts, finance, and documents. Cannot manage owners/admins or change Workspace-level security settings.', 2),
  ('staff', 'Staff', 'Limited, explicit operational access. No team-management access by default.', 3)
on conflict (id) do nothing;

alter table public.workspace_members drop constraint workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'manager', 'staff'));

alter table public.workspace_members add constraint workspace_members_role_fkey
  foreign key (role) references public.roles (id);
