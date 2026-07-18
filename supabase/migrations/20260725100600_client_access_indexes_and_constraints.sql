-- Client Accounts + Invitations foundation migration 7 of 8: indexes and
-- constraints. The pending-invitation-per-email partial unique index and
-- the client_accounts workspace/client/user uniqueness constraint already
-- exist (migrations 1-2, alongside the tables they constrain). This
-- migration adds the remaining lookup indexes.

-- client_accounts: workspace-scoped listing, per-Client listing, and the
-- lookup every client-side session resolution performs ("my own account
-- row(s)").
create index if not exists client_accounts_workspace_id_idx
  on public.client_accounts (workspace_id);

create index if not exists client_accounts_client_id_idx
  on public.client_accounts (client_id);

create index if not exists client_accounts_auth_user_id_idx
  on public.client_accounts (auth_user_id);

-- client_invitations: workspace-scoped listing, per-Client listing, and a
-- global uniqueness guarantee + fast lookup on token_hash — every token
-- lookup (get_client_invitation_by_token/accept_client_invitation) is a
-- point query on this column.
create unique index if not exists client_invitations_token_hash_unique
  on public.client_invitations (token_hash);

create index if not exists client_invitations_workspace_id_idx
  on public.client_invitations (workspace_id);

create index if not exists client_invitations_client_id_idx
  on public.client_invitations (client_id);

create index if not exists client_invitations_workspace_status_idx
  on public.client_invitations (workspace_id, status);
