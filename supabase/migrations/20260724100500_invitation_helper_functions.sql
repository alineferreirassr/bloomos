-- Team foundation migration 6 of 11: invitation helper functions.
--
-- Token hashing convention (shared with the app — see
-- lib/team/invitationToken.ts): the raw token is a 256-bit random value,
-- base64url-encoded to a string; the stored/compared hash is the lowercase
-- hex SHA-256 digest of that string's UTF-8 bytes, computed here via
-- pgcrypto's digest() and, on the TypeScript side that generates a new
-- token at invitation-creation time, via Web Crypto's `crypto.subtle` —
-- the same "one hashing implementation, two callers, always agreeing"
-- shape as this project's real MediaAsset checksums.
--
-- Both functions below are `security definer`, and only these two, for the
-- same structural reason: the caller reading/accepting an invitation by
-- token has no Workspace membership yet, so normal RLS on
-- workspace_invitations/workspace_members would deny them everything —
-- there is no membership row for RLS to key off. The token itself (256
-- bits of entropy, single-use, hashed at rest) is the security boundary
-- instead. Each function is scoped to the minimum operation, validates
-- auth.uid() where relevant, and pins search_path per the same
-- privilege-escalation guard every other security definer function in
-- this schema already uses.

-- Returns only the minimum data needed to render the invitation-acceptance
-- page — never token_hash, never invited_by, never the invitation id.
-- Callable by anon (the page may render before the visitor signs in) and
-- authenticated alike.
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  workspace_name text,
  email text,
  invited_role text,
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
  select w.name, i.email, i.invited_role, i.status, i.expires_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = v_hash;
end;
$$;

comment on function public.get_invitation_by_token(text) is
  'Security definer: token-based lookup for the invitation-acceptance page, reachable before the visitor has any Workspace membership. Returns only display-safe fields.';

revoke all on function public.get_invitation_by_token(text) from public;
grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- Atomically accepts a pending, unexpired, unrevoked invitation whose email
-- matches the authenticated caller's own profile email (case-insensitive).
-- Row-locks the invitation, re-validates every rejection condition inside
-- the lock (never trusts a pre-check performed outside the transaction),
-- inserts the workspace_members row, and marks the invitation accepted —
-- all in one transaction, so a reader never observes a moment where the
-- invitation is accepted but no membership exists, or vice versa.
-- Rejections use errcodes P0001-P0006 so the calling repository can
-- translate them into a normal DataResult failure rather than an
-- unhandled exception, the same pattern as process_payment_refund.
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

  if v_invitation.status = 'expired' or v_invitation.expires_at < now() then
    if v_invitation.status = 'pending' then
      update public.workspace_invitations set status = 'expired' where id = v_invitation.id;
    end if;
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
  'Security definer: atomically validates a pending invitation token and creates the corresponding active workspace_members row. See migration comment for the full list of P0001-P0007 rejection cases.';

revoke all on function public.accept_workspace_invitation(text) from public;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
