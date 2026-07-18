-- Client Portal MVP migration 1 of 5: workspace-scoped client-account
-- helper function.
--
-- Extends is_client_account_holder(p_client_id) (Client Accounts +
-- Invitations foundation) with an explicit workspace_id check, rather than
-- repeating an inline subquery in every new client-facing RLS policy
-- below. Functionally, checking client_id alone is already sufficient —
-- a clients row belongs to exactly one Workspace, and client_accounts.
-- workspace_id is always set to match at acceptance time — but every
-- policy in this phase spells out both dimensions explicitly per the
-- approved design, for auditability rather than relying on that implicit
-- guarantee alone.
create or replace function public.is_client_account_holder_in_workspace(p_workspace_id uuid, p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_accounts
    where workspace_id = p_workspace_id
      and client_id = p_client_id
      and auth_user_id = auth.uid()
      and status = 'active'
  );
$$;

comment on function public.is_client_account_holder_in_workspace(uuid, uuid) is
  'True iff the current auth.uid() holds an active Client Portal account for the given Client, explicitly re-checked against the given Workspace. Every Client Portal RLS policy in this phase uses this rather than is_client_account_holder(client_id) alone, per the approved design.';
