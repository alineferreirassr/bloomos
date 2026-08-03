import type { CapabilityEligibility, CapabilityScores, WorkerRankingEntry, EligibilityState } from "@/types/capability";

/**
 * v2.0 Checkpoint 26.1, Step 8 — Worker Ranking Engine. A single
 * deterministic, multi-key sort — never randomness, never a tie left
 * unresolved (Worker ID is always the final tie-breaker). Eligible and
 * Conditionally Eligible workers are ranked 1-based; Ineligible and
 * Unknown workers are never ranked above them (per the spec's own rule)
 * and keep `rank: null`.
 */

/** Eligible first, then Conditionally Eligible, then Unknown (couldn't be determined — never presented as confidently ready), then Ineligible last. */
const STATE_PRIORITY: Record<EligibilityState, number> = {
  eligible: 0,
  conditionally_eligible: 1,
  unknown: 2,
  ineligible: 3,
};

const RANKABLE_STATES = new Set<EligibilityState>(["eligible", "conditionally_eligible"]);

function compareEntries(a: { eligibility: CapabilityEligibility; scores: CapabilityScores }, b: { eligibility: CapabilityEligibility; scores: CapabilityScores }): number {
  const statePriorityDiff = STATE_PRIORITY[a.eligibility.state] - STATE_PRIORITY[b.eligibility.state];
  if (statePriorityDiff !== 0) return statePriorityDiff;

  const scoreDiff = b.scores.overallCapabilityScore - a.scores.overallCapabilityScore;
  if (scoreDiff !== 0) return scoreDiff;

  const blockingDiff = a.eligibility.blockingReasons.length - b.eligibility.blockingReasons.length;
  if (blockingDiff !== 0) return blockingDiff;

  const availabilityDiff = b.scores.availabilityScore - a.scores.availabilityScore;
  if (availabilityDiff !== 0) return availabilityDiff;

  const certificationDiff = b.scores.certificationScore - a.scores.certificationScore;
  if (certificationDiff !== 0) return certificationDiff;

  const skillsDiff = b.scores.skillsMatchScore - a.scores.skillsMatchScore;
  if (skillsDiff !== 0) return skillsDiff;

  const equipmentDiff = b.scores.equipmentScore - a.scores.equipmentScore;
  if (equipmentDiff !== 0) return equipmentDiff;

  const vehicleDiff = b.scores.vehicleScore - a.scores.vehicleScore;
  if (vehicleDiff !== 0) return vehicleDiff;

  const locationDiff = b.scores.locationScore - a.scores.locationScore;
  if (locationDiff !== 0) return locationDiff;

  return a.eligibility.workerId.localeCompare(b.eligibility.workerId);
}

export function rankWorkers(evaluations: { eligibility: CapabilityEligibility; scores: CapabilityScores }[]): WorkerRankingEntry[] {
  const sorted = [...evaluations].sort(compareEntries);

  let nextRank = 1;
  return sorted.map((entry) => {
    const rank = RANKABLE_STATES.has(entry.eligibility.state) ? nextRank++ : null;
    return { workerId: entry.eligibility.workerId, eligibility: entry.eligibility, scores: entry.scores, rank };
  });
}
