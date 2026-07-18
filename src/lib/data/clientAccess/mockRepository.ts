import type { ClientAccount, ClientAccountContext } from "@/types/clientAccount";
import type { ClientInvitation, ClientInvitationWithToken, ClientInvitationPreview } from "@/types/clientInvitation";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import { NotFoundError } from "@/core/errors";
import { getInvitationNextRecommendedAction } from "@/core/workflows/invitationWorkflow";
import { generateInvitationToken, hashInvitationToken } from "@/lib/team/invitationToken";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { readClients } from "@/lib/data/mock/clientsStore";
import {
  readClientAccounts,
  writeClientAccounts,
  resetClientAccountsStore,
  MOCK_CURRENT_CLIENT_ACCOUNT_ID,
} from "@/lib/data/mock/clientAccountsStore";
import {
  readClientInvitations,
  writeClientInvitations,
  readClientInvitationIdByToken,
  writeClientInvitationToken,
  resetClientInvitationsStore,
} from "@/lib/data/mock/clientInvitationsStore";
import type {
  ClientAccessRepository,
  CreateClientInvitationInput,
  ClientInvitationFilters,
} from "@/lib/data/clientAccess/repository";

export { resetClientAccountsStore, resetClientInvitationsStore };

const INVITATION_EXPIRY_DAYS = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function getClientAccounts(clientId?: string): Promise<ClientAccount[]> {
  await delay(150);
  const accounts = readClientAccounts();
  return clientId ? accounts.filter((a) => a.client_id === clientId) : accounts;
}

async function getClientAccountById(id: string): Promise<ClientAccount> {
  await delay(100);
  const account = readClientAccounts().find((a) => a.id === id);
  if (!account) throw new NotFoundError(`Client account ${id} was not found`);
  return account;
}

async function getClientAccountsByClientId(clientId: string): Promise<ClientAccount[]> {
  return getClientAccounts(clientId);
}

/** Mock mode has no real Client Portal authentication — the seeded active account stands in for "the current user," the same precedent as getCurrentWorkspaceMember(). */
async function getCurrentClientAccount(): Promise<ClientAccount | null> {
  return readClientAccounts().find((a) => a.id === MOCK_CURRENT_CLIENT_ACCOUNT_ID) ?? null;
}

async function getCurrentClientAccountContext(): Promise<ClientAccountContext | null> {
  const account = await getCurrentClientAccount();
  if (!account) return null;
  const client = readClients().find((c) => c.id === account.client_id);
  return {
    account,
    clientName: client ? `${client.first_name} ${client.last_name}`.trim() : "",
    workspaceName: "Amoré Bloom",
  };
}

