import { getAutomationManager } from "@/core/automation/manager";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { AutomationApprovalPolicy } from "@/types/automation";

/**
 * The Step 4 Approval Engine. Two distinct questions, kept separate on
 * purpose: `resolveApprovalRequirement` answers "does this execution need
 * a human's explicit approval at all," `canGrantApproval` answers "is
 * *this* member allowed to grant it" — a `"role_restricted"` policy always
 * requires approval (the first question), but restricts *who* may supply
 * it (the second).
 */

export interface ApprovalRequirementContext {
  workspaceId: string;
  automationId: string;
  policy: AutomationApprovalPolicy;
}

/**
 * `"workspace_configurable"` defers to a per-Workspace, per-Automation
 * override (`AutomationManager.getApprovalOverride`) — `null` (never set)
 * defaults to **required**, the safer of the two options, matching
 * `PRODUCT_PRINCIPLES.md` #4's "AI assists humans; it never replaces
 * business approval" even where this policy exists specifically to let a
 * Workspace loosen that default deliberately.
 */
export async function resolveApprovalRequirement(context: ApprovalRequirementContext): Promise<boolean> {
  switch (context.policy.kind) {
    case "always_required":
    case "role_restricted":
      return true;
    case "never_required":
      return false;
    case "workspace_configurable": {
      const override = await getAutomationManager().getApprovalOverride(context.workspaceId, context.automationId);
      return override ?? true;
    }
    default:
      return true;
  }
}

export interface ApprovalGrantContext {
  policy: AutomationApprovalPolicy;
  approverRole: WorkspaceMemberRole | null;
}

/** Only `"role_restricted"` ever narrows who may approve; every other policy accepts any approver, since the requirement question is already settled by `resolveApprovalRequirement`. */
export function canGrantApproval(context: ApprovalGrantContext): boolean {
  if (context.policy.kind !== "role_restricted") return true;
  if (!context.policy.minimumApproverRole) return true;
  if (!context.approverRole) return false;
  return WORKSPACE_MEMBER_ROLES.indexOf(context.approverRole) <= WORKSPACE_MEMBER_ROLES.indexOf(context.policy.minimumApproverRole);
}
