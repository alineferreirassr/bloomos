import type { InvitationStatus } from "@/core/enums/invitationStatus";

/**
 * Mirrors the `client_invitations` table verbatim (snake_case). Reuses the
 * same `InvitationStatus` lifecycle as `WorkspaceInvitation` (pending ->
 * accepted/expired/revoked) — the state machine is identical, only the
 * linked entity differs, so `core/workflows/invitationWorkflow.ts` is
 * reused unchanged rather than duplicated. Never carries the raw token or
 * `token_hash` — see lib/team/invitationToken.ts.
 */
export interface ClientInvitation {
  id: string;
  workspace_id: string;
  client_id: string;
  email: string;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Returned once, immediately after creation/resend — the only moment the raw token is ever available to a caller. Never persisted, never logged. */
export interface ClientInvitationWithToken {
  invitation: ClientInvitation;
  token: string;
}

/**
 * The minimal, display-safe shape returned by the token-based lookup RPC
 * (get_client_invitation_by_token) — deliberately narrower than
 * ClientInvitation, since the caller has no session at all yet.
 * `client_name` is the Client's own first/last name only — never any
 * internal-only field (allergies, VIP status, emergency contacts, etc.).
 */
export interface ClientInvitationPreview {
  workspace_name: string;
  client_name: string;
  email: string;
  status: InvitationStatus;
  expires_at: string;
}
