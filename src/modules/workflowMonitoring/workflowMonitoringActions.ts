"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getAutomationManager } from "@/core/automation/manager";
import { listAutomations } from "@/core/automation/registry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { computeWorkspaceWorkflowHealth } from "@/core/workflowMonitoring/healthEngine";
import { workflowHealthToRecommendations } from "@/core/workflowMonitoring/executiveIntegration";
import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import { nowIso } from "@/lib/data/utils";
import type { OperationalRecommendation } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 39 addendum — merges the original Checkpoint 39 Task #733
 * "Workflow Recommendations via Executive Decisions." Mirrors the exact
 * `xRecommendationsForExecutiveDecisions()` shape every other platform in
 * this codebase already exports (`journeyRecommendationsForExecutiveDecisions`,
 * `contractRecommendationsForExecutiveDecisions`, etc.) — self-contained,
 * resolves its own session, never blocks Executive Decision evaluation on
 * a workspace with no workflows.
 */
export async function workflowRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const workspaceId = session.workspace.id;

  const [workflows, executions] = await Promise.all([getWorkflowManager().listWorkflows(workspaceId), getAutomationManager().getRecentExecutions(workspaceId, 500)]);
  if (workflows.length === 0) return [];

  const automations = listAutomations();
  const usedWorkflowIds = new Set(
    buildWorkflowExecutionSummaries(executions, automations)
      .map((summary) => summary.workflowId)
      .filter((id): id is string => id !== null),
  );
  const disabledWorkflowIds = new Set(
    (
      await Promise.all(
        workflows
          .filter((workflow) => workflow.executionPolicy.featureFlag !== null)
          .map(async (workflow) => ({ id: workflow.id, enabled: await evaluateFeatureFlag(workspaceId, workflow.executionPolicy.featureFlag!) })),
      )
    )
      .filter((entry) => !entry.enabled)
      .map((entry) => entry.id),
  );

  const health = computeWorkspaceWorkflowHealth(workflows, { usedWorkflowIds, disabledWorkflowIds }, nowIso());
  return workflowHealthToRecommendations(health);
}
