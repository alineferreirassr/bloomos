import { describe, expect, it } from "vitest";
import { operationalFindingsToRecommendations } from "@/core/operationalPlanning/operationalFindingsEngine";
import type { OperationalFinding, OperationalPlan } from "@/types/operationalPlanning";

const NOW = "2026-01-01T00:00:00.000Z";

function makeFinding(overrides: Partial<OperationalFinding> = {}): OperationalFinding {
  return { id: "finding_1", type: "incomplete_plan", severity: "medium", description: "Plan incomplete.", relatedPlanId: null, relatedStepId: null, ...overrides };
}

function makePlan(overrides: Partial<OperationalPlan> = {}): OperationalPlan {
  return { id: "plan_1", workspace_id: "ws_1", name: "Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" }, phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], status: "draft", version: 1, created_by: "member_1", created_at: NOW, updated_at: NOW, approved_at: null, approved_by: null, archived_at: null, ...overrides };
}

describe("operationalFindingsToRecommendations", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings = [makeFinding({ severity: "high" }), makeFinding({ severity: "medium" }), makeFinding({ severity: "low" })];
    const result = operationalFindingsToRecommendations(findings, [], "ws_1");
    expect(result.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("resolves the node from the related plan's own context", () => {
    const finding = makeFinding({ relatedPlanId: "plan_1" });
    const result = operationalFindingsToRecommendations([finding], [makePlan()], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("falls back to the workspace node when nothing resolves", () => {
    const result = operationalFindingsToRecommendations([makeFinding()], [], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("prefixes ruleId with operational_planning.", () => {
    const result = operationalFindingsToRecommendations([makeFinding({ type: "missing_checklist" })], [], "ws_1");
    expect(result[0].ruleId).toBe("operational_planning.missing_checklist");
  });
});
