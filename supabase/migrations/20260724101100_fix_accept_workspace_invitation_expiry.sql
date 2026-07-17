-- Team foundation follow-up: fix accept_workspace_invitation's dead
-- in-transaction expiry update.
--
-- migration 20260724100500's accept_workspace_invitation() attempted to
-- persist `status = 'expired'` on a stale pending invitation before
-- raising the P0005 rejection in the same statement. That update can
-- never actually persist: when the RAISE EXCEPTION immediately after it
-- propagates out of the function uncaught, Postgres rolls back the
-- entire implicit transaction the RPC call ran in, undoing the UPDATE
-- along with it. Confirmed live — accepting an expired invitation left
-- its status column at 'pending', not 'expired'.
--
-- This is forward-only (migration 20260724100500 already applied to the
-- live project and is never edited after the fact) — CREATE OR REPLACE
-- FUNCTION redefines the same function in place, same signature, same
-- external behavior/rejection order/errcodes, only removing the dead
-- write and correcting the comment. Persisting the pending -> expired
-- transition remains the sole job of expireWorkspaceInvitations()
-- (a plain batch UPDATE run as its own statement, with no exception
-- racing it in the same transaction) — the read-facing
-- getInvitationNextRecommendedAction() already derives "expired" from
-- expires_at regardless of the stored status, so this was always
-- cosmetic, never a security or data-integrity gap.
create or replace function public.accept_workspace_invitation(p_token text)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_invitation public.workspace_invitations%rowtype;
  v_caller_email text;
  v_member public.workspace_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation.' using errcode = 'P0001';
  end if;

  select * into v_invitation
  from public.workspace_invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'This invitation link is invalid.' using errcode = 'P0002';
  end if;

  if v_invitation.status = 'revoked' then
    raise exception 'This invitation has been revoked.' using errcode = 'P0003';
  end if;

  if v_invitation.status = 'accepted' then
    raise exception 'This invitation has already been accepted.' using errcode = 'P0004';
  end if;

  -- Expiration is determined by expires_at, not solely by the stored
  -- status column. This function never attempts to persist a status
  -- transition on a failed acceptance — any write here would be undone
  -- by the same transaction's rollback the moment the exception below
  -- propagates. expireWorkspaceInvitations() (a separate, successful,
  -- standalone statement) is the only place `status` actually flips to
  -- 'expired'.
  if v_invitation.status = 'expired' or v_invitation.expires_at < now() then
    raise exception 'This invitation has expired.' using errcode = 'P0005';
  end if;

  select email into v_caller_email from public.profiles where id = auth.uid();
  if v_caller_email is null or lower(v_caller_email) != v_invitation.email then
    raise exception 'This invitation was sent to a different email address.' using errcode = 'P0006';
  end if;

  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_invitation.workspace_id and user_id = auth.uid()
  ) then
    raise exception 'You are already a member of this Workspace.' using errcode = 'P0007';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_invitation.workspace_id, auth.uid(), v_invitation.invited_role, 'active')
  returning * into v_member;

  update public.workspace_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_invitation.id;

  return v_member;
end;
$$;

comment on function public.accept_workspace_invitation(text) is
  'Security definer: atomically validates a pending, unexpired invitation token and creates the corresponding active workspace_members row. Never persists an expired status itself (that write would be rolled back with the rejection it accompanies) — expireWorkspaceInvitations() owns that transition. See migration comment for the full list of P0001-P0007 rejection cases.';
