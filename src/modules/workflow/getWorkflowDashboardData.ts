"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { getWorkflowManager } from "@/core/workflow/manager";
import { validateWorkflow } from "@/core/workflow/validation";
import { getLogger } from "@/core/observability/logger";

registerWorkflowNodes();

const GENERIC_ACCESS_ERROR = "The Workflow dashboard isn't available right now.";

export interface WorkflowValidationSummaryEntry {
  workflowId: string;
  workflowName: string;
  issueCount: number;
}

export interface WorkflowAutomationUsageEntry {
  workflowId: string;
  workflowName: string;
  version: number;
  automationCount: number;
}

export interface WorkflowDashboardData {
  totalWorkflows: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
  /** Every non-archived Workflow whose current draft graph has at least one validation issue right now. */
  workflowsWithValidationErrors: WorkflowValidationSummaryEntry[];
  /** Step 13's own "Automation Usage" — every published Workflow's own latest version, and how many real Automations it currently has registered. */
  automationUsage: WorkflowAutomationUsageEntry[];
}

export type GetWorkflowDashboardDataResult = { success: true; data: WorkflowDashboardData } | { success: false; error: string };

/**
 * The Step 13 Dashboard's own aggregate — one call, computed fresh, the
 * same "no hand-maintained UI array" shape every other Dashboard in this
 * codebase already uses. "Execution Links"/"Automation Usage" both read
 * straight off `WorkflowVersion.compiledAutomationIds` — the real ids
 * registered in the Automation Engine — rather than a second, separately
 * tracked count; the Automation Dashboard itself (`/automation`) is where
 * a member follows those links to see real executions.
 */
export async function getWorkflowDashboardData(): Promise<GetWorkflowDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getWorkflowManager();
  const workflows = await manager.listWorkflows(session.workspace.id);

  const workflowsWithValidationErrors: WorkflowValidationSummaryEntry[] = [];
  const automationUsage: WorkflowAutomationUsageEntry[] = [];

  for (const workflow of workflows) {
    if (workflow.status !== "archived") {
      const validation = validateWorkflow(workflow.graph);
      if (validation.issues.length > 0) {
        workflowsWithValidationErrors.push({ workflowId: workflow.id, workflowName: workflow.metadata.name, issueCount: validation.issues.length });
      }
    }
    if (workflow.status === "published" && workflow.currentVersion > 0) {
      const version = await manager.getWorkflowVersion(workflow.id, workflow.currentVersion);
      if (version) {
        automationUsage.push({ workflowId: workflow.id, workflowName: workflow.metadata.name, version: version.version, automationCount: version.compiledAutomationIds.length });
      }
    }
  }

  // Step 16's own "Track... execution link" — the moment a member's own
  // Dashboard view resolves the Workflow → compiled-Automation linkage
  // (what "Open Automation Center" actually points at), safe fields only.
  getLogger().info("Workflow execution links resolved", {
    workspaceId: session.workspace.id,
    publishedWorkflowCount: automationUsage.length,
    totalLinkedAutomations: automationUsage.reduce((sum, entry) => sum + entry.automationCount, 0),
  });

  return {
    success: true,
    data: {
      totalWorkflows: workflows.length,
      publishedCount: workflows.filter((workflow) => workflow.status === "published").length,
      draftCount: workflows.filter((workflow) => workflow.status === "draft").length,
      archivedCount: workflows.filter((workflow) => workflow.status === "archived").length,
      workflowsWithValidationErrors,
      automationUsage,
    },
  };
}
