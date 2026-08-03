-- Team foundation migration 9 of 11: indexes and constraints.
--
-- The pending-invitation-per-email partial unique index already exists
-- (migration 5, alongside the table it constrains). This migration adds
-- the remaining lookup indexes: workspace-scoped listing, and a global
-- uniqueness guarantee + fast lookup on token_hash — every token lookup
-- (get_invitation_by_token/accept_workspace_invitation) is a point query
-- on this column.

create unique index if not exists workspace_invitations_token_hash_unique
  on public.workspace_invitations (token_hash);

create index if not exists workspace_invitations_workspace_id_idx
  on public.workspace_invitations (workspace_id);

create index if not exists workspace_invitations_workspace_status_idx
  on public.workspace_invitations (workspace_id, status);
