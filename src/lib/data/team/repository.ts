import type { TeamMember } from "@/types/teamMember";
import type { WorkspaceInvitation, WorkspaceInvitationWithToken, InvitationPreview } from "@/types/workspaceInvitation";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { InvitationStatus } from "@/core/enums/invitationStatus";
import type { Permission } from "@/core/enums/permission";
import type { DataResult } from "@/lib/data/result";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

export interface CreateWorkspaceInvitationInput {
  email: string;
  invited_role: WorkspaceMemberRole;
}

export interface WorkspaceInvitationFilters {
  status?: InvitationStatus | "all";
}

/**
 * The single Team + Invitations persistence contract — implemented once by
 * the mock repository (lib/data/team/mockRepository.ts) and once by the
 * Supabase repository (lib/data/team/supabaseRepository.ts), exactly
 * mirroring every other module's repository pattern. lib/data/index.ts
 * picks between them via lib/data/provider.ts's selectRepository().
 *
 * Team Portal/Client Portal, Team/Client Knowledge Base, Notification
 * Center, and Automation Center are all explicitly out of scope — this is
 * the internal team-membership and invitation foundation only. See
 * docs/permissions.md.
 */
export interface TeamRepository {
  // Members
  getWorkspaceMembers(context?: ServerRepositoryContext): Promise<TeamMember[]>;
  getWorkspaceMemberById(id: string): Promise<TeamMember>;
  getCurrentWorkspaceMember(): Promise<TeamMember | null>;
  updateWorkspaceMemberRole(id: string, role: WorkspaceMemberRole): Promise<DataResult<TeamMember>>;
  deactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>>;
  reactivateWorkspaceMember(id: string): Promise<DataResult<TeamMember>>;
  removeWorkspaceMember(id: string): Promise<DataResult<null>>;
  getWorkspaceMemberPermissions(id: string): Promise<Permission[]>;
  canWorkspaceMember(id: string, permission: Permission): Promise<boolean>;
  getRolePermissions(role: WorkspaceMemberRole): Promise<Permission[]>;

  // Invitations
  getWorkspaceInvitations(filters?: WorkspaceInvitationFilters): Promise<WorkspaceInvitation[]>;
  getWorkspaceInvitationById(id: string): Promise<WorkspaceInvitation>;
  createWorkspaceInvitation(input: CreateWorkspaceInvitationInput): Promise<DataResult<WorkspaceInvitationWithToken>>;
  resendWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitationWithToken>>;
  revokeWorkspaceInvitation(id: string): Promise<DataResult<WorkspaceInvitation>>;
  acceptWorkspaceInvitation(token: string): Promise<DataResult<TeamMember>>;
  expireWorkspaceInvitations(): Promise<void>;
  getInvitationByToken(token: string): Promise<InvitationPreview | null>;
  getInvitationStatus(id: string): Promise<InvitationStatus>;
  getInvitationNextAction(id: string): Promise<string | null>;
}
