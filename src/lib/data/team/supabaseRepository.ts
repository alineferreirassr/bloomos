import type { Database } from "@/types/database.types";
import type { TeamMember } from "@/types/teamMember";
import type { WorkspaceInvitation, WorkspaceInvitationWithToken, InvitationPreview } from "@/types/workspaceInvitation";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { Permission } from "@/core/enums/permission";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { getInvitationNextRecommendedAction } from "@/core/workflows/invitationWorkflow";
import { generateInvitationToken, hashInvitationToken } from "@/lib/team/invitationToken";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import type {
  TeamRepository,
  CreateWorkspaceInvitationInput,
  WorkspaceInvitationFilters,
} from "@/lib/data/team/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];

const APP_VALIDATION_ERROR_CODES = new Set([
  "P0001", "P0002", "P0003", "P0004", "P0005", "P0006", "P0007",
  "P0011", "P0012", "P0013", "P0014",
]);

const INVITATION_EXPIRY_DAYS = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

function toTeamMember(memberRow: WorkspaceMemberRow, profileRow: ProfileRow): TeamMember {
  return {
    id: memberRow.id,
    workspace_id: memberRow.workspace_id,
    user_id: memberRow.user_id,
    role: memberRow.role as WorkspaceMemberRole,
    status: memberRow.status as TeamMember["status"],
    full_name: profileRow.full_name,
    email: profileRow.email,
    avatar_url: profileRow.avatar_url,
    created_at: memberRow.created_at,
    updated_at: memberRow.updated_at,
  };
}

async function fetchProfilesByIds(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, ProfileRow>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds);
  if (error) throw normalizeSupabaseError(error);
  return new Map((data ?? []).map((row) => [row.id, row]));
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

async function getWorkspaceMembers(context?: ServerRepositoryContext): Promise<TeamMember[]> {
  const session = context?.session ?? (await requireWorkspaceSession());
  const supabase = context?.supabase ?? createSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  const rows = data ?? [];
  const profiles = await fetchProfilesByIds(supabase, rows.map((r) => r.user_id));
  return rows.map((row) => toTeamMember(row, profiles.get(row.user_id) ?? { id: row.user_id, full_name: null, email: "", avatar_url: null }));
}

async function getWorkspaceMemberById(id: string): Promise<TeamMember> {
  const supabase = createSupabaseClient();
  const { data: memberRow, error } = await supabase.from("workspace_members").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!memberRow) throw new NotFoundError(`Workspace member ${id} was not found`);

  const profiles = await fetchProfilesByIds(supabase, [memberRow.user_id]);
  return toTeamMember(memberRow, profiles.get(memberRow.user_id) ?? { id: memberRow.user_id, full_name: null, email: "", avatar_url: null });
}

async function getCurrentWorkspaceMember(): Promise<TeamMember | null> {
  const result = await getClientWorkspaceSession();
  if (result.status !== "ok") return null;
  const { membership, profile } = result.session;
  return {
    id: membership.id,
    workspace_id: membership.workspace_id,
    user_id: membership.user_id,
    role: membership.role,
    status: membership.status,
    full_name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    created_at: membership.created_at,
    updated_at: membership.updated_at,
  };
}

/** Translates trg_protect_workspace_owners' P0011-P0013 (and any other app-raised errcode) into a DataResult failure instead of an unhandled exception — same pattern as every other Postgres-function-backed repository call in this codebase. */
async function runMemberWrite(
  supabase: SupabaseClient,
  id: string,
  patch: Database["public"]["Tables"]["workspace_members"]["Update"],
): Promise<DataResult<TeamMember>> {
  const { data, error } = await supabase.from("workspace_members").update(patch).eq("id", id).select("*").single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  const profiles = await fetchProfilesByIds(supabase, [data.user_id]);
  return ok(toTeamMember(data, profiles.get(data.user_id) ?? { id: data.user_id, full_name: null, email: "", avatar_url: null }));
}

async function updateWorkspaceMemberRole(id: string, role: WorkspaceMemberRole): Promise<DataResult<TeamMember>> {
  const supabase = createSupabaseClient();
  return runMemberWrite(supabase, id, { role });
}

async function deactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>> {
  const supabase = createSupabaseClient();
  return runMemberWrite(supabase, id, { status: "suspended" });
}

async function reactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>> {
  const supabase = createSupabaseClient();
  return runMemberWrite(supabase, id, { status: "active" });
}

async function removeWorkspaceMember(id: string): Promise<DataResult<null>> {
  const supabase = createSupabaseClient();
  const { error } = await supabase.from("workspace_members").delete().eq("id", id);
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  return ok(null);
}

