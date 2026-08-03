import { listAutomations } from "@/core/automation/registry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { AutomationDefinition } from "@/types/automation";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ListAutomationsForWorkspaceParams {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
}

/**
 * Every Automation this member may even be offered — filtered by
 * permission/role (Feature Flags checked async via `evaluateFeatureFlag`),
 * sorted alphabetically by name for a stable Dashboard order. Mirrors
 * `core/ai/skills/discovery.ts`'s own `listSkillsForWorkspace` almost
 * exactly (Step 12's "Workspace scoped. Role aware... Feature Flag aware"
 * is the same guarantee that function already established for Skills) —
 * a Automation hidden here would also be rejected by `executeAutomation`
 * if dispatched anyway; this only exists so the Dashboard doesn't have to
 * duplicate that logic to decide what's worth *showing*.
 */
export async function listAutomationsForWorkspace(params: ListAutomationsForWorkspaceParams): Promise<AutomationDefinition[]> {
  const candidates = listAutomations().filter((automation) => {
    if (automation.requiredPermissions.some((permission) => !params.permissions.includes(permission))) return false;
    if (automation.minimumRole && (!params.role || !roleMeetsMinimum(params.role, automation.minimumRole))) return false;
    return true;
  });

  const flagChecks = await Promise.all(
    candidates.map((automation) => (automation.featureFlag ? evaluateFeatureFlag(params.workspaceId, automation.featureFlag) : Promise.resolve(true))),
  );

  return candidates.filter((_, index) => flagChecks[index]).sort((a, b) => a.name.localeCompare(b.name));
}
