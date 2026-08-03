-- Team foundation migration 5 of 11: workspace_invitations.
--
-- A single-use, token-based invitation — never a temporary password, never
-- an email carrying a password (see docs/permissions.md). Only a SHA-256
-- hash of the invitation token is ever stored (token_hash); the raw token
-- exists only in the invitation URL itself and briefly in server memory
-- while generating/validating it — see migration 6's
-- create_workspace_invitation()/get_invitation_by_token()/
-- accept_workspace_invitation().
--
-- email is stored normalized (lowercase, trimmed) so a case-variant email
-- can never bypass the "one active pending invitation per Workspace/email"
-- rule below or the accept-time email-match check.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  invited_role text not null references public.roles (id),
  invited_by uuid not null references auth.users (id),
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_invitations_status_check check (status in ('pending', 'accepted', 'expired', 'revoked')),
  constraint workspace_invitations_email_normalized_check check (email = lower(trim(email))),
  constraint workspace_invitations_accepted_consistency_check check (
    (status = 'accepted') = (accepted_at is not null)
  ),
  constraint workspace_invitations_revoked_consistency_check check (
    (status = 'revoked') = (revoked_at is not null)
  )
);

comment on table public.workspace_invitations is
  'Single-use, token-based Workspace invitations for internal team members. token_hash is a SHA-256 hash — the raw token is never persisted. No delete policy: an invitation''s history (pending/accepted/expired/revoked) is permanent for audit purposes, the same reversibility precedent as every other domain in this schema.';

-- At most one PENDING invitation per (workspace_id, email) at a time —
-- accepted/expired/revoked invitations don't count, so the same email can
-- be re-invited after any of those outcomes.
create unique index if not exists workspace_invitations_pending_email_unique
  on public.workspace_invitations (workspace_id, email)
  where status = 'pending';
