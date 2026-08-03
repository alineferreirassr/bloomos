-- Client Accounts + Invitations foundation migration 3 of 8: permission
-- catalog extension.
--
-- Extends the existing global `permissions`/`role_permissions` catalog
-- (Team foundation) with 4 new granular permissions governing internal
-- management of Client Portal access — never a new, parallel permission
-- system. Mirrors the `team.*` matrix precedent exactly: the broad "can
-- see" permission (clients.portal_view) is granted to every role, same as
-- team.view; the three management actions are owner/admin-only by
-- default, same as team.invite/team.manage_roles/team.deactivate — a
-- future role can be granted clients.portal_suspend independently of
-- clients.portal_manage without a further RLS change, since the two are
-- already modeled as distinct permissions (see migration 8's trigger).

insert into public.permissions (id, description) values
  ('clients.portal_view', 'View Client Portal accounts and invitations'),
  ('clients.portal_invite', 'Create and manage Client Portal invitations'),
  ('clients.portal_manage', 'Revoke or reactivate a Client Portal account'),
  ('clients.portal_suspend', 'Suspend or reactivate a Client Portal account')
on conflict (id) do nothing;

-- owner/admin: every permission (already granted every existing
-- permission via `select id from permissions`, but that insert already
-- ran in the Team foundation seed migration — re-grant explicitly here so
-- this migration is self-contained and idempotent regardless of when it
-- runs relative to future permission additions).
insert into public.role_permissions (role_id, permission_id) values
  ('owner', 'clients.portal_view'),
  ('owner', 'clients.portal_invite'),
  ('owner', 'clients.portal_manage'),
  ('owner', 'clients.portal_suspend'),
  ('admin', 'clients.portal_view'),
  ('admin', 'clients.portal_invite'),
  ('admin', 'clients.portal_manage'),
  ('admin', 'clients.portal_suspend')
on conflict do nothing;

-- manager/staff: view-only, same as team.view — no invite/manage/suspend
-- authority by default.
insert into public.role_permissions (role_id, permission_id) values
  ('manager', 'clients.portal_view'),
  ('staff', 'clients.portal_view')
on conflict do nothing;
