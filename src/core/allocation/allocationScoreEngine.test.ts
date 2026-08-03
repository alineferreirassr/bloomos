import { describe, expect, it } from "vitest";
import { computeCapabilityFitScore, computeScheduleFitScore, computeDependencyHealthScore, computeCapacityHealthScore, computePreferenceMatchScore, computeOverallAllocationScore, computeAllocationScores, type AllocationScoreInput } from "@/core/allocation/allocationScoreEngine";
import type { DependencyRule } from "@/types/allocation";

const rule: DependencyRule = { id: "rule_1", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: "Drone", requires_resource_type: "worker", requires_skill: null, requires_certification: "Drone Operator", description: "desc" };

describe("computeCapabilityFitScore", () => {
  it("is a vacuous 100 with no requirements at all", () => {
    expect(computeCapabilityFitScore([], 0)).toBe(100);
  });

  it("is 0, not vacuous, when requirements existed but nothing was selected", () => {
    expect(computeCapabilityFitScore([], 3)).toBe(0);
  });

  it("averages the selected candidates' own scores", () => {
    expect(computeCapabilityFitScore([80, 60], 2)).toBe(70);
  });
});

describe("computeScheduleFitScore / ratio-based scores", () => {
  it("is a vacuous 100 with no selected candidates", () => {
    expect(computeScheduleFitScore(0, 0)).toBe(100);
  });

  it("computes the fit ratio as a percentage", () => {
    expect(computeScheduleFitScore(1, 2)).toBe(50);
  });
});

describe("computeDependencyHealthScore", () => {
  it("is a vacuous 100 with no applicable dependency rules", () => {
    expect(computeDependencyHealthScore([])).toBe(100);
  });

  it("scores the fraction of satisfied dependencies", () => {
    const results = [
      { rule, satisfied: true, satisfiedByResourceId: "worker_1" },
      { rule, satisfied: false, satisfiedByResourceId: null },
    ];
    expect(computeDependencyHealthScore(results)).toBe(50);
  });
});

describe("computeCapacityHealthScore", () => {
  it("is a vacuous 100 with no capacity checks", () => {
    expect(computeCapacityHealthScore([])).toBe(100);
  });

  it("scores the fraction of checks that stayed within capacity", () => {
    expect(computeCapacityHealthScore([{ scope: "team", withinCapacity: true }, { scope: "worker", withinCapacity: false }])).toBe(50);
  });
});

describe("computePreferenceMatchScore", () => {
  it("is a vacuous 100 with no selected candidates", () => {
    expect(computePreferenceMatchScore(0, 0)).toBe(100);
  });

  it("scores the fraction of selected candidates that were preferred", () => {
    expect(computePreferenceMatchScore(1, 4)).toBe(25);
  });
});

describe("computeOverallAllocationScore", () => {
  it("averages the seven component scores", () => {
    const result = computeOverallAllocationScore({ capabilityFitScore: 100, scheduleFitScore: 100, availabilityFitScore: 100, bundleCompletenessScore: 100, dependencyHealthScore: 100, capacityHealthScore: 100, preferenceMatchScore: 30 });
    expect(result).toBe(90);
  });
});

describe("computeAllocationScores", () => {
  it("returns a perfect scorecard for a fully-vacuous input", () => {
    const input: AllocationScoreInput = {
      selectedCandidateScores: [],
      totalRequiredCandidates: 0,
      totalSelectedCandidates: 0,
      scheduleFitCount: 0,
      availabilityFitCount: 0,
      bundleCompleteness: null,
      dependencyResults: [],
      capacityChecks: [],
      preferredMatchCount: 0,
    };
    const result = computeAllocationScores(input);
    expect(result.overallAllocationScore).toBe(100);
    expect(result.capabilityFitScore).toBe(100);
  });

  it("degrades capabilityFitScore to 0 when candidates were required but none selected", () => {
    const input: AllocationScoreInput = {
      selectedCandidateScores: [],
      totalRequiredCandidates: 2,
      totalSelectedCandidates: 0,
      scheduleFitCount: 0,
      availabilityFitCount: 0,
      bundleCompleteness: null,
      dependencyResults: [],
      capacityChecks: [],
      preferredMatchCount: 0,
    };
    const result = computeAllocationScores(input);
    expect(result.capabilityFitScore).toBe(0);
    expect(result.overallAllocationScore).toBeLessThan(100);
  });
});
