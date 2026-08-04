import type { Database } from "@/types/database.types";
import type { ClientAccount, ClientAccountContext } from "@/types/clientAccount";
import type { ClientAccountStatus } from "@/core/enums/clientAccountStatus";
import type { ClientInvitation, ClientInvitationWithToken, ClientInvitationPreview } from "@/types/clientInvitation";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { getInvitationNextRecommendedAction } from "@/core/workflows/invitationWorkflow";
import { generateInvitationToken, hashInvitationToken } from "@/lib/team/invitationToken";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import type {
  ClientAccessRepository,
  CreateClientInvitationInput,
  ClientInvitationFilters,
} from "@/lib/data/clientAccess/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type ClientAccountRow = Database["public"]["Tables"]["client_accounts"]["Row"];
type ClientInvitationRow = Database["public"]["Tables"]["client_invitations"]["Row"];

const APP_VALIDATION_ERROR_CODES = new Set(["P0101", "P0102", "P0103", "P0104", "P0105", "P0106", "P0107", "P0111", "P0112"]);

const INVITATION_EXPIRY_DAYS = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Internal-side operations only — an authenticated client caller (no workspace_members row) must never reach this. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function mapAccountRow(row: ClientAccountRow): ClientAccount {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    client_id: row.client_id,
    auth_user_id: row.auth_user_id,
    email: row.email,
    status: row.status as ClientAccountStatus,
    invited_by: row.invited_by,
    accepted_at: row.accepted_at,
    suspended_at: row.suspended_at,
    revoked_at: row.revoked_at,
    last_access_at: row.last_access_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapInvitationRow(row: ClientInvitationRow): ClientInvitation {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    client_id: row.client_id,
    email: row.email,
    invited_by: row.invited_by,
    status: row.status as InvitationStatus,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function getClientAccounts(clientId?: string, context?: ServerRepositoryContext): Promise<ClientAccount[]> {
  const session = context?.session ?? (await requireWorkspaceSession());
  const supabase = context?.supabase ?? createSupabaseClient();
  let query = supabase.from("client_accounts").select("*").eq("workspace_id", session.workspace.id);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapAccountRow);
}

async function getClientAccountById(id: string, context?: ServerRepositoryContext): Promise<ClientAccount> {
  const supabase = context?.supabase ?? createSupabaseClient();
  const { data, error } = await supabase.from("client_accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) throw new NotFoundError(`Client account ${id} was not found`);
  return mapAccountRow(data);
}

async function getClientAccountsByClientId(clientId: string, context?: ServerRepositoryContext): Promise<ClientAccount[]> {
  return getClientAccounts(clientId, context);
}

/** No workspace session required — the Public API's own API-Key-authenticated callers never have one. Filters directly by `workspace_id`, unlike `getClientAccounts()` above which resolves the Workspace from an internal member session. */
async function getClientAccountsForWorkspace(workspaceId: string): Promise<ClientAccount[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("client_accounts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapAccountRow);
}

/**
 * No workspace session required or expected — a Client Portal caller
 * never has one. RLS's "select own row" policy is what actually scopes
 * this to the caller. Deliberately NOT filtered to `status = 'active'` —
 * the exact same fix applied to workspaceSession.ts's membership query:
 * filtering to active-only would make a suspended/revoked account
 * indistinguishable from having no account at all, which is precisely the
 * distinction the client landing page's blocked-state UI needs to make.
 * Prefers an active row when the caller has several (see
 * client_accounts_workspace_client_user_unique — one row per Client, so
 * "several" only happens if a caller holds accounts for multiple Clients).
 */
async function getCurrentClientAccount(): Promise<ClientAccount | null> {
  const supabase = createSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from("client_accounts")
    .select("*")
    .eq("auth_user_id", userData.user.id)
    .order("created_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  const rows = data ?? [];
  const row = rows.find((r) => r.status === "active") ?? rows[0];
  return row ? mapAccountRow(row) : null;
}

/** Calls get_current_client_account_context() for the two display names, reusing getCurrentClientAccount()'s own resolution (already prefers an active row) for the account itself, rather than re-deriving it from the RPC's narrower column set. */
async function getCurrentClientAccountContext(): Promise<ClientAccountContext | null> {
  const account = await getCurrentClientAccount();
  if (!account) return null;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_current_client_account_context");
  if (error) throw normalizeSupabaseError(error);
  const row = data?.[0];

  return {
    account,
    clientName: row?.client_name ?? "",
    workspaceName: row?.workspace_name ?? "",
  };
}

async function runAccountWrite(supabase: SupabaseClient, id: string, patch: Database["public"]["Tables"]["client_accounts"]["Update"]): Promise<DataResult<ClientAccount>> {
  const { data, error } = await supabase.from("client_accounts").update(patch).eq("id", id).select("*").single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  return ok(mapAccountRow(data));
}

async function activateClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const supabase = createSupabaseClient();
  return runAccountWrite(supabase, id, { status: "active", suspended_at: null, revoked_at: null });
}

async function suspendClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const supabase = createSupabaseClient();
  return runAccountWrite(supabase, id, { status: "suspended", suspended_at: new Date().toISOString() });
}

async function reactivateClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const supabase = createSupabaseClient();
  return runAccountWrite(supabase, id, { status: "active", suspended_at: null, revoked_at: null });
}

async function revokeClientAccount(id: string): Promise<DataResult<ClientAccount>> {
  const supabase = createSupabaseClient();
  return runAccountWrite(supabase, id, { status: "revoked", revoked_at: new Date().toISOString() });
}

/** Ignores the caller-supplied id entirely — touch_client_account_last_access() (security definer) always updates the authenticated caller's own row, identified purely by auth.uid(). See that function's migration comment. */
async function updateClientLastAccess(_id: string): Promise<void> {
  const supabase = createSupabaseClient();
  const { error } = await supabase.rpc("touch_client_account_last_access");
  if (error) throw normalizeSupabaseError(error);
}

async function canCurrentUserAccessClient(clientId: string): Promise<boolean> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("is_client_account_holder", { p_client_id: clientId });
  if (error) throw normalizeSupabaseError(error);
  return !!data;
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

async function getClientInvitations(filters: ClientInvitationFilters = {}): Promise<ClientInvitation[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  let query = supabase.from("client_invitations").select("*").eq("workspace_id", session.workspace.id);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInvitationRow);
}

