import type { RecommendationSource } from "@/core/executiveDecisions/executiveDecisionEngine";
import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { WorkspaceWorkflowHealthSummary } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 addendum — merges the original Checkpoint 39 Task #733
 * "Workflow Recommendations via Executive Decisions." Translates
 * `WorkspaceWorkflowHealthSummary` (`healthEngine.ts`) into the exact
 * `OperationalRecommendation` shape `businessHealthEngine.ts` and
 * `executiveDecisionEngine.ts` already both consume — no new
 * recommendation model, no duplicated scoring. `"workflow"` is already a
 * real `KnowledgeNodeType`.
 */
function severityForFindingCode(code: string): RecommendationSeverity {
  if (code === "structural" || code === "dead_branch") return "critical";
  if (code === "unused_workflow" || code === "disabled_workflow") return "warning";
  return "info";
}

export function workflowHealthToRecommendations(summary: WorkspaceWorkflowHealthSummary): OperationalRecommendation[] {
  const recommendations: OperationalRecommendation[] = [];

  for (const report of summary.reports) {
    const node = { nodeType: "workflow" as const, nodeId: report.workflowId };
    for (const issue of report.structuralIssues) {
      recommendations.push({ ruleId: `workflow_structural_${issue.code}`, message: `"${report.workflowName}": ${issue.message}`, severity: "critical", node });
    }
    for (const finding of report.findings) {
      recommendations.push({ ruleId: `workflow_health_${finding.code}`, message: `"${report.workflowName}": ${finding.message}`, severity: severityForFindingCode(finding.code), node });
    }
  }

  return recommendations;
}

/** A ready-to-append `RecommendationSource` for `generateDecisionDrafts()`'s own `recommendationSources` array. */
export function workflowHealthRecommendationSource(summary: WorkspaceWorkflowHealthSummary): RecommendationSource {
  return { generatedBy: "workflow_health_engine", recommendations: workflowHealthToRecommendations(summary) };
}
