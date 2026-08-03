import { listWorkflowNodes } from "@/core/workflow/nodeRegistry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { WorkflowNodeDefinition } from "@/types/workflow";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ListWorkflowNodesForWorkspaceParams {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
}

/**
 * Every node type this member may actually drag onto the canvas — filtered
 * by permission/role (Feature Flags checked async via `evaluateFeatureFlag`),
 * sorted alphabetically by name for a stable Node Library order. Mirrors
 * `core/automation/discovery.ts`'s own `listAutomationsForWorkspace` almost
 * exactly — the Node Library panel calls this rather than the raw registry
 * so a node type this member isn't allowed to use never even appears as a
 * draggable option, matching Step 15's "Role aware. Feature Flag aware."
 */
export async function listWorkflowNodesForWorkspace(params: ListWorkflowNodesForWorkspaceParams): Promise<WorkflowNodeDefinition[]> {
  const candidates = listWorkflowNodes().filter((definition) => {
    if (definition.requiredPermissions.some((permission) => !params.permissions.includes(permission))) return false;
    if (definition.minimumRole && (!params.role || !roleMeetsMinimum(params.role, definition.minimumRole))) return false;
    return true;
  });

  const flagChecks = await Promise.all(
    candidates.map((definition) => (definition.featureFlag ? evaluateFeatureFlag(params.workspaceId, definition.featureFlag) : Promise.resolve(true))),
  );

  return candidates.filter((_, index) => flagChecks[index]).sort((a, b) => a.name.localeCompare(b.name));
}
