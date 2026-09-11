-- INTEGRATIONS-PERMISSIONS-01 — seeds the existing `integrations.*`
-- permission family (v2.0 Checkpoint 43 — External Integrations Platform,
-- src/core/enums/permission.ts) into the live `permissions`/`role_permissions`
-- tables. These 13 permissions were added to the TypeScript Permission enum
-- at Checkpoint 43 but no migration ever seeded them — mock mode never
-- noticed, since permissionMatrix.ts grants owner/admin the full enum array
-- directly, but every live Supabase-mode workspace (including the founder's
-- own) has had zero rows for any of them, blocking beginProviderOAuthConnectionAction's
-- `integrations.connect` gate for every role, including owner.
--
-- This is the exact same systemic gap 20260915100100_social_permissions.sql's
-- own comment already documented (owner/admin's original
-- 20260724101000_team_seed_data.sql grants are a one-time snapshot that
-- never auto-covers a later-added permission) — discovered again here, not
-- introduced here. This migration only guarantees these 13 permissions are
-- correctly, completely seeded; it does not attempt to repair the rest of
-- the historical backlog, which spans permissions unrelated to Integrations.
--
-- Role matrix, mechanically derived from permissionMatrix.ts (the
-- established single source of truth for mock mode): owner and admin get
-- `PERMISSIONS` — the complete enum array, including all 13 of these.
-- manager and staff appear nowhere near "integrations" in that file at
-- all — the existing authorization model grants them none of this family.
-- This migration mirrors that split exactly; it does not invent new policy.
insert into public.permissions (id, description) values
  ('integrations.view', 'View the Integrations Connection Center'),
  ('integrations.manage', 'Install/uninstall a provider and edit its connection configuration'),
  ('integrations.connect', 'Begin a provider OAuth connection'),
  ('integrations.disconnect', 'Disconnect or revoke an existing provider connection'),
  ('integrations.logs', 'View integration diagnostics and audit trail'),
  ('integrations.webhooks', 'Manage webhook endpoints and deliveries'),
  ('integrations.payments', 'Perform payments-category integration actions (e.g. create a Stripe payment link)'),
  ('integrations.calendar', 'Perform calendar-category integration actions'),
  ('integrations.email', 'Send approved email through a connected email provider'),
  ('integrations.messaging', 'Perform messaging-category integration actions'),
  ('integrations.storage', 'Perform storage-category integration actions'),
  ('integrations.signatures', 'Perform e-signature-category integration actions'),
  ('integrations.sensitive', 'View a connection''s real external account identity/scopes')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('owner', 'integrations.view'), ('owner', 'integrations.manage'), ('owner', 'integrations.connect'), ('owner', 'integrations.disconnect'),
  ('owner', 'integrations.logs'), ('owner', 'integrations.webhooks'), ('owner', 'integrations.payments'), ('owner', 'integrations.calendar'),
  ('owner', 'integrations.email'), ('owner', 'integrations.messaging'), ('owner', 'integrations.storage'), ('owner', 'integrations.signatures'),
  ('owner', 'integrations.sensitive'),
  ('admin', 'integrations.view'), ('admin', 'integrations.manage'), ('admin', 'integrations.connect'), ('admin', 'integrations.disconnect'),
  ('admin', 'integrations.logs'), ('admin', 'integrations.webhooks'), ('admin', 'integrations.payments'), ('admin', 'integrations.calendar'),
  ('admin', 'integrations.email'), ('admin', 'integrations.messaging'), ('admin', 'integrations.storage'), ('admin', 'integrations.signatures'),
  ('admin', 'integrations.sensitive')
on conflict do nothing;