async function activateClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const accounts = readClientAccounts();
  const existing = accounts.find((a) => a.id === id);
  if (!existing) return fail("Client account not found.");
  const timestamp = nowIso();
  const updated: ClientAccount = { ...existing, status: "active", accepted_at: existing.accepted_at ?? timestamp, updated_at: timestamp };
  writeClientAccounts(accounts.map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function suspendClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const accounts = readClientAccounts();
  const existing = accounts.find((a) => a.id === id);
  if (!existing) return fail("Client account not found.");
  if (existing.status === "suspended") return fail("This account is already suspended.");
  if (existing.status === "revoked") return fail("A revoked account cannot be suspended — reactivate it first.");

  const timestamp = nowIso();
  const updated: ClientAccount = { ...existing, status: "suspended", suspended_at: timestamp, updated_at: timestamp };
  writeClientAccounts(accounts.map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function reactivateClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const accounts = readClientAccounts();
  const existing = accounts.find((a) => a.id === id);
  if (!existing) return fail("Client account not found.");
  if (existing.status === "active") return fail("This account is already active.");

  const timestamp = nowIso();
  const updated: ClientAccount = { ...existing, status: "active", suspended_at: null, revoked_at: null, updated_at: timestamp };
  writeClientAccounts(accounts.map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function revokeClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const accounts = readClientAccounts();
  const existing = accounts.find((a) => a.id === id);
  if (!existing) return fail("Client account not found.");
  if (existing.status === "revoked") return fail("This account is already revoked.");

  const timestamp = nowIso();
  const updated: ClientAccount = { ...existing, status: "revoked", revoked_at: timestamp, updated_at: timestamp };
  writeClientAccounts(accounts.map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function updateClientLastAccess(id: string): Promise<void> {
  const accounts = readClientAccounts();
  const existing = accounts.find((a) => a.id === id);
  if (!existing) return;
  const updated: ClientAccount = { ...existing, last_access_at: nowIso() };
  writeClientAccounts(accounts.map((a) => (a.id === id ? updated : a)));
}

/** Never a security boundary by itself in mock mode (there is no RLS to fall back on) — this exists only so UI code has one call to make in either data mode. */
async function canCurrentUserAccessClient(clientId: string): Promise<boolean> {
  const current = await getCurrentClientAccount();
  return !!current && current.client_id === clientId && current.status === "active";
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

async function getClientInvitations(filters: ClientInvitationFilters = {}): Promise<ClientInvitation[]> {
  await delay(150);
  const { clientId, status } = filters;
  return readClientInvitations().filter((invitation) => {
    if (clientId && invitation.client_id !== clientId) return false;
    if (status && status !== "all" && invitation.status !== status) return false;
    return true;
  });
}

async function getClientInvitationById(id: string): Promise<ClientInvitation> {
  await delay(100);
  const invitation = readClientInvitations().find((i) => i.id === id);
  if (!invitation) throw new NotFoundError(`Client invitation ${id} was not found`);
  return invitation;
}

async function createClientInvitation(input: CreateClientInvitationInput): Promise<DataResult<ClientInvitationWithToken>> {
  const client = readClients().find((c) => c.id === input.client_id);
  if (!client) return fail("Client not found.");

  const email = normalizeEmail(input.email);
  if (email.length === 0 || !email.includes("@")) {
    return fail("Please enter a valid email address.", { email: "Please enter a valid email address." });
  }

  const existingPending = readClientInvitations().some(
    (i) => i.client_id === input.client_id && i.email === email && i.status === "pending",
  );
  if (existingPending) {
    return fail("There is already a pending invitation for this email.", { email: "There is already a pending invitation for this email." });
  }

  const alreadyActive = readClientAccounts().some(
    (a) => a.client_id === input.client_id && a.email.toLowerCase() === email && a.status === "active",
  );
  if (alreadyActive) {
    return fail("This email already has an active Client Portal account for this Client.", { email: "This email already has an active Client Portal account for this Client." });
  }

  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const invitation: ClientInvitation = {
    id: generateId("client_invitation"),
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: input.client_id,
    email,
    invited_by: "user_1",
    status: "pending",
    expires_at: expiresAt,
    accepted_at: null,
    revoked_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeClientInvitations([...readClientInvitations(), invitation]);
  writeClientInvitationToken(invitation.id, token);
  void tokenHash; // computed for parity with Supabase mode; the mock store keys by raw token directly.

  return ok({ invitation, token });
}

async function resendClientInvitation(id: string): Promise<DataResult<ClientInvitationWithToken>> {
  const invitations = readClientInvitations();
  const existing = invitations.find((i) => i.id === id);
  if (!existing) return fail("Invitation not found.");
  if (existing.status !== "pending") return fail(`Cannot resend an invitation that is already ${existing.status}.`);

  const token = generateInvitationToken();
  await hashInvitationToken(token);
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const updated: ClientInvitation = { ...existing, expires_at: expiresAt, updated_at: timestamp };
  writeClientInvitations(invitations.map((i) => (i.id === id ? updated : i)));
  writeClientInvitationToken(id, token);

  return ok({ invitation: updated, token });
}

async function revokeClientInvitation(id: string): Promise<DataResult<ClientInvitation>> {
  const invitations = readClientInvitations();
  const existing = invitations.find((i) => i.id === id);
  if (!existing) return fail("Invitation not found.");
  if (existing.status !== "pending") return fail(`Cannot revoke an invitation that is already ${existing.status}.`);

  const updated: ClientInvitation = { ...existing, status: "revoked", revoked_at: nowIso(), updated_at: nowIso() };
  writeClientInvitations(invitations.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

/** Mock mode's stand-in "accepting user" — a brand-new mock auth id, distinct from any seeded account, so acceptance is genuinely exercisable end to end. */
function nextMockAuthUserId(): string {
  return generateId("mock_client_user");
}

async function acceptClientInvitation(token: string): Promise<DataResult<ClientAccount>> {
  const invitationId = readClientInvitationIdByToken(token);
  if (!invitationId) return fail("This invitation link is invalid.");

  const invitations = readClientInvitations();
  const invitation = invitations.find((i) => i.id === invitationId);
  if (!invitation) return fail("This invitation link is invalid.");

  if (invitation.status === "revoked") return fail("This invitation has been revoked.");
  if (invitation.status === "accepted") return fail("This invitation has already been accepted.");
  if (invitation.status === "expired" || new Date(invitation.expires_at).getTime() < Date.now()) {
    if (invitation.status === "pending") {
      writeClientInvitations(invitations.map((i) => (i.id === invitationId ? { ...i, status: "expired", updated_at: nowIso() } : i)));
    }
    return fail("This invitation has expired.");
  }

  const timestamp = nowIso();
  const accounts = readClientAccounts();
  const authUserId = nextMockAuthUserId();

  // Reuse an existing (workspace, client, auth user) row if one already
  // exists for this exact email — mirrors accept_client_invitation's
  // upsert-to-active behavior server-side, satisfying "revoked accounts
  // can regain access via a new accepted invitation" without ever
  // creating a second row for the same person/client pair.
  const existingAccount = accounts.find((a) => a.client_id === invitation.client_id && a.email.toLowerCase() === invitation.email);

  let account: ClientAccount;
  if (existingAccount) {
    if (existingAccount.status === "active") return fail("You already have an active Client Portal account.");
    account = { ...existingAccount, status: "active", accepted_at: existingAccount.accepted_at ?? timestamp, suspended_at: null, revoked_at: null, updated_at: timestamp };
    writeClientAccounts(accounts.map((a) => (a.id === existingAccount.id ? account : a)));
  } else {
    account = {
      id: generateId("client_account"),
      workspace_id: invitation.workspace_id,
      client_id: invitation.client_id,
      auth_user_id: authUserId,
      email: invitation.email,
      status: "active",
      invited_by: invitation.invited_by,
      accepted_at: timestamp,
      suspended_at: null,
      revoked_at: null,
      last_access_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    writeClientAccounts([...accounts, account]);
  }

  writeClientInvitations(
    invitations.map((i) => (i.id === invitationId ? { ...i, status: "accepted", accepted_at: timestamp, updated_at: timestamp } : i)),
  );

  return ok(account);
}

async function expireClientInvitations(): Promise<void> {
  const now = Date.now();
  const invitations = readClientInvitations();
  writeClientInvitations(
    invitations.map((i) =>
      i.status === "pending" && new Date(i.expires_at).getTime() < now
        ? { ...i, status: "expired" as const, updated_at: nowIso() }
        : i,
    ),
  );
}

async function getClientInvitationByToken(token: string): Promise<ClientInvitationPreview | null> {
  const invitationId = readClientInvitationIdByToken(token);
  if (!invitationId) return null;
  const invitation = readClientInvitations().find((i) => i.id === invitationId);
  if (!invitation) return null;
  const client = readClients().find((c) => c.id === invitation.client_id);
  return {
    workspace_name: "Amoré Bloom",
    client_name: client ? `${client.first_name} ${client.last_name}`.trim() : "",
    email: invitation.email,
    status: invitation.status,
    expires_at: invitation.expires_at,
  };
}

async function getClientInvitationStatus(id: string): Promise<InvitationStatus> {
  const invitation = await getClientInvitationById(id);
  return invitation.status;
}

async function getClientInvitationNextAction(id: string): Promise<string | null> {
  const invitation = await getClientInvitationById(id);
  return getInvitationNextRecommendedAction(invitation);
}

export const mockClientAccessRepository: ClientAccessRepository = {
  getClientAccounts,
  getClientAccountById,
  getClientAccountsByClientId,
  getCurrentClientAccount,
  getCurrentClientAccountContext,
  activateClientAccount,
  suspendClientAccount,
  reactivateClientAccount,
  revokeClientAccount,
  updateClientLastAccess,
  canCurrentUserAccessClient,
  getClientInvitations,
  getClientInvitationById,
  createClientInvitation,
  resendClientInvitation,
  revokeClientInvitation,
  acceptClientInvitation,
  expireClientInvitations,
  getClientInvitationByToken,
  getClientInvitationStatus,
  getClientInvitationNextAction,
};
