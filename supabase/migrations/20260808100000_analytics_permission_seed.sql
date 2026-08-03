-- Checkpoint 15 (Executive Analytics Platform) — permission catalog
-- extension. Extends the existing global `permissions`/`role_permissions`
-- catalog (Team foundation) with a single new granular permission gating
-- the whole Analytics dashboard, never a new, parallel permission system.
--
-- Deliberately owner/admin/manager only, not granted to `staff` by
-- default — a departure from the broad "view" permissions granted to
-- every role (clients.view, finance.view, clients.portal_view, etc.),
-- reflecting this checkpoint's own explicit framing: "Analytics should
-- become the executive dashboard for Workspace owners." A future
-- Workspace can still grant `analytics.view` to `staff` via the ordinary
-- Team role-management UI — this migration only sets the *default*.
--
-- This migration is written but NOT applied to the linked remote Supabase
-- project this session — the checkpoint's own new domain (registered
-- metrics reading through existing, already-dual-mode modules) works
-- correctly against mock mode regardless; pushing new schema/seed data to
-- shared infrastructure needs explicit confirmation first, per this
-- session's own standing caution (see docs/analytics.md's own "Known
-- limitations").

insert into public.permissions (id, description) values
  ('analytics.view', 'View the Executive Analytics dashboard')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('owner', 'analytics.view'),
  ('admin', 'analytics.view'),
  ('manager', 'analytics.view')
on conflict do nothing;
