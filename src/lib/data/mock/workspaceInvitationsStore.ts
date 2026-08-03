import type { WorkspaceInvitation } from "@/types/workspaceInvitation";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** Realistic seed data covering every invitation status. token_hash values here are placeholder mock hashes — never real, never matchable by a real generated token. */
const SEED_WORKSPACE_INVITATIONS: WorkspaceInvitation[] = [
  {
    id: "invitation_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    email: "new.manager@example.com",
    invited_role: "manager",
    invited_by: "user_1",
    status: "pending",
    expires_at: "2026-12-31T00:00:00.000Z",
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "invitation_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    email: "sofia@amorebloom.com",
    invited_role: "staff",
    invited_by: "user_1",
    status: "accepted",
    expires_at: "2026-05-01T00:00:00.000Z",
    accepted_at: "2026-04-01T00:00:00.000Z",
    accepted_by: "user_4",
    revoked_at: null,
    created_at: "2026-03-25T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "invitation_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    email: "expired.invite@example.com",
    invited_role: "staff",
    invited_by: "user_2",
    status: "expired",
    expires_at: "2026-06-01T00:00:00.000Z",
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
    created_at: "2026-05-25T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "invitation_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    email: "revoked.invite@example.com",
    invited_role: "admin",
    invited_by: "user_1",
    status: "revoked",
    expires_at: "2026-12-31T00:00:00.000Z",
    accepted_at: null,
    accepted_by: null,
    revoked_at: "2026-06-15T00:00:00.000Z",
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
  },
];

/**
 * Mock-mode-only: raw token -> invitation id, so acceptWorkspaceInvitation/
 * getInvitationByToken can look up a row by the raw token without a real
 * hash comparison (Supabase mode hashes server-side inside the
 * accept_workspace_invitation/get_invitation_by_token RPCs instead — see
 * lib/team/invitationToken.ts). Reset alongside the invitations
 * themselves. Seed invitations have no real token by design — a seed
 * invitation is never meant to be acceptable via a copy-pasted link, only
 * a freshly created/resent one is.
 */
let workspaceInvitations: WorkspaceInvitation[] = SEED_WORKSPACE_INVITATIONS;
let invitationIdByToken = new Map<string, string>();

export function readWorkspaceInvitations(): WorkspaceInvitation[] {
  return workspaceInvitations;
}

export function writeWorkspaceInvitations(next: WorkspaceInvitation[]): void {
  workspaceInvitations = next;
}

export function readInvitationIdByToken(token: string): string | undefined {
  return invitationIdByToken.get(token);
}

export function writeInvitationToken(invitationId: string, token: string): void {
  invitationIdByToken.set(token, invitationId);
}

export function resetWorkspaceInvitationsStore(): void {
  workspaceInvitations = SEED_WORKSPACE_INVITATIONS;
  invitationIdByToken = new Map();
}
