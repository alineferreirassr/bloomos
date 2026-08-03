import { describe, expect, it } from "vitest";
import { generateExecutiveReport, type ExecutiveReportInput } from "@/core/executiveDecisions/executiveReportEngine";
import type { Decision, ExecutiveInsights, WorkspaceExecutiveScorecard } from "@/types/executiveDecisions";

const NOW = "2026-07-30T00:00:00.000Z";

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision_1",
    workspace_id: "ws_1",
    title: "Resolve missing contract",
    description: "x",
    category: "compliance",
    priority: "critical",
    status: "open",
    reason: "x",
    generated_by: "x",
    created_at: "2026-01-01T00:00:00.000Z",
    resolved_at: null,
    resolution_notes: null,
    related_entities: [],
    related_assets: [],
    related_objective_ids: [],
    related_timeline_activity_ids: [],
    dependencies: [],
    dedupe_key: "x",
    ...overrides,
  };
}

function makeScorecard(overrides: Partial<WorkspaceExecutiveScorecard> = {}): WorkspaceExecutiveScorecard {
  return { operationalScore: 80, businessScore: 80, decisionScore: 80, readinessScore: 80, knowledgeScore: 80, objectiveScore: 80, overallExecutiveScore: 80, evaluatedAt: NOW, ...overrides };
}

const emptyInsights: ExecutiveInsights = {
  mostImpactedClients: [],
  mostBlockedObjectives: [],
  mostCriticalAssets: [],
  mostReferencedDocuments: [],
  mostViolatedBusinessRules: [],
  mostOverloadedEvents: [],
  mostFragileWorkflows: { entries: [], notApplicableReason: "x" },
};

function makeInput(overrides: Partial<ExecutiveReportInput> = {}): ExecutiveReportInput {
  return { scorecard: makeScorecard(), queue: [], resolvedDecisions: [], blockedDecisions: [], insights: emptyInsights, evaluatedAt: NOW, ...overrides };
}

describe("generateExecutiveReport", () => {
  it("reports an empty queue honestly", () => {
    const report = generateExecutiveReport(makeInput());
    expect(report.decisionQueueSummary).toContain("empty");
    expect(report.criticalIssues).toEqual([]);
  });

  it("lists critical-priority queue items under criticalIssues", () => {
    const queue = [makeDecision({ priority: "critical" }), makeDecision({ id: "d2", priority: "medium", title: "Other" })];
    const report = generateExecutiveReport(makeInput({ queue }));
    expect(report.criticalIssues).toEqual(["Resolve missing contract"]);
  });

  it("splits business vs operational risks by category among high-or-above priority decisions", () => {
    const queue = [
      makeDecision({ id: "d1", category: "compliance", priority: "high", title: "Compliance issue" }),
      makeDecision({ id: "d2", category: "assets", priority: "high", title: "Asset issue" }),
      makeDecision({ id: "d3", category: "operations", priority: "low", title: "Low priority ops" }),
    ];
    const report = generateExecutiveReport(makeInput({ queue }));
    expect(report.businessRisks).toEqual(["Compliance issue"]);
    expect(report.operationalRisks).toEqual(["Asset issue"]);
  });

  it("reports resolved and blocked decision counts honestly", () => {
    const report = generateExecutiveReport(makeInput({ resolvedDecisions: [makeDecision({ id: "r1" })], blockedDecisions: [makeDecision({ id: "b1", title: "Blocked one" })] }));
    expect(report.completedDecisionsSummary).toContain("1");
    expect(report.blockedDecisionsSummary).toContain("Blocked one");
  });

  it("includes insight-derived improvements alongside the queue's own top items", () => {
    const insights: ExecutiveInsights = { ...emptyInsights, mostImpactedClients: [{ node: { nodeType: "client", nodeId: "client_1" }, label: "client:client_1", count: 3 }] };
    const report = generateExecutiveReport(makeInput({ queue: [makeDecision()], insights }));
    expect(report.topImprovements).toContain("Resolve missing contract");
    expect(report.topImprovements.some((s) => s.includes("client:client_1"))).toBe(true);
  });

  it("includes the overall score and queue counts in the executive summary", () => {
    const report = generateExecutiveReport(makeInput({ scorecard: makeScorecard({ overallExecutiveScore: 42 }), queue: [makeDecision()] }));
    expect(report.executiveSummary).toContain("42");
    expect(report.executiveSummary).toContain("1 decision(s)");
  });
});
