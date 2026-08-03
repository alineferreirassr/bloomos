import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

/**
 * Sidebar/MobileNav identity label: only the owner sees the bare Workspace
 * name; every other internal role (admin/manager/staff) sees it suffixed
 * with "Team" — the approved Team foundation branding rule. A null role
 * (mock mode, or no resolved session) falls into the "Team" bucket too,
 * which is deliberate — it reproduces the exact static label
 * ("Amoré Bloom Team") this UI already showed before role-awareness existed,
 * so mock mode's appearance is unchanged.
 */
export function getWorkspaceDisplayName(
  role: WorkspaceMemberRole | null,
  workspaceName: string,
): string {
  if (role === "owner") {
    return workspaceName;
  }
  return `${workspaceName} Team`;
}
