-- Client Accounts + Invitations foundation migration 1 of 8: client_accounts.
--
-- Links exactly one external Supabase Auth user to exactly one `clients`
-- row within one Workspace — the sole membership model for a Client
-- Portal account. Deliberately separate from `workspace_members`: a
-- client account never grants internal Workspace membership, never
-- carries an internal role, and never receives a `role_permissions`
-- grant. Auth users and Client Portal users may both exist in
-- `auth.users` — they are distinguished by which of these two tables has
-- a row for them, never by an email-domain assumption.
--
-- `status` follows the same "reserved, unused `invited` value" precedent
-- as `workspace_members.status`: a real row is only ever created directly
-- with `status = 'active'` by `accept_client_invitation` (migration 5) —
-- there is no intermediate `invited` client_accounts row. `suspended` and
-- `revoked` are both explicitly reversible back to `active` (see
-- core/workflows/clientAccountWorkflow.ts) — "revoked accounts cannot
-- regain access without a new invitation or explicit reactivation" per
-- the approved design, so revoked is not a hard dead end.

create table if not exists public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'invited',
  invited_by uuid not null references auth.users (id),
  accepted_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_accounts_status_check check (status in ('invited', 'active', 'suspended', 'revoked')),
  constraint client_accounts_email_normalized_check check (email = lower(trim(email))),
  constraint client_accounts_accepted_consistency_check check (
    (status = 'invited') or (accepted_at is not null)
  ),
  constraint client_accounts_suspended_consistency_check check (
    (status = 'suspended') = (suspended_at is not null)
  ),
  constraint client_accounts_revoked_consistency_check check (
    (status = 'revoked') = (revoked_at is not null)
  ),
  -- At most one client_accounts row per (workspace, client, auth user)
  -- triple — the "no duplicate active client account" rule enforced
  -- structurally rather than by application logic alone. A revoked/
  -- suspended row is reactivated in place (see accept_client_invitation
  -- and reactivateClientAccount), never duplicated.
  constraint client_accounts_workspace_client_user_unique unique (workspace_id, client_id, auth_user_id)
);

comment on table public.client_accounts is
  'Links one external Supabase Auth user to exactly one clients row within one Workspace. Never a workspace_members row, never an internal role. No delete policy — suspension/revocation is the terminal-but-reversible state, the same reversibility precedent as every other domain in this schema.';
