import { describe, expect, it } from "vitest";
import { computeOperationsCenterHealth, type HealthCompositionInput } from "@/core/operationsCenter/operationsCenterHealthEngine";

function baseInput(overrides: Partial<HealthCompositionInput> = {}): HealthCompositionInput {
  return {
    businessHealthScore: 100,
    objectiveHealthScore: 100,
    packageHealthScores: [],
    schedulingHealthScores: [],
    knowledgeIssueCount: 0,
    allocationFindingCounts: { high: 0, medium: 0 },
    workforceScorecard: null,
    dispatchHealthScores: [],
    executionHealthScores: [],
    routeHealthScores: [],
    ...overrides,
  };
}

describe("computeOperationsCenterHealth", () => {
  it("is vacuous-100 across every component when every input is empty/perfect", () => {
    const scores = computeOperationsCenterHealth(baseInput());
    expect(scores.dispatchHealth).toBe(100);
    expect(scores.executionHealth).toBe(100);
    expect(scores.routeHealth).toBe(100);
    expect(scores.schedulingHealth).toBe(100);
    expect(scores.allocationHealth).toBe(100);
    expect(scores.packageHealth).toBe(100);
    expect(scores.workforceHealth).toBe(100);
    expect(scores.overallOperationsCenterHealth).toBe(100);
  });

  it("reuses businessHealthScore and objectiveHealthScore verbatim, never recalculating them", () => {
    const scores = computeOperationsCenterHealth(baseInput({ businessHealthScore: 62, objectiveHealthScore: 74 }));
    expect(scores.businessHealth).toBe(62);
    expect(scores.objectiveHealth).toBe(74);
  });

  it("averages per-record health arrays for dispatch, execution, route, scheduling, and package health", () => {
    const scores = computeOperationsCenterHealth(baseInput({ dispatchHealthScores: [80, 60], executionHealthScores: [90, 70], routeHealthScores: [50], schedulingHealthScores: [100, 80], packageHealthScores: [40, 60] }));
    expect(scores.dispatchHealth).toBe(70);
    expect(scores.executionHealth).toBe(80);
    expect(scores.routeHealth).toBe(50);
    expect(scores.schedulingHealth).toBe(90);
    expect(scores.packageHealth).toBe(50);
  });

  it("normalizes knowledge health from a disclosed issue-count penalty, floored at 0", () => {
    expect(computeOperationsCenterHealth(baseInput({ knowledgeIssueCount: 5 })).knowledgeHealth).toBe(75);
    expect(computeOperationsCenterHealth(baseInput({ knowledgeIssueCount: 100 })).knowledgeHealth).toBe(0);
  });

  it("computes allocation health as a severity-weighted finding-count penalty, floored at 0", () => {
    expect(computeOperationsCenterHealth(baseInput({ allocationFindingCounts: { high: 2, medium: 4 } })).allocationHealth).toBe(60);
    expect(computeOperationsCenterHealth(baseInput({ allocationFindingCounts: { high: 20, medium: 0 } })).allocationHealth).toBe(0);
  });

  it("computes workforce health as the available/total ratio from the Workforce Scorecard, never a new eligibility calculation", () => {
    expect(computeOperationsCenterHealth(baseInput({ workforceScorecard: { availableNow: 3, totalWorkers: 10 } })).workforceHealth).toBe(30);
  });

  it("is vacuous-100 for workforce health when there are no workers to score at all", () => {
    expect(computeOperationsCenterHealth(baseInput({ workforceScorecard: { availableNow: 0, totalWorkers: 0 } })).workforceHealth).toBe(100);
  });

  it("computes overallOperationsCenterHealth as an unweighted average of every component", () => {
    const scores = computeOperationsCenterHealth(baseInput({ businessHealthScore: 0, objectiveHealthScore: 100, dispatchHealthScores: [100], executionHealthScores: [100], routeHealthScores: [100], schedulingHealthScores: [100], packageHealthScores: [100], workforceScorecard: { availableNow: 10, totalWorkers: 10 } }));
    // components: dispatch 100, execution 100, route 100, scheduling 100, allocation 100, package 100, workforce 100, business 0, knowledge 100, objective 100 -> 900/10 = 90
    expect(scores.overallOperationsCenterHealth).toBe(90);
  });
});
