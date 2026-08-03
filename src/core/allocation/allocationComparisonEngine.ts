import type { AllocationScores, AllocationStrategy, AllocationComparisonEntry, AllocationComparisonResult } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 14 — Allocation Comparison Engine. Compares
 * multiple already-scored proposals for the same request (Proposal A/B/C)
 * — pure, deterministic; every strength/weakness/difference is a
 * disclosed threshold over `AllocationScores`, never a judgment call.
 */

const STRENGTH_THRESHOLD = 90;
const WEAKNESS_THRESHOLD = 60;
/** A per-metric spread at or above this many points across proposals is called out as a genuine difference worth the reader's attention. */
const NOTABLE_SPREAD_THRESHOLD = 20;

const SCORE_LABELS: Record<keyof Omit<AllocationScores, "overallAllocationScore">, string> = {
  capabilityFitScore: "Capability Fit",
  scheduleFitScore: "Schedule Fit",
  availabilityFitScore: "Availability Fit",
  bundleCompletenessScore: "Bundle Completeness",
  dependencyHealthScore: "Dependency Health",
  capacityHealthScore: "Capacity Health",
  preferenceMatchScore: "Preference Match",
};

const COMPARABLE_SCORE_KEYS = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;

export interface ComparisonProposalInput {
  allocationId: string;
  strategy: AllocationStrategy;
  scores: AllocationScores;
}

function buildEntry(input: ComparisonProposalInput): AllocationComparisonEntry {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const key of COMPARABLE_SCORE_KEYS) {
    const value = input.scores[key];
    if (value >= STRENGTH_THRESHOLD) strengths.push(`${SCORE_LABELS[key]}: ${value}`);
    else if (value < WEAKNESS_THRESHOLD) weaknesses.push(`${SCORE_LABELS[key]}: ${value}`);
  }
  return { allocationId: input.allocationId, strategy: input.strategy, scores: input.scores, strengths, weaknesses };
}

export function compareAllocations(proposals: ComparisonProposalInput[]): AllocationComparisonResult {
  const entries = proposals.map(buildEntry);
  const differences: string[] = [];

  if (entries.length > 1) {
    const best = entries.reduce((a, b) => (a.scores.overallAllocationScore >= b.scores.overallAllocationScore ? a : b));
    differences.push(`"${best.allocationId}" (${best.strategy}) has the highest overall score at ${best.scores.overallAllocationScore}.`);

    for (const key of COMPARABLE_SCORE_KEYS) {
      const values = entries.map((e) => e.scores[key]);
      const spread = Math.max(...values) - Math.min(...values);
      if (spread >= NOTABLE_SPREAD_THRESHOLD) differences.push(`${SCORE_LABELS[key]} varies significantly across proposals (spread of ${spread} points).`);
    }
  }

  return { entries, differences };
}
