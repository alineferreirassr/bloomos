import type { ClientAccountStatus } from "@/core/enums/clientAccountStatus";

/**
 * Links one external Supabase Auth user to exactly one `clients` row within
 * one Workspace — the sole membership model for a Client Portal account.
 * Deliberately separate from `TeamMember`/`workspace_members`: a client
 * account never grants internal Workspace membership, an internal role, or
 * any `role_permissions` grant. See docs/permissions.md's "Client accounts
 * and invitations" section.
 */
export interface ClientAccount {
  id: string;
  workspace_id: string;
  client_id: string;
  auth_user_id: string;
  email: string;
  status: ClientAccountStatus;
  invited_by: string;
  accepted_at: string | null;
  suspended_at: string | null;
  revoked_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Display-safe context for the Client Portal landing page — the account
 * itself plus the two names it needs to render (never the full `clients`
 * row, which business-module RLS doesn't grant a client caller access to
 * at all this phase; see `get_current_client_account_context()`).
 */
export interface ClientAccountContext {
  account: ClientAccount;
  clientName: string;
  workspaceName: string;
}
