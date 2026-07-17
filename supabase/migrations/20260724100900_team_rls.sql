-- Team foundation migration 10 of 11: RLS policies.
--
-- roles/permissions/role_permissions are deliberately global, not
-- Workspace-scoped (every Workspace shares the same role/permission
-- catalog) — the first tables in this schema without a workspace_id
-- column at all. Their `using (true)` select policies are a deliberate,
-- narrow exception to this codebase's "no bare using (true)" convention:
-- that convention exists to guard Workspace-isolated business data, which
-- these tables are not — they're non-sensitive reference data (role names,
-- permission keys/descriptions), and every policy is still scoped
-- `to authenticated`, so there is no anonymous access. No insert/update/
-- delete policy on any of the three — they're seeded once (migration 11)
-- and read-only to the app thereafter, the same "no write API, no write
-- policy" discipline as contract_templates.

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.workspace_invitations enable row level security;

create policy "roles_select_authenticated"
  on public.roles for select
  to authenticated
  using (true);

create policy "permissions_select_authenticated"
  on public.permissions for select
  to authenticated
  using (true);

create policy "role_permissions_select_authenticated"
  on public.role_permissions for select
  to authenticated
  using (true);

-- workspace_invitations: Workspace-scoped, gated on the team.invite
-- permission (owner/admin by default — see migration 11's matrix), not
-- mere membership. No delete policy — an invitation's history (pending/
-- accepted/expired/revoked) is permanent, the same reversibility
-- precedent as every other domain. Row-level insert authority beyond this
-- permission check (an admin may only invite manager/staff, never owner/
-- admin) is enforced by the trg_validate_invitation_role_authority trigger
-- (migration 7) — a single boolean RLS check can't express that
-- finer-grained rule on its own.
create policy "workspace_invitations_select_team_invite"
  on public.workspace_invitations for select
  to authenticated
  using (public.has_permission(workspace_id, 'team.invite'));

create policy "workspace_invitations_insert_team_invite"
  on public.workspace_invitations for insert
  to authenticated
  with check (public.has_permission(workspace_id, 'team.invite'));

create policy "workspace_invitations_update_team_invite"
  on public.workspace_invitations for update
  to authenticated
  using (public.has_permission(workspace_id, 'team.invite'))
  with check (public.has_permission(workspace_id, 'team.invite'));

-- workspace_members: replaces the Supabase Foundation phase's role-array
-- checks (has_workspace_role(workspace_id, array['owner','admin'])) with
-- the granular permission equivalents now that role_permissions exists —
-- functionally identical under the seeded default matrix (team.view is
-- granted to every role, team.manage_roles only to owner/admin), but
-- future roles/permission changes are now a data change here, not a
-- policy rewrite. Row-level protection beyond these checks (last-owner
-- protection, no non-owner may touch an owner's row) is enforced by the
-- trg_protect_workspace_owners trigger (migration 7).
drop policy if exists "workspace_members_select_fellow_member" on public.workspace_members;
create policy "workspace_members_select_team_view"
  on public.workspace_members for select
  to authenticated
  using (public.has_permission(workspace_id, 'team.view'));

drop policy if exists "workspace_members_insert_owner_admin" on public.workspace_members;
create policy "workspace_members_insert_team_manage_roles"
  on public.workspace_members for insert
  to authenticated
  with check (public.has_permission(workspace_id, 'team.manage_roles'));

drop policy if exists "workspace_members_update_owner_admin" on public.workspace_members;
create policy "workspace_members_update_team_manage_roles"
  on public.workspace_members for update
  to authenticated
  using (public.has_permission(workspace_id, 'team.manage_roles'))
  with check (public.has_permission(workspace_id, 'team.manage_roles'));

drop policy if exists "workspace_members_delete_owner_admin" on public.workspace_members;
create policy "workspace_members_delete_team_manage_roles"
  on public.workspace_members for delete
  to authenticated
  using (public.has_permission(workspace_id, 'team.manage_roles'));