async function getWorkspaceMemberPermissions(id: string): Promise<Permission[]> {
  const supabase = createSupabaseClient();
  const { data: memberRow, error: memberError } = await supabase.from("workspace_members").select("role").eq("id", id).maybeSingle();
  if (memberError) throw normalizeSupabaseError(memberError);
  if (!memberRow) return [];
  return getRolePermissions(memberRow.role as WorkspaceMemberRole);
}

async function canWorkspaceMember(id: string, permission: Permission): Promise<boolean> {
  const permissions = await getWorkspaceMemberPermissions(id);
  return permissions.includes(permission);
}

async function getRolePermissions(role: WorkspaceMemberRole): Promise<Permission[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("role_permissions").select("permission_id").eq("role_id", role);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map((row) => row.permission_id as Permission);
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

function mapInvitationRow(row: Database["public"]["Tables"]["workspace_invitations"]["Row"]): WorkspaceInvitation {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    email: row.email,
    invited_role: row.invited_role as WorkspaceMemberRole,
    invited_by: row.invited_by,
    status: row.status as InvitationStatus,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at,
    accepted_by: row.accepted_by,
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getWorkspaceInvitations(filters: WorkspaceInvitationFilters = {}): Promise<WorkspaceInvitation[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  let query = supabase.from("workspace_invitations").select("*").eq("workspace_id", session.workspace.id);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInvitationRow);
}

async function getWorkspaceInvitationById(id: string): Promise<WorkspaceInvitation> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("workspace_invitations").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) throw new NotFoundError(`Workspace invitation ${id} was not found`);
  return mapInvitationRow(data);
}

async function createWorkspaceInvitation(input: CreateWorkspaceInvitationInput): Promise<DataResult<WorkspaceInvitationWithToken>> {
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
    .from("workspace_invitations")
    .insert({
      workspace_id: session.workspace.id,
      email,
      invited_role: input.invited_role,
      invited_by: session.user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message, { invited_role: error.message });
    if (code === "23505") return fail("There is already a pending invitation for this email.", { email: "There is already a pending invitation for this email." });
    throw normalizeSupabaseError(error);
  }

  return ok({ invitation: mapInvitationRow(data), token });
}

async function resendWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitationWithToken>> {
  const existing = await getWorkspaceInvitationById(id);
  if (existing.status !== "pending") {
    return fail(`Cannot resend an invitation that is already ${existing.status}.`);
  }

  const supabase = createSupabaseClient();
  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("workspace_invitations")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok({ invitation: mapInvitationRow(data), token });
}

async function revokeWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitation>> {
  const existing = await getWorkspaceInvitationById(id);
  if (existing.status !== "pending") {
    return fail(`Cannot revoke an invitation that is already ${existing.status}.`);
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapInvitationRow(data));
}

async function acceptWorkspaceInvitation(token: string): Promise<DataResult<TeamMember>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("accept_workspace_invitation", { p_token: token });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) return fail(error.message);
    throw normalizeSupabaseError(error);
  }

  const profiles = await fetchProfilesByIds(supabase, [data.user_id]);
  return ok(toTeamMember(data, profiles.get(data.user_id) ?? { id: data.user_id, full_name: null, email: "", avatar_url: null }));
}

async function expireWorkspaceInvitations(): Promise<void> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("workspace_invitations")
    .update({ status: "expired" })
    .eq("workspace_id", session.workspace.id)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  if (error) throw normalizeSupabaseError(error);
}

/** No session required — the invitation-acceptance page may render before the visitor has signed in. The token itself is the security boundary (see get_invitation_by_token's migration comment). */
async function getInvitationByToken(token: string): Promise<InvitationPreview | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
  if (error) throw normalizeSupabaseError(error);
  const row = data?.[0];
  if (!row) return null;
  return {
    workspace_name: row.workspace_name,
    email: row.email,
    invited_role: row.invited_role as WorkspaceMemberRole,
    status: row.status as InvitationStatus,
    expires_at: row.expires_at,
  };
}

async function getInvitationStatus(id: string): Promise<InvitationStatus> {
  const invitation = await getWorkspaceInvitationById(id);
  return invitation.status;
}

async function getInvitationNextAction(id: string): Promise<string | null> {
  const invitation = await getWorkspaceInvitationById(id);
  return getInvitationNextRecommendedAction(invitation);
}

export const supabaseTeamRepository: TeamRepository = {
  getWorkspaceMembers,
  getWorkspaceMemberById,
  getCurrentWorkspaceMember,
  updateWorkspaceMemberRole,
  deactivateWorkspaceMember,
  reactivateWorkspaceMember,
  removeWorkspaceMember,
  getWorkspaceMemberPermissions,
  canWorkspaceMember,
  getRolePermissions,
  getWorkspaceInvitations,
  getWorkspaceInvitationById,
  createWorkspaceInvitation,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  acceptWorkspaceInvitation,
  expireWorkspaceInvitations,
  getInvitationByToken,
  getInvitationStatus,
  getInvitationNextAction,
};
