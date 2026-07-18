-- Client Accounts + Invitations foundation migration 6 of 8: account-access
-- helper function and action-authority trigger.
--
-- is_client_account_holder() is the Client Portal's direct analog of
-- is_workspace_member() — same security definer/stable/search_path shape,
-- same recursion rationale. Not consumed by any business-module RLS
-- policy yet (Leads/Clients/Events/Contracts/Finance/Documents remain
-- Workspace-isolation-only this phase, unchanged), but is built now, as
-- this phase's "minimal client-visible helper required for safe access,"
-- so a future Client Portal phase's own RLS can reuse it directly rather
-- than re-deriving the same check.
create or replace function public.is_client_account_holder(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_accounts
    where client_id = p_client_id
      and auth_user_id = auth.uid()
      and status = 'active'
  );
$$;

comment on function public.is_client_account_holder(uuid) is
  'True iff the current auth.uid() holds an active Client Portal account for the given Client. The Client Portal analog of is_workspace_member().';

-- Enforces, at the database level, the finer-grained rule RLS' single
-- permission check on client_accounts (migration 8) can't express on its
-- own: a suspend/reactivate-from-suspended transition requires either
-- clients.portal_suspend or clients.portal_manage, but a revoke or
-- reactivate-from-revoked transition requires clients.portal_manage
-- specifically — the same "RLS gets you in the door, a trigger enforces
-- the specific rule" shape as trg_validate_invitation_role_authority.
-- Under the seeded default matrix owner/admin hold both permissions, so
-- this distinction is dormant today but ready for a future role that
-- holds one without the other.
--
-- Deliberately bypassed when accept_client_invitation is doing the
-- update: that function reactivates a suspended/revoked row on behalf of
-- the CLIENT accepting their own invitation (auth.uid() = the client's
-- own id, who by definition has no workspace_members row and therefore
-- no has_permission() grant at all) — this is a system-authorized
-- transition, not a team member's action, so it must not be judged by
-- the same authority rule. accept_client_invitation sets a transaction-
-- local flag immediately before its UPDATE for exactly this purpose; the
-- flag resets automatically at transaction end and is never persisted.
create or replace function public.validate_client_account_action_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requires_manage boolean;
begin
  if coalesce(current_setting('bloomos.skip_client_account_authority_check', true), 'false') = 'true' then
    return new;
  end if;

  v_requires_manage := (new.status = 'revoked') or (old.status = 'revoked' and new.status = 'active');

  if v_requires_manage then
    if not public.has_permission(new.workspace_id, 'clients.portal_manage') then
      raise exception 'You do not have permission to revoke or reactivate this Client Portal account.' using errcode = 'P0111';
    end if;
  elsif old.status is distinct from new.status then
    if not (public.has_permission(new.workspace_id, 'clients.portal_suspend') or public.has_permission(new.workspace_id, 'clients.portal_manage')) then
      raise exception 'You do not have permission to change this Client Portal account''s status.' using errcode = 'P0112';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.validate_client_account_action_authority() is
  'BEFORE UPDATE trigger on client_accounts: a revoke or reactivate-from-revoked transition requires clients.portal_manage; a suspend/reactivate-from-suspended transition requires clients.portal_suspend or clients.portal_manage.';

drop trigger if exists trg_validate_client_account_action_authority on public.client_accounts;
create trigger trg_validate_client_account_action_authority
  before update on public.client_accounts
  for each row execute function public.validate_client_account_action_authority();

-- No RLS update policy exists for a client on their own client_accounts
-- row at all (migration 8) — self-service status changes are never
-- permitted, only the token-validated accept_client_invitation. This one
-- narrowly-scoped security definer function is the sole exception, and it
-- only ever touches last_access_at: never status, never email, never any
-- other column. Ignores any caller-supplied id entirely — it always
-- updates the caller's own active row(s), identified purely by auth.uid(),
-- so there is no way to pass another account's id and touch it instead.
create or replace function public.touch_client_account_last_access()
returns void
language sql
security definer
set search_path = public
as $$
  update public.client_accounts
  set last_access_at = now()
  where auth_user_id = auth.uid()
    and status = 'active';
$$;

comment on function public.touch_client_account_last_access() is
  'Security definer: updates last_access_at on the caller''s own active client_accounts row(s) only. The sole write a Client Portal user may ever perform on this table directly.';

revoke all on function public.touch_client_account_last_access() from public;
grant execute on function public.touch_client_account_last_access() to authenticated;

-- The Client Portal landing page's one data need this foundation phase:
-- the caller's own account plus the two display names it requires.
-- Business-module RLS on `clients` is Workspace-isolation-only this phase
-- (unchanged — see docs/permissions.md), so an ordinary client caller has
-- no RLS path to read even their own `clients` row directly; this
-- narrowly-scoped security definer function is the sole, minimal
-- exception, identical in spirit to touch_client_account_last_access()
-- (looks up only auth.uid()'s own row, never a caller-supplied id).
-- Prefers an active row if the caller holds several (see
-- client_accounts_workspace_client_user_unique).
create or replace function public.get_current_client_account_context()
returns table (
  account_id uuid,
  workspace_name text,
  client_name text,
  status text,
  last_access_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select ca.id, w.name, trim(c.first_name || ' ' || c.last_name), ca.status, ca.last_access_at
  from public.client_accounts ca
  join public.workspaces w on w.id = ca.workspace_id
  join public.clients c on c.id = ca.client_id
  where ca.auth_user_id = auth.uid()
  order by (ca.status = 'active') desc, ca.created_at asc
  limit 1;
end;
$$;

comment on function public.get_current_client_account_context() is
  'Security definer: returns the caller''s own client_accounts row (preferring an active one) joined with the display-safe Client/Workspace names the landing page needs. Never exposes any internal-only Client field.';

revoke all on function public.get_current_client_account_context() from public;
grant execute on function public.get_current_client_account_context() to authenticated;
