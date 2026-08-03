import { describe, expect, it } from "vitest";
import { workflowHealthRecommendationSource, workflowHealthToRecommendations } from "@/core/workflowMonitoring/executiveIntegration";
import type { WorkspaceWorkflowHealthSummary } from "@/types/workflowMonitoring";

function summaryWithReport(overrides: Partial<WorkspaceWorkflowHealthSummary["reports"][number]> = {}): WorkspaceWorkflowHealthSummary {
  return {
    reports: [
      {
        workflowId: "wf_1",
        workflowName: "Welcome Flow",
        status: "published",
        structuralIssues: [{ code: "missing_action", message: "No Action node is reachable.", nodeId: null, edgeId: null }],
        findings: [{ code: "unused_workflow", message: '"Welcome Flow" is published but has never executed.', nodeId: null }],
        score: 70,
        evaluatedAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
      },
    ],
    averageScore: 70,
    totalFindings: 2,
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("workflowHealthToRecommendations", () => {
  it("translates every structural issue and finding into an OperationalRecommendation against a real 'workflow' node ref", () => {
    const recommendations = workflowHealthToRecommendations(summaryWithReport());
    expect(recommendations).toHaveLength(2);
    expect(recommendations.every((rec) => rec.node.nodeType === "workflow" && rec.node.nodeId === "wf_1")).toBe(true);
  });

  it("marks a structural issue as critical severity", () => {
    const [structural] = workflowHealthToRecommendations(summaryWithReport());
    expect(structural.severity).toBe("critical");
    expect(structural.ruleId).toBe("workflow_structural_missing_action");
  });

  it("marks an unused_workflow finding as warning severity", () => {
    const [, finding] = workflowHealthToRecommendations(summaryWithReport());
    expect(finding.severity).toBe("warning");
    expect(finding.ruleId).toBe("workflow_health_unused_workflow");
  });

  it("returns no recommendations for a clean workspace", () => {
    const clean: WorkspaceWorkflowHealthSummary = { reports: [], averageScore: null, totalFindings: 0, evaluatedAt: "2026-01-01T00:00:00.000Z" };
    expect(workflowHealthToRecommendations(clean)).toEqual([]);
  });
});

describe("workflowHealthRecommendationSource", () => {
  it("wraps the recommendations under the 'workflow_health_engine' generatedBy — the same RecommendationSource contract every other platform uses", () => {
    const source = workflowHealthRecommendationSource(summaryWithReport());
    expect(source.generatedBy).toBe("workflow_health_engine");
    expect(source.recommendations).toHaveLength(2);
  });
});
