-- Client Accounts + Invitations foundation migration 8 of 8: RLS policies.
--
-- Two distinct kinds of legitimate caller read/write these tables: an
-- internal team member managing Client Portal access for their Workspace
-- (gated by the new clients.portal_* permissions), and an external client
-- reading only their own client_accounts row(s) (gated by
-- auth_user_id = auth.uid()). Postgres evaluates multiple permissive
-- policies for the same command with OR semantics, so both are expressed
-- as separate policies rather than one combined boolean. No bare
-- `using (true)` anywhere; every policy is scoped `to authenticated` — an
-- anonymous request is rejected by every check below (the two
-- token-based RPCs, migration 5, are the only anonymous-reachable surface,
-- and they return only minimum-safe fields).

alter table public.client_accounts enable row level security;
alter table public.client_invitations enable row level security;

-- client_accounts: a client may select only their own row(s) — no
-- cross-client access, no anonymous enumeration.
create policy "client_accounts_select_own"
  on public.client_accounts for select
  to authenticated
  using (auth_user_id = auth.uid());

-- client_accounts: an internal team member with clients.portal_view may
-- select every account in their Workspace, to manage Client Portal access
-- from the Client Detail page.
create policy "client_accounts_select_team_portal_view"
  on public.client_accounts for select
  to authenticated
  using (public.has_permission(workspace_id, 'clients.portal_view'));

-- No insert policy: every client_accounts row is created exclusively by
-- accept_client_invitation (security definer, migration 5) — there is no
-- "add a Client Portal account directly" path for a team member or a
-- client to insert one via ordinary RLS-gated writes.
--
-- Update authority (activate/suspend/reactivate/revoke) is gated broadly
-- here by either portal-management permission; the finer distinction
-- (revoke/reactivate-from-revoked needs clients.portal_manage
-- specifically, suspend/reactivate-from-suspended needs either) is
-- enforced by trg_validate_client_account_action_authority (migration 6)
-- — the same "RLS gets you in the door, a trigger enforces the specific
-- rule" shape as workspace_members/trg_protect_workspace_owners. No
-- client-side update policy exists at all: a client can never modify
-- their own account's status directly, only through the token-validated
-- accept_client_invitation RPC (which bypasses RLS as a security definer
-- function). No delete policy — suspension/revocation is the terminal-
-- but-reversible state, never a physical delete.
create policy "client_accounts_update_team_portal_action"
  on public.client_accounts for update
  to authenticated
  using (public.has_permission(workspace_id, 'clients.portal_manage') or public.has_permission(workspace_id, 'clients.portal_suspend'))
  with check (public.has_permission(workspace_id, 'clients.portal_manage') or public.has_permission(workspace_id, 'clients.portal_suspend'));

-- client_invitations: internal-only, the same shape as
-- workspace_invitations — an external client never reads or writes this
-- table directly, only through the two token-based RPCs (migration 5).
-- No delete policy — an invitation's history is permanent for audit
-- purposes.
create policy "client_invitations_select_team_portal_view"
  on public.client_invitations for select
  to authenticated
  using (public.has_permission(workspace_id, 'clients.portal_view'));

create policy "client_invitations_insert_team_portal_invite"
  on public.client_invitations for insert
  to authenticated
  with check (public.has_permission(workspace_id, 'clients.portal_invite'));

create policy "client_invitations_update_team_portal_invite"
  on public.client_invitations for update
  to authenticated
  using (public.has_permission(workspace_id, 'clients.portal_invite'))
  with check (public.has_permission(workspace_id, 'clients.portal_invite'));
