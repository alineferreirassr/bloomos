import type { WorkspaceMember } from "@/types/workspaceMember";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

type MembershipLike = Pick<WorkspaceMember, "workspace_id" | "user_id" | "role" | "status">;

/**
 * Pure, client-safe mirrors of the SQL RLS helper functions of the same
 * name (`is_workspace_member`, `has_workspace_role`, `current_user_workspace_ids`
 * — see `supabase/migrations`). These never replace RLS as the actual
 * enforcement boundary — the database is the source of truth — but they let
 * UI code make the same "can this user do X" decision synchronously, from
 * membership rows already in hand, without an extra round trip.
 */

function findMembership(
  memberships: MembershipLike[],
  workspaceId: string,
  userId: string,
): MembershipLike | undefined {
  return memberships.find((m) => m.workspace_id === workspaceId && m.user_id === userId);
}

export function isWorkspaceMember(memberships: MembershipLike[], workspaceId: string, userId: string): boolean {
  const membership = findMembership(memberships, workspaceId, userId);
  return membership?.status === "active";
}

export function hasWorkspaceRole(
  memberships: MembershipLike[],
  workspaceId: string,
  userId: string,
  allowedRoles: WorkspaceMemberRole[],
): boolean {
  const membership = findMembership(memberships, workspaceId, userId);
  if (!membership || membership.status !== "active") return false;
  return allowedRoles.includes(membership.role);
}

export function currentUserWorkspaceIds(memberships: MembershipLike[], userId: string): string[] {
  return memberships.filter((m) => m.user_id === userId && m.status === "active").map((m) => m.workspace_id);
}
