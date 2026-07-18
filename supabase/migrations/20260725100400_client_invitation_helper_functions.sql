-- Client Accounts + Invitations foundation migration 5 of 8: client
-- invitation helper functions.
--
-- Same token-hashing convention as get_invitation_by_token/
-- accept_workspace_invitation (lib/team/invitationToken.ts,
-- supabase/migrations/20260724100500_invitation_helper_functions.sql):
-- the raw token is a 256-bit random value, base64url-encoded; the stored/
-- compared hash is the lowercase hex SHA-256 digest of that string's
-- UTF-8 bytes, computed here via pgcrypto's digest() and, on the
-- TypeScript side, via Web Crypto's `crypto.subtle`.
--
-- Both functions are `security definer`, for the identical structural
-- reason as their Team-invitation counterparts: the caller reading/
-- accepting a Client invitation by token has no client_accounts row yet
-- (and, critically, never a workspace_members row at all), so normal RLS
-- would deny them everything. The token itself (256 bits of entropy,
-- single-use, hashed at rest) is the security boundary instead. Uses a
-- distinct errcode range (P0101-P0107) from the Team invitation flow's
-- (P0001-P0007) so the two are never ambiguous to a caller inspecting a
-- Postgres error code.

-- Returns only display-safe fields — never token_hash, never invited_by,
-- never the invitation or client id, never any internal-only Client field
-- (allergies, VIP status, emergency contacts, etc.). Callable by anon (the
-- page must render before the visitor signs in) and authenticated alike.
create or replace function public.get_client_invitation_by_token(p_token text)
returns table (
  workspace_name text,
  client_name text,
  email text,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  return query
  select w.name, trim(c.first_name || ' ' || c.last_name), i.email, i.status, i.expires_at
  from public.client_invitations i
  join public.workspaces w on w.id = i.workspace_id
  join public.clients c on c.id = i.client_id
  where i.token_hash = v_hash;
end;
$$;

comment on function public.get_client_invitation_by_token(text) is
  'Security definer: token-based lookup for the Client invitation-acceptance page, reachable before the visitor has any session. Returns only display-safe fields — no internal-only Client data.';

revoke all on function public.get_client_invitation_by_token(text) from public;
grant execute on function public.get_client_invitation_by_token(text) to anon, authenticated;

-- Atomically accepts a pending, unexpired, unrevoked invitation whose
-- email matches the authenticated caller's own profile email
-- (case-insensitive), and activates (creating or reactivating in place)
-- the caller's client_accounts row for that Client — never a
-- workspace_members row. Row-locks the invitation, re-validates every
-- rejection condition inside the lock, upserts client_accounts, and marks
-- the invitation accepted — all in one transaction.
create or replace function public.accept_client_invitation(p_token text)
returns public.client_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_invitation public.client_invitations%rowtype;
  v_caller_email text;
  v_existing public.client_accounts%rowtype;
  v_account public.client_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation.' using errcode = 'P0101';
  end if;

  select * into v_invitation
  from public.client_invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'This invitation link is invalid.' using errcode = 'P0102';
  end if;

  if v_invitation.status = 'revoked' then
    raise exception 'This invitation has been revoked.' using errcode = 'P0103';
  end if;

  if v_invitation.status = 'accepted' then
    raise exception 'This invitation has already been accepted.' using errcode = 'P0104';
  end if;

  if v_invitation.status = 'expired' or v_invitation.expires_at < now() then
    if v_invitation.status = 'pending' then
      update public.client_invitations set status = 'expired' where id = v_invitation.id;
    end if;
    raise exception 'This invitation has expired.' using errcode = 'P0105';
  end if;

  select email into v_caller_email from public.profiles where id = auth.uid();
  if v_caller_email is null or lower(v_caller_email) != v_invitation.email then
    raise exception 'This invitation was sent to a different email address.' using errcode = 'P0106';
  end if;

  select * into v_existing
  from public.client_accounts
  where workspace_id = v_invitation.workspace_id
    and client_id = v_invitation.client_id
    and auth_user_id = auth.uid()
  for update;

  if found then
    if v_existing.status = 'active' then
      raise exception 'You already have an active Client Portal account.' using errcode = 'P0107';
    end if;
    -- Bypasses trg_validate_client_account_action_authority (migration 6)
    -- for this one transaction: this reactivation is authorized by the
    -- validated invitation token above, not by the accepting client
    -- holding any clients.portal_* permission (they never do — they have
    -- no workspace_members row at all).
    perform set_config('bloomos.skip_client_account_authority_check', 'true', true);
    update public.client_accounts
    set status = 'active',
        accepted_at = coalesce(v_existing.accepted_at, now()),
        suspended_at = null,
        revoked_at = null
    where id = v_existing.id
    returning * into v_account;
  else
    insert into public.client_accounts (workspace_id, client_id, auth_user_id, email, status, invited_by, accepted_at)
    values (v_invitation.workspace_id, v_invitation.client_id, auth.uid(), v_invitation.email, 'active', v_invitation.invited_by, now())
    returning * into v_account;
  end if;

  update public.client_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invitation.id;

  return v_account;
end;
$$;

comment on function public.accept_client_invitation(text) is
  'Security definer: atomically validates a pending Client invitation token and activates (creating or reactivating) the corresponding client_accounts row. Never creates a workspace_members row. See migration comment for the P0101-P0107 rejection cases.';

revoke all on function public.accept_client_invitation(text) from public;
grant execute on function public.accept_client_invitation(text) to authenticated;
