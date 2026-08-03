"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { getWorkflowManager } from "@/core/workflow/manager";
import { listWorkflowNodesForWorkspace } from "@/core/workflow/nodeDiscovery";
import { validateWorkflow } from "@/core/workflow/validation";
import { computeWorkflowNodeExecutionStats } from "@/core/workflow/nodeExecutionStats";
import { listAutomations } from "@/core/automation/registry";
import { getAutomationManager } from "@/core/automation/manager";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Workflow, WorkflowNodeCategory, WorkflowNodeExecutionStats, WorkflowNodeKind, WorkflowValidationResult, WorkflowVersion } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

registerWorkflowNodes();

/**
 * `WorkflowNodeDefinition` minus its own `validate` function — the same
 * RSC-boundary-safety reason `AutomationActionSummary` exists in
 * `getAutomationDashboardData.ts` (Checkpoint 9): a function prop can't
 * cross a Server Action → Client Component boundary.
 */
export interface WorkflowNodeSummary {
  id: string;
  kind: WorkflowNodeKind;
  category: WorkflowNodeCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  compileTarget: string | null;
}

export interface WorkflowEditorData {
  workflow: Workflow;
  nodeCatalog: WorkflowNodeSummary[];
  validation: WorkflowValidationResult;
  versions: WorkflowVersion[];
  canPublish: boolean;
  /** v2.0 Checkpoint 39 addendum (Workflow Studio) — real per-node execution stats, keyed by node id. Empty for a node that has never executed. */
  nodeExecutionStats: Record<string, WorkflowNodeExecutionStats>;
}

export type GetWorkflowEditorDataResult = { success: true; data: WorkflowEditorData } | { success: false; error: string };

/**
 * The Step 7 Workflow Editor's own one-call aggregate — the Workflow
 * itself, its own workspace-visible Node Library catalog, a fresh
 * pre-publish validation pass (recomputed every load, never persisted —
 * Step 5's own "no runtime validation" extends to "never a stale cached
 * result either"), and its Version History.
 */
export async function getWorkflowEditorData(workflowId: string): Promise<GetWorkflowEditorDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workflow = await getWorkflowManager().getWorkflowById(workflowId);
  if (!workflow || workflow.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const [nodeCatalog, versions, recentExecutions] = await Promise.all([
    listWorkflowNodesForWorkspace({ workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role }),
    getWorkflowManager().getWorkflowVersions(workflow.id),
    getAutomationManager().getRecentExecutions(session.workspace.id, 500),
  ]);
  const nodeExecutionStats = computeWorkflowNodeExecutionStats(workflow.id, listAutomations(), recentExecutions);

  return {
    success: true,
    data: {
      workflow,
      nodeCatalog: nodeCatalog.map(({ id, kind, category, name, description, icon, color, requiredPermissions, featureFlag, minimumRole, compileTarget }) => ({
        id,
        kind,
        category,
        name,
        description,
        icon,
        color,
        requiredPermissions,
        featureFlag,
        minimumRole,
        compileTarget,
      })),
      validation: validateWorkflow(workflow.graph),
      versions,
      canPublish: session.permissions.includes("workspace.manage"),
      nodeExecutionStats,
    },
  };
}
