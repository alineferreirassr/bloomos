import type { TeamMember } from "@/types/teamMember";
import type { WorkspaceInvitation, WorkspaceInvitationWithToken, InvitationPreview } from "@/types/workspaceInvitation";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { Permission } from "@/core/enums/permission";
import { NotFoundError } from "@/core/errors";
import { getInvitationNextRecommendedAction } from "@/core/workflows/invitationWorkflow";
import { getDefaultRolePermissions, roleHasPermission } from "@/lib/team/permissionMatrix";
import { generateInvitationToken, hashInvitationToken } from "@/lib/team/invitationToken";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import {
  readTeamMembers,
  writeTeamMembers,
  resetTeamMembersStore,
  MOCK_CURRENT_MEMBER_ID,
} from "@/lib/data/mock/teamMembersStore";
import {
  readWorkspaceInvitations,
  writeWorkspaceInvitations,
  readInvitationIdByToken,
  writeInvitationToken,
  resetWorkspaceInvitationsStore,
} from "@/lib/data/mock/workspaceInvitationsStore";
import type {
  TeamRepository,
  CreateWorkspaceInvitationInput,
  WorkspaceInvitationFilters,
} from "@/lib/data/team/repository";

export { resetTeamMembersStore, resetWorkspaceInvitationsStore };

const INVITATION_EXPIRY_DAYS = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

async function getWorkspaceMembers(): Promise<TeamMember[]> {
  await delay(150);
  return readTeamMembers();
}

async function getWorkspaceMemberById(id: string): Promise<TeamMember> {
  await delay(100);
  const member = readTeamMembers().find((m) => m.id === id);
  if (!member) throw new NotFoundError(`Workspace member ${id} was not found`);
  return member;
}

/** Mock mode has no real authentication — the seeded owner stands in for "the current user." */
async function getCurrentWorkspaceMember(): Promise<TeamMember | null> {
  return readTeamMembers().find((m) => m.id === MOCK_CURRENT_MEMBER_ID) ?? null;
}

/** Mirrors the trg_protect_workspace_owners invariant: the last active owner can never be demoted, deactivated, or removed. */
function wouldRemoveLastActiveOwner(members: TeamMember[], targetId: string, becomingNonOwnerOrInactive: boolean): boolean {
  if (!becomingNonOwnerOrInactive) return false;
  const target = members.find((m) => m.id === targetId);
  if (!target || target.role !== "owner" || target.status !== "active") return false;
  const otherActiveOwners = members.filter((m) => m.id !== targetId && m.role === "owner" && m.status === "active");
  return otherActiveOwners.length === 0;
}

async function updateWorkspaceMemberRole(id: string, role: WorkspaceMemberRole): Promise<DataResult<TeamMember>> {
  const members = readTeamMembers();
  const existing = members.find((m) => m.id === id);
  if (!existing) return fail("Workspace member not found.");

  if (wouldRemoveLastActiveOwner(members, id, role !== "owner")) {
    return fail("The last active owner cannot be demoted.");
  }

  const updated: TeamMember = { ...existing, role, updated_at: nowIso() };
  writeTeamMembers(members.map((m) => (m.id === id ? updated : m)));
  return ok(updated);
}

async function deactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>> {
  const members = readTeamMembers();
  const existing = members.find((m) => m.id === id);
  if (!existing) return fail("Workspace member not found.");
  if (existing.status === "suspended") return fail("This member is already deactivated.");

  if (wouldRemoveLastActiveOwner(members, id, true)) {
    return fail("The last active owner cannot be deactivated.");
  }

  const updated: TeamMember = { ...existing, status: "suspended", updated_at: nowIso() };
  writeTeamMembers(members.map((m) => (m.id === id ? updated : m)));
  return ok(updated);
}

async function reactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>> {
  const members = readTeamMembers();
  const existing = members.find((m) => m.id === id);
  if (!existing) return fail("Workspace member not found.");
  if (existing.status === "active") return fail("This member is already active.");

  const updated: TeamMember = { ...existing, status: "active", updated_at: nowIso() };
  writeTeamMembers(members.map((m) => (m.id === id ? updated : m)));
  return ok(updated);
}

