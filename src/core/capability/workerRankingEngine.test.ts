import { describe, expect, it } from "vitest";
import { rankWorkers } from "@/core/capability/workerRankingEngine";
import type { CapabilityEligibility, CapabilityScores, EligibilityState } from "@/types/capability";

const NOW = "2026-07-30T00:00:00.000Z";

function makeEligibility(workerId: string, state: EligibilityState, blockingCount = 0): CapabilityEligibility {
  return {
    requirementId: "req_1",
    workerId,
    state,
    blockingReasons: Array.from({ length: blockingCount }, (_, i) => ({ rule: `r${i}`, detail: "x" })),
    satisfiedHardRequirements: [],
    unsatisfiedHardRequirements: [],
    matchedPreferences: [],
    unmatchedPreferences: [],
    expiringSoonCertifications: [],
    unavailableResources: [],
    fallbacksUsed: [],
    evaluatedAt: NOW,
  };
}

function makeScores(workerId: string, overallCapabilityScore: number, overrides: Partial<CapabilityScores> = {}): CapabilityScores {
  return { requirementId: "req_1", workerId, eligibilityScore: 100, skillsMatchScore: 100, certificationScore: 100, experienceScore: 100, languageScore: 100, availabilityScore: 100, equipmentScore: 100, vehicleScore: 100, locationScore: 100, teamFitScore: 100, capacityScore: 100, preferenceScore: 100, overallCapabilityScore, ...overrides };
}

describe("rankWorkers", () => {
  it("ranks eligible above conditionally_eligible above unknown above ineligible", () => {
    const evaluations = [
      { eligibility: makeEligibility("w_ineligible", "ineligible"), scores: makeScores("w_ineligible", 100) },
      { eligibility: makeEligibility("w_eligible", "eligible"), scores: makeScores("w_eligible", 10) },
      { eligibility: makeEligibility("w_unknown", "unknown"), scores: makeScores("w_unknown", 90) },
      { eligibility: makeEligibility("w_conditional", "conditionally_eligible"), scores: makeScores("w_conditional", 50) },
    ];
    const ranked = rankWorkers(evaluations);
    expect(ranked.map((r) => r.workerId)).toEqual(["w_eligible", "w_conditional", "w_unknown", "w_ineligible"]);
  });

  it("only assigns a numeric rank to eligible/conditionally_eligible workers", () => {
    const evaluations = [
      { eligibility: makeEligibility("w1", "eligible"), scores: makeScores("w1", 90) },
      { eligibility: makeEligibility("w2", "ineligible"), scores: makeScores("w2", 90) },
    ];
    const ranked = rankWorkers(evaluations);
    expect(ranked.find((r) => r.workerId === "w1")?.rank).toBe(1);
    expect(ranked.find((r) => r.workerId === "w2")?.rank).toBeNull();
  });

  it("within the same state, orders by overall score descending", () => {
    const evaluations = [
      { eligibility: makeEligibility("w_low", "eligible"), scores: makeScores("w_low", 60) },
      { eligibility: makeEligibility("w_high", "eligible"), scores: makeScores("w_high", 90) },
    ];
    expect(rankWorkers(evaluations).map((r) => r.workerId)).toEqual(["w_high", "w_low"]);
  });

  it("breaks a full tie deterministically by worker id", () => {
    const evaluations = [
      { eligibility: makeEligibility("w_b", "eligible"), scores: makeScores("w_b", 80) },
      { eligibility: makeEligibility("w_a", "eligible"), scores: makeScores("w_a", 80) },
    ];
    expect(rankWorkers(evaluations).map((r) => r.workerId)).toEqual(["w_a", "w_b"]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const evaluations = [
      { eligibility: makeEligibility("w1", "eligible"), scores: makeScores("w1", 70) },
      { eligibility: makeEligibility("w2", "eligible"), scores: makeScores("w2", 70) },
      { eligibility: makeEligibility("w3", "conditionally_eligible"), scores: makeScores("w3", 95) },
    ];
    const a = rankWorkers(evaluations).map((r) => r.workerId);
    const b = rankWorkers(evaluations).map((r) => r.workerId);
    expect(a).toEqual(b);
  });
});