async function getClientInvitationById(id: string): Promise<ClientInvitation> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("client_invitations").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) throw new NotFoundError(`Client invitation ${id} was not found`);
  return mapInvitationRow(data);
}

async function createClientInvitation(input: CreateClientInvitationInput): Promise<DataResult<ClientInvitationWithToken>> {
  const email = normalizeEmail(input.email);
  if (email.length === 0 || !email.includes("@")) {
    return fail("Please enter a valid email address.", { email: "Please enter a valid email address." });
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("client_invitations")
    .insert({
      workspace_id: session.workspace.id,
      client_id: input.client_id,
      email,
      invited_by: session.user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return fail("There is already a pending invitation for this email.", { email: "There is already a pending invitation for this email." });
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }

  return ok({ invitation: mapInvitationRow(data), token });
}

async function resendClientInvitation(id: string): Promise<DataResult<ClientInvitationWithToken>> {
  const existing = await getClientInvitationById(id);
  if (existing.status !== "pending") {
    return fail(`Cannot resend an invitation that is already ${existing.status}.`);
  }

  const supabase = createSupabaseClient();
  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("client_invitations")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok({ invitation: mapInvitationRow(data), token });
}

async function revokeClientInvitation(id: string): Promise<DataResult<ClientInvitation>> {
  const existing = await getClientInvitationById(id);
  if (existing.status !== "pending") {
    return fail(`Cannot revoke an invitation that is already ${existing.status}.`);
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("client_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapInvitationRow(data));
}

/** No workspace session required or expected — the accepting caller never has one. */
async function acceptClientInvitation(token: string): Promise<DataResult<ClientAccount>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("accept_client_invitation", { p_token: token });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  return ok(mapAccountRow(data));
}

async function expireClientInvitations(): Promise<void> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("client_invitations")
    .update({ status: "expired" })
    .eq("workspace_id", session.workspace.id)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  if (error) throw normalizeSupabaseError(error);
}

/** No session required — the invitation-acceptance page may render before the visitor has signed in. */
async function getClientInvitationByToken(token: string): Promise<ClientInvitationPreview | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_client_invitation_by_token", { p_token: token });
  if (error) throw normalizeSupabaseError(error);
  const row = data?.[0];
  if (!row) return null;
  return {
    workspace_name: row.workspace_name,
    client_name: row.client_name,
    email: row.email,
    status: row.status as InvitationStatus,
    expires_at: row.expires_at,
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

export const supabaseClientAccessRepository: ClientAccessRepository = {
  getClientAccounts,
  getClientAccountById,
  getClientAccountsByClientId,
  getClientAccountsForWorkspace,
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
