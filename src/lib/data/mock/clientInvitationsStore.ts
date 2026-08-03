import type { ClientInvitation } from "@/types/clientInvitation";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** Realistic seed data covering every invitation status. token_hash values are never stored here (mock mode keys by raw token directly — see the comment on invitationIdByToken below), the same precedent as workspaceInvitationsStore.ts. */
const SEED_CLIENT_INVITATIONS: ClientInvitation[] = [
  {
    id: "client_invitation_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_3",
    email: "client3.pending@example.com",
    invited_by: "user_1",
    status: "pending",
    expires_at: "2026-12-31T00:00:00.000Z",
    accepted_at: null,
    revoked_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "client_invitation_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_1",
    email: "naomi.whitfield@example.com",
    invited_by: "user_1",
    status: "accepted",
    expires_at: "2026-06-04T00:00:00.000Z",
    accepted_at: "2026-06-01T00:00:00.000Z",
    revoked_at: null,
    created_at: "2026-05-28T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "client_invitation_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_4",
    email: "client4.expired@example.com",
    invited_by: "user_2",
    status: "expired",
    expires_at: "2026-06-01T00:00:00.000Z",
    accepted_at: null,
    revoked_at: null,
    created_at: "2026-05-25T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "client_invitation_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_3",
    email: "client3.revoked@example.com",
    invited_by: "user_1",
    status: "revoked",
    expires_at: "2026-12-31T00:00:00.000Z",
    accepted_at: null,
    revoked_at: "2026-06-15T00:00:00.000Z",
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-15T00:00:00.000Z",
  },
];

/**
 * Mock-mode-only: raw token -> invitation id, mirroring
 * workspaceInvitationsStore.ts's identical rationale — Supabase mode
 * hashes server-side inside the RPCs instead. Reset alongside the
 * invitations themselves. Seed invitations have no real token by design.
 */
let clientInvitations: ClientInvitation[] = SEED_CLIENT_INVITATIONS;
let clientInvitationIdByToken = new Map<string, string>();

export function readClientInvitations(): ClientInvitation[] {
  return clientInvitations;
}

export function writeClientInvitations(next: ClientInvitation[]): void {
  clientInvitations = next;
}

export function readClientInvitationIdByToken(token: string): string | undefined {
  return clientInvitationIdByToken.get(token);
}

export function writeClientInvitationToken(invitationId: string, token: string): void {
  clientInvitationIdByToken.set(token, invitationId);
}

export function resetClientInvitationsStore(): void {
  clientInvitations = SEED_CLIENT_INVITATIONS;
  clientInvitationIdByToken = new Map();
}
