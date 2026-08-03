-- Team foundation migration 11 of 11: seed role/permission/role_permission
-- data.
--
-- The canonical default matrix (docs/permissions.md has the full
-- narrative). Owner and admin share the same permission grants — the
-- meaningful difference between them (cannot promote to owner, cannot
-- remove/demote the last owner) is enforced by the
-- trg_protect_workspace_owners/trg_validate_invitation_role_authority
-- triggers (migration 7), not by withholding a permission that has no
-- owner-specific equivalent in this catalog. Manager gets real CRUD-ish
-- operational access across every business module except the two most
-- sensitive reversal-type actions (finance.refund); staff gets view-only
-- across the board — "permissions must be explicit," so nothing beyond
-- view is granted by default, matching the approved role model exactly.

insert into public.roles (id, name, description, sort_order) values
  ('owner', 'Owner', 'Full Workspace control, including roles, invitations, and billing-related settings. Cannot be removed or demoted by anyone else, and the last active owner can never be removed.', 0),
  ('admin', 'Admin', 'Broad operational access across every business module; may invite and manage manager/staff roles. Cannot promote anyone to owner or remove/demote the owner.', 1),
  ('manager', 'Manager', 'Operational access to leads, clients, events, contracts, finance, and documents. Cannot manage owners/admins or change Workspace-level security settings.', 2),
  ('staff', 'Staff', 'Limited, explicit operational access. No team-management access by default.', 3)
on conflict (id) do nothing;

insert into public.permissions (id, description) values
  ('workspace.view', 'View Workspace settings and profile'),
  ('workspace.manage', 'Manage Workspace-level settings'),
  ('team.view', 'View the Workspace team roster'),
  ('team.invite', 'Create and manage Workspace invitations'),
  ('team.manage_roles', 'Change a team member''s role or membership'),
  ('team.deactivate', 'Deactivate or reactivate a team member'),
  ('leads.view', 'View leads'),
  ('leads.create', 'Create leads'),
  ('leads.update', 'Update leads'),
  ('leads.archive', 'Archive leads'),
  ('clients.view', 'View clients'),
  ('clients.create', 'Create clients'),
  ('clients.update', 'Update clients'),
  ('clients.archive', 'Archive clients'),
  ('events.view', 'View events'),
  ('events.create', 'Create events'),
  ('events.update', 'Update events'),
  ('events.archive', 'Archive events'),
  ('contracts.view', 'View contracts'),
  ('contracts.create', 'Create contracts'),
  ('contracts.update', 'Update contracts'),
  ('contracts.lifecycle', 'Change a contract''s status/signature lifecycle'),
  ('finance.view', 'View invoices, payments, and expenses'),
  ('finance.create', 'Create invoices, payments, and expenses'),
  ('finance.update', 'Update invoices, payments, and expenses'),
  ('finance.refund', 'Issue payment refunds'),
  ('documents.view', 'View documents'),
  ('documents.create', 'Create documents'),
  ('documents.update', 'Update documents'),
  ('documents.archive', 'Archive documents')
on conflict (id) do nothing;

-- owner: every permission.
insert into public.role_permissions (role_id, permission_id)
select 'owner', id from public.permissions
on conflict do nothing;

-- admin: every permission (the owner/admin distinction is enforced by
-- trigger, not by withholding a permission — see migration comment above).
insert into public.role_permissions (role_id, permission_id)
select 'admin', id from public.permissions
on conflict do nothing;

-- manager: operational access to every business module, no team
-- management, no Workspace settings, no refunds.
insert into public.role_permissions (role_id, permission_id) values
  ('manager', 'workspace.view'),
  ('manager', 'team.view'),
  ('manager', 'leads.view'), ('manager', 'leads.create'), ('manager', 'leads.update'), ('manager', 'leads.archive'),
  ('manager', 'clients.view'), ('manager', 'clients.create'), ('manager', 'clients.update'), ('manager', 'clients.archive'),
  ('manager', 'events.view'), ('manager', 'events.create'), ('manager', 'events.update'), ('manager', 'events.archive'),
  ('manager', 'contracts.view'), ('manager', 'contracts.create'), ('manager', 'contracts.update'), ('manager', 'contracts.lifecycle'),
  ('manager', 'finance.view'), ('manager', 'finance.create'), ('manager', 'finance.update'),
  ('manager', 'documents.view'), ('manager', 'documents.create'), ('manager', 'documents.update'), ('manager', 'documents.archive')
on conflict do nothing;

-- staff: view-only across the board, plus seeing the team roster.
insert into public.role_permissions (role_id, permission_id) values
  ('staff', 'workspace.view'),
  ('staff', 'team.view'),
  ('staff', 'leads.view'),
  ('staff', 'clients.view'),
  ('staff', 'events.view'),
  ('staff', 'contracts.view'),
  ('staff', 'finance.view'),
  ('staff', 'documents.view')
on conflict do nothing;
