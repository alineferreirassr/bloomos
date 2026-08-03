import type { CapabilityEligibility, CapabilityScores } from "@/types/capability";

/**
 * v2.0 Checkpoint 26.1, Step 7 — Capability Explanation Engine. Turns the
 * already-structured `CapabilityEligibility`/`CapabilityScores` into a
 * human-readable narrative — it detects nothing new, it only translates,
 * the same "explain, don't re-derive" discipline
 * `operationalRecommendationEngine.ts` established. Every one of the
 * spec's own named explanation questions gets a real, populated field —
 * this is deliberately never collapsed into a bare score.
 */
export interface CapabilityExplanation {
  summary: string;
  satisfiedReasons: string[];
  blockingReasons: string[];
  matchedPreferenceNotes: string[];
  unmatchedPreferenceNotes: string[];
  expiringCertificationNotes: string[];
  unavailableResourceNotes: string[];
  fallbackNotes: string[];
  scoreBreakdown: { label: string; value: number }[];
}

const STATE_LABEL: Record<CapabilityEligibility["state"], string> = {
  eligible: "Eligible",
  conditionally_eligible: "Conditionally Eligible",
  ineligible: "Ineligible",
  unknown: "Unknown",
};

function summarize(eligibility: CapabilityEligibility, scores: CapabilityScores): string {
  const stateLabel = STATE_LABEL[eligibility.state];
  if (eligibility.state === "ineligible") {
    const reasonCount = eligibility.blockingReasons.length;
    return `${stateLabel} — blocked by ${reasonCount} requirement${reasonCount === 1 ? "" : "s"}: ${eligibility.blockingReasons[0]?.detail ?? ""}`;
  }
  if (eligibility.state === "unknown") {
    return `${stateLabel} — eligibility could not be fully determined (${eligibility.fallbacksUsed.join(", ")}).`;
  }
  if (eligibility.state === "conditionally_eligible") {
    return `${stateLabel} — meets every hard requirement, with ${eligibility.expiringSoonCertifications.length} certification(s) expiring soon. Overall capability score ${scores.overallCapabilityScore}.`;
  }
  return `${stateLabel} — meets every hard requirement. Overall capability score ${scores.overallCapabilityScore}.`;
}

export function explainCapabilityEvaluation(eligibility: CapabilityEligibility, scores: CapabilityScores): CapabilityExplanation {
  return {
    summary: summarize(eligibility, scores),
    satisfiedReasons: eligibility.satisfiedHardRequirements,
    blockingReasons: eligibility.blockingReasons.map((r) => `${r.rule}: ${r.detail}`),
    matchedPreferenceNotes: eligibility.matchedPreferences.map((p) => p.detail),
    unmatchedPreferenceNotes: eligibility.unmatchedPreferences.map((p) => p.detail),
    expiringCertificationNotes: eligibility.expiringSoonCertifications.map((name) => `"${name}" is expiring soon.`),
    unavailableResourceNotes: eligibility.unavailableResources.map((r) => `Resource unavailable: ${r}.`),
    fallbackNotes: eligibility.fallbacksUsed,
    scoreBreakdown: [
      { label: "Eligibility", value: scores.eligibilityScore },
      { label: "Skills Match", value: scores.skillsMatchScore },
      { label: "Certification", value: scores.certificationScore },
      { label: "Experience", value: scores.experienceScore },
      { label: "Language", value: scores.languageScore },
      { label: "Availability", value: scores.availabilityScore },
      { label: "Equipment", value: scores.equipmentScore },
      { label: "Vehicle", value: scores.vehicleScore },
      { label: "Location", value: scores.locationScore },
      { label: "Team Fit", value: scores.teamFitScore },
      { label: "Capacity", value: scores.capacityScore },
      { label: "Preference", value: scores.preferenceScore },
      { label: "Overall", value: scores.overallCapabilityScore },
    ],
  };
}
