import { WORKSPACE_MEMBER_ROLES } from "@/core/enums/workspaceRole";
import type { WorkflowNodeDefinition, WorkflowNodeValidationContext } from "@/types/workflow";

/**
 * The Step 9 built-in Approval nodes. `compileTarget` names one of the four
 * `ApprovalPolicyKind`s (`types/automation.ts`); "Manager Approval" and
 * "Owner Approval" both compile to `"role_restricted"` — what distinguishes
 * them is `data.minimumApproverRole`, pre-filled by this file and validated
 * on every node instance so an author can't drag one on and leave it
 * pointing at an invalid role. Deliberately omits `"workspace_configurable"`
 * — the checkpoint's own spec names exactly these four node types; a
 * Workspace-configurable Approval node is a natural, future registry
 * addition, not something this checkpoint's own palette exposes.
 */
function validateRoleRestrictedApproval(context: WorkflowNodeValidationContext): string | null {
  const role = context.node.data.minimumApproverRole;
  if (typeof role !== "string" || !(WORKSPACE_MEMBER_ROLES as readonly string[]).includes(role)) {
    return "This Approval node needs a valid minimum approver role.";
  }
  return null;
}

function makeApprovalNode(overrides: Pick<WorkflowNodeDefinition, "id" | "name" | "description" | "icon" | "compileTarget" | "validate">): WorkflowNodeDefinition {
  return {
    kind: "approval",
    category: "approval",
    color: "danger",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    ...overrides,
  };
}

export const managerApprovalNode = makeApprovalNode({
  id: "approval.manager",
  name: "Manager Approval",
  description: "Requires a Manager, Admin, or Owner to explicitly approve before the next step runs.",
  icon: "ShieldCheck",
  compileTarget: "role_restricted",
  validate: validateRoleRestrictedApproval,
});

export const ownerApprovalNode = makeApprovalNode({
  id: "approval.owner",
  name: "Owner Approval",
  description: "Requires an Owner to explicitly approve before the next step runs.",
  icon: "Crown",
  compileTarget: "role_restricted",
  validate: validateRoleRestrictedApproval,
});

export const alwaysRequiredApprovalNode = makeApprovalNode({
  id: "approval.always-required",
  name: "Always Required",
  description: "Requires any active member to explicitly approve before the next step runs.",
  icon: "Lock",
  compileTarget: "always_required",
});

export const neverRequiredApprovalNode = makeApprovalNode({
  id: "approval.never-required",
  name: "Never Required",
  description: "Proceeds automatically — no human approval is requested.",
  icon: "Unlock",
  compileTarget: "never_required",
});

export const approvalNodes: WorkflowNodeDefinition[] = [managerApprovalNode, ownerApprovalNode, alwaysRequiredApprovalNode, neverRequiredApprovalNode];
