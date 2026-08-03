import { describe, expect, it } from "vitest";
import { buildExecutiveQueue, isQueueEligible, orderExecutiveQueue } from "@/core/executiveDecisions/executiveQueueEngine";
import type { Decision, DecisionScores } from "@/types/executiveDecisions";

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision_1",
    workspace_id: "ws_1",
    title: "x",
    description: "x",
    category: "operations",
    priority: "medium",
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

function makeScores(overrides: Partial<DecisionScores> = {}): DecisionScores {
  return {
    decisionScore: 50,
    urgencyScore: 50,
    businessImpactScore: 50,
    dependencyScore: 100,
    riskScore: 50,
    complexityScore: 0,
    confidence: 100,
    overallExecutiveScore: 50,
    readiness: { source: "fallback", value: 50, isFallback: true, priorityContribution: 10 },
    ...overrides,
  };
}

describe("isQueueEligible", () => {
  it("excludes resolved and archived decisions, includes everything else", () => {
    expect(isQueueEligible(makeDecision({ status: "resolved" }))).toBe(false);
    expect(isQueueEligible(makeDecision({ status: "archived" }))).toBe(false);
    expect(isQueueEligible(makeDecision({ status: "open" }))).toBe(true);
    expect(isQueueEligible(makeDecision({ status: "escalated" }))).toBe(true);
  });
});

describe("orderExecutiveQueue", () => {
  it("orders critical before high before medium before low before informational", () => {
    const decisions = [makeDecision({ id: "d_low", priority: "low" }), makeDecision({ id: "d_critical", priority: "critical" }), makeDecision({ id: "d_medium", priority: "medium" })];
    const ordered = orderExecutiveQueue(decisions, new Map());
    expect(ordered.map((d) => d.id)).toEqual(["d_critical", "d_medium", "d_low"]);
  });

  it("breaks priority ties by overallExecutiveScore descending", () => {
    const decisions = [makeDecision({ id: "d_low_score", priority: "high" }), makeDecision({ id: "d_high_score", priority: "high" })];
    const scores = new Map([
      ["d_low_score", makeScores({ overallExecutiveScore: 30 })],
      ["d_high_score", makeScores({ overallExecutiveScore: 90 })],
    ]);
    expect(orderExecutiveQueue(decisions, scores).map((d) => d.id)).toEqual(["d_high_score", "d_low_score"]);
  });

  it("breaks remaining ties by created_at ascending (older first)", () => {
    const decisions = [
      makeDecision({ id: "d_newer", priority: "high", created_at: "2026-02-01T00:00:00.000Z" }),
      makeDecision({ id: "d_older", priority: "high", created_at: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(orderExecutiveQueue(decisions, new Map()).map((d) => d.id)).toEqual(["d_older", "d_newer"]);
  });

  it("is deterministic for identical input", () => {
    const decisions = [makeDecision({ id: "d1", priority: "high" }), makeDecision({ id: "d2", priority: "critical" })];
    expect(orderExecutiveQueue(decisions, new Map())).toEqual(orderExecutiveQueue(decisions, new Map()));
  });
});

describe("buildExecutiveQueue", () => {
  it("filters out resolved/archived decisions before ordering", () => {
    const decisions = [makeDecision({ id: "d_open", status: "open" }), makeDecision({ id: "d_resolved", status: "resolved" })];
    expect(buildExecutiveQueue(decisions, new Map()).map((d) => d.id)).toEqual(["d_open"]);
  });
});
