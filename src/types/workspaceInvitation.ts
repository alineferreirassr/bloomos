import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { InvitationStatus } from "@/core/enums/invitationStatus";

/**
 * Mirrors the `workspace_invitations` table (supabase/migrations) verbatim
 * (snake_case) — except this domain type never carries the raw token or
 * `token_hash`. The raw token exists only transiently (generated at
 * creation time, embedded in the invitation URL, never persisted anywhere
 * this type could represent); `token_hash` is a Supabase implementation
 * detail no caller needs once the row is created — see
 * lib/team/invitationToken.ts.
 */
export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  invited_role: WorkspaceMemberRole;
  invited_by: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Returned once, immediately after creation/resend — the only moment the raw token is ever available to a caller. Never persisted, never logged. */
export interface WorkspaceInvitationWithToken {
  invitation: WorkspaceInvitation;
  token: string;
}

/** The minimal, display-safe shape returned by the token-based lookup RPC (get_invitation_by_token) — deliberately narrower than WorkspaceInvitation, since the caller has no Workspace membership yet. */
export interface InvitationPreview {
  workspace_name: string;
  email: string;
  invited_role: WorkspaceMemberRole;
  status: InvitationStatus;
  expires_at: string;
}
