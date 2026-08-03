import { describe, expect, it } from "vitest";
import { computeExecutiveScorecard, type ComputeExecutiveScorecardInput } from "@/core/executiveDecisions/executiveScorecardEngine";

const NOW = "2026-07-30T00:00:00.000Z";

function makeInput(overrides: Partial<ComputeExecutiveScorecardInput> = {}): ComputeExecutiveScorecardInput {
  return {
    businessHealthOverallScore: 80,
    knowledgeHealthCategoryScore: 90,
    objectiveOverallOperationalScore: 70,
    operationalProgress: 60,
    readinessScores: [80, 60],
    openDecisionScores: [50, 70],
    evaluatedAt: NOW,
    ...overrides,
  };
}

describe("computeExecutiveScorecard", () => {
  it("passes businessHealthOverallScore and objectiveOverallOperationalScore straight through", () => {
    const scorecard = computeExecutiveScorecard(makeInput());
    expect(scorecard.businessScore).toBe(80);
    expect(scorecard.objectiveScore).toBe(70);
  });

  it("passes operationalProgress straight through as operationalScore", () => {
    expect(computeExecutiveScorecard(makeInput({ operationalProgress: 45 })).operationalScore).toBe(45);
  });

  it("averages readinessScores and openDecisionScores", () => {
    const scorecard = computeExecutiveScorecard(makeInput());
    expect(scorecard.readinessScore).toBe(70);
    expect(scorecard.decisionScore).toBe(60);
  });

  it("defaults readinessScore and decisionScore to 100 when there is no data", () => {
    const scorecard = computeExecutiveScorecard(makeInput({ readinessScores: [], openDecisionScores: [] }));
    expect(scorecard.readinessScore).toBe(100);
    expect(scorecard.decisionScore).toBe(100);
  });

  it("defaults knowledgeScore to 100 when the category is notApplicable (null)", () => {
    expect(computeExecutiveScorecard(makeInput({ knowledgeHealthCategoryScore: null })).knowledgeScore).toBe(100);
  });

  it("computes overallExecutiveScore as the even blend of all six scores", () => {
    const scorecard = computeExecutiveScorecard(makeInput());
    const expected = Math.round((80 + 70 + 60 + 70 + 90 + 60) / 6);
    expect(scorecard.overallExecutiveScore).toBe(expected);
  });

  it("passes evaluatedAt straight through", () => {
    expect(computeExecutiveScorecard(makeInput()).evaluatedAt).toBe(NOW);
  });
});
