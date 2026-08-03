-- Client Accounts + Invitations foundation migration 2 of 8: client_invitations.
--
-- A single-use, token-based invitation — never a temporary password, the
-- same security design as workspace_invitations. Only a SHA-256 hash of
-- the invitation token is ever stored (token_hash); the raw token exists
-- only in the invitation URL itself and briefly in server memory — see
-- migration 5's get_client_invitation_by_token()/accept_client_invitation().
--
-- Deliberately its own table, not a reuse of workspace_invitations: a
-- Client invitation links to a `clients` row, never grants a
-- `workspace_members` role, and is never mixed with the internal-team
-- invitation flow (docs/permissions.md's "Client and Team Portal
-- invitations" section explicitly anticipated this separation).

create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users (id),
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_invitations_status_check check (status in ('pending', 'accepted', 'expired', 'revoked')),
  constraint client_invitations_email_normalized_check check (email = lower(trim(email))),
  constraint client_invitations_accepted_consistency_check check (
    (status = 'accepted') = (accepted_at is not null)
  ),
  constraint client_invitations_revoked_consistency_check check (
    (status = 'revoked') = (revoked_at is not null)
  )
);

comment on table public.client_invitations is
  'Single-use, token-based Client Portal invitations, linked to a specific clients row. token_hash is a SHA-256 hash — the raw token is never persisted. No delete policy: an invitation''s history is permanent for audit purposes.';

-- At most one PENDING invitation per (workspace_id, client_id, email) at a
-- time — accepted/expired/revoked invitations don't count, so the same
-- email can be re-invited for the same Client after any of those outcomes.
create unique index if not exists client_invitations_pending_email_unique
  on public.client_invitations (workspace_id, client_id, email)
  where status = 'pending';
