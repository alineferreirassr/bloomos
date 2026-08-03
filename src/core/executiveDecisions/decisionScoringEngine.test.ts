import { describe, expect, it } from "vitest";
import { computeDecisionScores } from "@/core/executiveDecisions/decisionScoringEngine";
import type { DecisionFactors } from "@/core/executiveDecisions/priorityEngine";
import type { ReadinessResolution } from "@/types/executiveDecisions";

function makeFactors(overrides: Partial<DecisionFactors> = {}): DecisionFactors {
  return {
    businessImpactCount: 0,
    dependencyCount: 0,
    unmetDependencyCount: 0,
    blockingRelationshipsCount: 0,
    operationalReadiness: null,
    objectiveBlocked: false,
    businessRuleSeverity: null,
    ageDays: 0,
    riskFlag: false,
    ...overrides,
  };
}

function makeReadiness(overrides: Partial<ReadinessResolution> = {}): ReadinessResolution {
  return { source: "fallback", value: 50, isFallback: true, priorityContribution: 10, ...overrides };
}

describe("computeDecisionScores", () => {
  it("returns all zeros (except confidence) for a zero-signal decision, with reduced confidence", () => {
    const scores = computeDecisionScores(makeFactors(), makeReadiness());
    expect(scores.urgencyScore).toBe(0);
    expect(scores.businessImpactScore).toBe(0);
    expect(scores.riskScore).toBe(0);
    expect(scores.confidence).toBe(60);
  });

  it("gives full confidence and a nonzero businessImpactScore once the decision has real business impact", () => {
    const scores = computeDecisionScores(makeFactors({ businessImpactCount: 2 }), makeReadiness());
    expect(scores.confidence).toBe(100);
    expect(scores.businessImpactScore).toBeGreaterThan(0);
  });

  it("computes dependencyScore as the fraction of satisfied dependencies, defaulting to 100 with none", () => {
    expect(computeDecisionScores(makeFactors(), makeReadiness()).dependencyScore).toBe(100);
    expect(computeDecisionScores(makeFactors({ dependencyCount: 4, unmetDependencyCount: 1 }), makeReadiness()).dependencyScore).toBe(75);
    expect(computeDecisionScores(makeFactors({ dependencyCount: 4, unmetDependencyCount: 4 }), makeReadiness()).dependencyScore).toBe(0);
  });

  it("weights a hard business rule violation into riskScore more than a soft one", () => {
    const hard = computeDecisionScores(makeFactors({ businessRuleSeverity: "hard" }), makeReadiness()).riskScore;
    const soft = computeDecisionScores(makeFactors({ businessRuleSeverity: "soft" }), makeReadiness()).riskScore;
    expect(hard).toBeGreaterThan(soft);
  });

  it("never lets any score exceed 100", () => {
    const scores = computeDecisionScores(
      makeFactors({ businessImpactCount: 50, dependencyCount: 50, unmetDependencyCount: 50, blockingRelationshipsCount: 50, ageDays: 365, businessRuleSeverity: "hard", objectiveBlocked: true, riskFlag: true }),
      makeReadiness(),
    );
    expect(scores.decisionScore).toBeLessThanOrEqual(100);
    expect(scores.urgencyScore).toBeLessThanOrEqual(100);
    expect(scores.businessImpactScore).toBeLessThanOrEqual(100);
    expect(scores.dependencyScore).toBeLessThanOrEqual(100);
    expect(scores.riskScore).toBeLessThanOrEqual(100);
    expect(scores.complexityScore).toBeLessThanOrEqual(100);
    expect(scores.confidence).toBeLessThanOrEqual(100);
    expect(scores.overallExecutiveScore).toBeLessThanOrEqual(100);
  });

  it("computes overallExecutiveScore as decisionScore adjusted by confidence", () => {
    const noImpact = computeDecisionScores(makeFactors({ ageDays: 10 }), makeReadiness());
    expect(noImpact.overallExecutiveScore).toBe(Math.round(noImpact.decisionScore * 0.6));
  });

  it("is deterministic", () => {
    const factors = makeFactors({ businessImpactCount: 3, ageDays: 5, riskFlag: true });
    const readiness = makeReadiness();
    expect(computeDecisionScores(factors, readiness)).toEqual(computeDecisionScores(factors, readiness));
  });

  it("attaches the readiness resolution as traceability metadata, unchanged", () => {
    const readiness = makeReadiness({ source: "proposal", value: 40, isFallback: false, priorityContribution: 12 });
    const scores = computeDecisionScores(makeFactors(), readiness);
    expect(scores.readiness).toEqual(readiness);
  });

  it("does not let readiness affect urgency, business impact, risk, or complexity (no double-counting)", () => {
    const withLowReadiness = computeDecisionScores(makeFactors({ ageDays: 5, businessImpactCount: 2, riskFlag: true, dependencyCount: 2 }), makeReadiness({ value: 5 }));
    const withHighReadiness = computeDecisionScores(makeFactors({ ageDays: 5, businessImpactCount: 2, riskFlag: true, dependencyCount: 2 }), makeReadiness({ value: 95 }));
    expect(withLowReadiness.urgencyScore).toBe(withHighReadiness.urgencyScore);
    expect(withLowReadiness.businessImpactScore).toBe(withHighReadiness.businessImpactScore);
    expect(withLowReadiness.riskScore).toBe(withHighReadiness.riskScore);
    expect(withLowReadiness.complexityScore).toBe(withHighReadiness.complexityScore);
  });
});
