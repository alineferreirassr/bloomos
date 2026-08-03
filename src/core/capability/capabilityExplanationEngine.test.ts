import { describe, expect, it } from "vitest";
import { explainCapabilityEvaluation } from "@/core/capability/capabilityExplanationEngine";
import type { CapabilityEligibility, CapabilityScores } from "@/types/capability";

const NOW = "2026-07-30T00:00:00.000Z";

function makeEligibility(overrides: Partial<CapabilityEligibility> = {}): CapabilityEligibility {
  return {
    requirementId: "req_1",
    workerId: "worker_1",
    state: "eligible",
    blockingReasons: [],
    satisfiedHardRequirements: [],
    unsatisfiedHardRequirements: [],
    matchedPreferences: [],
    unmatchedPreferences: [],
    expiringSoonCertifications: [],
    unavailableResources: [],
    fallbacksUsed: [],
    evaluatedAt: NOW,
    ...overrides,
  };
}

function makeScores(overrides: Partial<CapabilityScores> = {}): CapabilityScores {
  return { requirementId: "req_1", workerId: "worker_1", eligibilityScore: 100, skillsMatchScore: 100, certificationScore: 100, experienceScore: 100, languageScore: 100, availabilityScore: 100, equipmentScore: 100, vehicleScore: 100, locationScore: 100, teamFitScore: 100, capacityScore: 100, preferenceScore: 100, overallCapabilityScore: 100, ...overrides };
}

describe("explainCapabilityEvaluation", () => {
  it("mentions the blocking reason count and first detail when ineligible", () => {
    const eligibility = makeEligibility({ state: "ineligible", blockingReasons: [{ rule: "required_skill:Rigging", detail: "Missing required skill \"Rigging\"." }] });
    const explanation = explainCapabilityEvaluation(eligibility, makeScores());
    expect(explanation.summary).toContain("Ineligible");
    expect(explanation.summary).toContain("Missing required skill");
    expect(explanation.blockingReasons).toHaveLength(1);
  });

  it("mentions fallbacks used when unknown", () => {
    const eligibility = makeEligibility({ state: "unknown", fallbacksUsed: ["distance:unknown (no location)"] });
    const explanation = explainCapabilityEvaluation(eligibility, makeScores());
    expect(explanation.summary).toContain("Unknown");
    expect(explanation.fallbackNotes).toEqual(["distance:unknown (no location)"]);
  });

  it("surfaces expiring certifications for conditionally_eligible workers", () => {
    const eligibility = makeEligibility({ state: "conditionally_eligible", expiringSoonCertifications: ["OSHA 30"] });
    const explanation = explainCapabilityEvaluation(eligibility, makeScores());
    expect(explanation.summary).toContain("Conditionally Eligible");
    expect(explanation.expiringCertificationNotes[0]).toContain("OSHA 30");
  });

  it("includes every named score in the breakdown, never collapsing to a single number", () => {
    const explanation = explainCapabilityEvaluation(makeEligibility(), makeScores());
    const labels = explanation.scoreBreakdown.map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(["Eligibility", "Skills Match", "Certification", "Experience", "Language", "Availability", "Equipment", "Vehicle", "Location", "Team Fit", "Capacity", "Preference", "Overall"]));
  });

  it("lists matched and unmatched preference details separately", () => {
    const eligibility = makeEligibility({ matchedPreferences: [{ rule: "a", detail: "Preferred skill matched.", matched: true }], unmatchedPreferences: [{ rule: "b", detail: "Preferred language not matched.", matched: false }] });
    const explanation = explainCapabilityEvaluation(eligibility, makeScores());
    expect(explanation.matchedPreferenceNotes).toEqual(["Preferred skill matched."]);
    expect(explanation.unmatchedPreferenceNotes).toEqual(["Preferred language not matched."]);
  });
});
