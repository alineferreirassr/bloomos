import { describe, expect, it } from "vitest";
import { computePriority, computePriorityScore, type DecisionFactors } from "@/core/executiveDecisions/priorityEngine";

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

describe("computePriorityScore", () => {
  it("is 0 for a factor set with no signals", () => {
    expect(computePriorityScore(makeFactors())).toBe(0);
  });

  it("never exceeds 100 even when every factor is maxed", () => {
    const score = computePriorityScore(
      makeFactors({ businessImpactCount: 50, unmetDependencyCount: 50, blockingRelationshipsCount: 50, operationalReadiness: 0, objectiveBlocked: true, businessRuleSeverity: "hard", ageDays: 365, riskFlag: true }),
    );
    expect(score).toBe(100);
  });

  it("increases with age up to the disclosed cap", () => {
    const at10Days = computePriorityScore(makeFactors({ ageDays: 10 }));
    const at100Days = computePriorityScore(makeFactors({ ageDays: 100 }));
    expect(at10Days).toBeGreaterThan(0);
    expect(at100Days).toBe(15); // capped
  });

  it("is deterministic — identical factors always produce the identical score", () => {
    const factors = makeFactors({ businessImpactCount: 3, ageDays: 5, riskFlag: true });
    expect(computePriorityScore(factors)).toBe(computePriorityScore(factors));
  });
});

describe("computePriority", () => {
  it("buckets a zero-signal decision as informational", () => {
    expect(computePriority(makeFactors())).toBe("informational");
  });

  it("buckets a maxed-out decision as critical", () => {
    expect(computePriority(makeFactors({ businessImpactCount: 10, unmetDependencyCount: 10, blockingRelationshipsCount: 10, businessRuleSeverity: "hard", objectiveBlocked: true, riskFlag: true }))).toBe("critical");
  });

  it("buckets a hard business rule violation with no other signal above informational", () => {
    const priority = computePriority(makeFactors({ businessRuleSeverity: "hard" }));
    expect(priority).not.toBe("informational");
  });
});
