import { WORKSPACE_MANAGEMENT_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";

/**
 * Sidebar/MobileNav identity label: owner/admin see the bare Workspace name;
 * every other role (manager/team/viewer) sees it suffixed with "Team". A
 * null role (mock mode, or no resolved session) falls into the "Team"
 * bucket too, which is deliberate — it reproduces the exact static label
 * ("Amoré Bloom Team") this UI already showed before role-awareness existed,
 * so mock mode's appearance is unchanged.
 */
export function getWorkspaceDisplayName(
  role: WorkspaceMemberRole | null,
  workspaceName: string,
): string {
  if (role && WORKSPACE_MANAGEMENT_ROLES.includes(role)) {
    return workspaceName;
  }
  return `${workspaceName} Team`;
}