async function removeWorkspaceMember(id: string): Promise<DataResult<null>> {
  const members = readTeamMembers();
  const existing = members.find((m) => m.id === id);
  if (!existing) return fail("Workspace member not found.");

  if (wouldRemoveLastActiveOwner(members, id, true)) {
    return fail("The last active owner cannot be removed.");
  }

  writeTeamMembers(members.filter((m) => m.id !== id));
  return ok(null);
}

async function getWorkspaceMemberPermissions(id: string): Promise<Permission[]> {
  const member = await getWorkspaceMemberById(id);
  return getDefaultRolePermissions(member.role);
}

async function canWorkspaceMember(id: string, permission: Permission): Promise<boolean> {
  const member = readTeamMembers().find((m) => m.id === id);
  if (!member || member.status !== "active") return false;
  return roleHasPermission(member.role, permission);
}

async function getRolePermissions(role: WorkspaceMemberRole): Promise<Permission[]> {
  return getDefaultRolePermissions(role);
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

async function getWorkspaceInvitations(filters: WorkspaceInvitationFilters = {}): Promise<WorkspaceInvitation[]> {
  await delay(150);
  const { status } = filters;
  return readWorkspaceInvitations().filter((invitation) => {
    if (status && status !== "all" && invitation.status !== status) return false;
    return true;
  });
}

async function getWorkspaceInvitationById(id: string): Promise<WorkspaceInvitation> {
  await delay(100);
  const invitation = readWorkspaceInvitations().find((i) => i.id === id);
  if (!invitation) throw new NotFoundError(`Workspace invitation ${id} was not found`);
  return invitation;
}

/** Only an owner may invite an owner/admin; an admin may only invite manager/staff — mirrors trg_validate_invitation_role_authority. In mock mode the acting member is always the seeded owner, so every invited_role is currently reachable; this check still runs for parity with Supabase mode's rejection message shape. */
function validateInvitationRoleAuthority(actingRole: WorkspaceMemberRole, invitedRole: WorkspaceMemberRole): string | null {
  if (actingRole === "owner") return null;
  if (actingRole === "admin" && (invitedRole === "manager" || invitedRole === "staff")) return null;
  return `You are not authorized to invite someone as ${invitedRole}.`;
}

async function createWorkspaceInvitation(input: CreateWorkspaceInvitationInput): Promise<DataResult<WorkspaceInvitationWithToken>> {
  const actingMember = await getCurrentWorkspaceMember();
  if (!actingMember) return fail("You must be an active Workspace member to invite someone.");

  const email = normalizeEmail(input.email);
  if (email.length === 0 || !email.includes("@")) {
    return fail("Please enter a valid email address.", { email: "Please enter a valid email address." });
  }

  const authorityError = validateInvitationRoleAuthority(actingMember.role, input.invited_role);
  if (authorityError) {
    return fail(authorityError, { invited_role: authorityError });
  }

  const existingPending = readWorkspaceInvitations().some(
    (i) => i.email === email && i.status === "pending",
  );
  if (existingPending) {
    return fail("There is already a pending invitation for this email.", { email: "There is already a pending invitation for this email." });
  }

  const alreadyMember = readTeamMembers().some((m) => m.email.toLowerCase() === email && m.status !== "suspended");
  if (alreadyMember) {
    return fail("This email already belongs to a Workspace member.", { email: "This email already belongs to a Workspace member." });
  }

  const token = generateInvitationToken();
  const tokenHash = await hashInvitationToken(token);
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const invitation: WorkspaceInvitation = {
    id: generateId("invitation"),
    workspace_id: CURRENT_WORKSPACE_ID,
    email,
    invited_role: input.invited_role,
    invited_by: actingMember.user_id,
    status: "pending",
    expires_at: expiresAt,
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeWorkspaceInvitations([...readWorkspaceInvitations(), invitation]);
  writeInvitationToken(invitation.id, token);
  void tokenHash; // computed for parity with Supabase mode; the mock store keys by raw token directly (see workspaceInvitationsStore.ts's comment).

  return ok({ invitation, token });
}

async function resendWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitationWithToken>> {
  const invitations = readWorkspaceInvitations();
  const existing = invitations.find((i) => i.id === id);
  if (!existing) return fail("Invitation not found.");
  if (existing.status !== "pending") return fail(`Cannot resend an invitation that is already ${existing.status}.`);

  const token = generateInvitationToken();
  await hashInvitationToken(token);
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const updated: WorkspaceInvitation = { ...existing, expires_at: expiresAt, updated_at: timestamp };
  writeWorkspaceInvitations(invitations.map((i) => (i.id === id ? updated : i)));
  writeInvitationToken(id, token);

  return ok({ invitation: updated, token });
}

async function revokeWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitation>> {
  const invitations = readWorkspaceInvitations();
  const existing = invitations.find((i) => i.id === id);
  if (!existing) return fail("Invitation not found.");
  if (existing.status !== "pending") return fail(`Cannot revoke an invitation that is already ${existing.status}.`);

  const updated: WorkspaceInvitation = { ...existing, status: "revoked", revoked_at: nowIso(), updated_at: nowIso() };
  writeWorkspaceInvitations(invitations.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

/** Mock mode's stand-in "accepting user" — a brand-new mock member, distinct from the seeded owner, so acceptance is genuinely exercisable end to end. */
function nextMockUserId(): string {
  return generateId("user");
}

async function acceptWorkspaceInvitation(token: string): Promise<DataResult<TeamMember>> {
  const invitationId = readInvitationIdByToken(token);
  if (!invitationId) return fail("This invitation link is invalid.");

  const invitations = readWorkspaceInvitations();
  const invitation = invitations.find((i) => i.id === invitationId);
  if (!invitation) return fail("This invitation link is invalid.");

  if (invitation.status === "revoked") return fail("This invitation has been revoked.");
  if (invitation.status === "accepted") return fail("This invitation has already been accepted.");
  if (invitation.status === "expired" || new Date(invitation.expires_at).getTime() < Date.now()) {
    if (invitation.status === "pending") {
      writeWorkspaceInvitations(invitations.map((i) => (i.id === invitationId ? { ...i, status: "expired", updated_at: nowIso() } : i)));
    }
    return fail("This invitation has expired.");
  }

  const alreadyMember = readTeamMembers().some((m) => m.email.toLowerCase() === invitation.email);
  if (alreadyMember) return fail("You are already a member of this Workspace.");

  const timestamp = nowIso();
  const newMember: TeamMember = {
    id: generateId("member"),
    workspace_id: invitation.workspace_id,
    user_id: nextMockUserId(),
    role: invitation.invited_role,
    status: "active",
    full_name: null,
    email: invitation.email,
    avatar_url: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeTeamMembers([...readTeamMembers(), newMember]);

  writeWorkspaceInvitations(
    invitations.map((i) =>
      i.id === invitationId
        ? { ...i, status: "accepted", accepted_at: timestamp, accepted_by: newMember.user_id, updated_at: timestamp }
        : i,
    ),
  );

  return ok(newMember);
}

async function expireWorkspaceInvitations(): Promise<void> {
  const now = Date.now();
  const invitations = readWorkspaceInvitations();
  writeWorkspaceInvitations(
    invitations.map((i) =>
      i.status === "pending" && new Date(i.expires_at).getTime() < now
        ? { ...i, status: "expired" as const, updated_at: nowIso() }
        : i,
    ),
  );
}

async function getInvitationByToken(token: string): Promise<InvitationPreview | null> {
  const invitationId = readInvitationIdByToken(token);
  if (!invitationId) return null;
  const invitation = readWorkspaceInvitations().find((i) => i.id === invitationId);
  if (!invitation) return null;
  return {
    workspace_name: "Amoré Bloom",
    email: invitation.email,
    invited_role: invitation.invited_role,
    status: invitation.status,
    expires_at: invitation.expires_at,
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

export const mockTeamRepository: TeamRepository = {
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
