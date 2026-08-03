import type { AllocationScores, DependencyCheckResult } from "@/types/allocation";
import { computeBundleCompletenessScore, type BundleCompletenessResult } from "@/core/allocation/bundleEngine";
import type { CapacityCheckSummary } from "@/core/allocation/allocationValidationEngine";

/**
 * v2.0 Checkpoint 27.1, Step 12 — Allocation Score Engine. Eight
 * disclosed, deterministic formulas over already-computed data — same
 * "not applicable resolves to a vacuous pass, never a fabricated 0"
 * discipline `capabilityScoreEngine.ts`/`schedulingScoreEngine.ts`
 * established, with one deliberate exception: `capabilityFitScore` is
 * `0`, not a vacuous 100, when requirements existed but nothing could
 * be selected — that specific score's whole purpose is catching "we
 * found zero qualified candidates," so treating an empty result as a
 * pass would hide the one finding this score exists to surface.
 */

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function ratioScore(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return clampScore(Math.round(100 * (numerator / denominator)));
}

/** Average quality of the candidates actually selected — `0` (not vacuous) when requirements existed but none could be filled. */
export function computeCapabilityFitScore(selectedCandidateScores: number[], totalRequiredCandidates: number): number {
  if (totalRequiredCandidates === 0) return 100;
  if (selectedCandidateScores.length === 0) return 0;
  return clampScore(Math.round(selectedCandidateScores.reduce((sum, score) => sum + score, 0) / selectedCandidateScores.length));
}

export function computeScheduleFitScore(scheduleFitCount: number, totalSelectedCandidates: number): number {
  return ratioScore(scheduleFitCount, totalSelectedCandidates);
}

export function computeAvailabilityFitScore(availabilityFitCount: number, totalSelectedCandidates: number): number {
  return ratioScore(availabilityFitCount, totalSelectedCandidates);
}

export function computeDependencyHealthScore(dependencyResults: DependencyCheckResult[]): number {
  return ratioScore(dependencyResults.filter((r) => r.satisfied).length, dependencyResults.length);
}

export function computeCapacityHealthScore(capacityChecks: CapacityCheckSummary[]): number {
  return ratioScore(capacityChecks.filter((c) => c.withinCapacity).length, capacityChecks.length);
}

export function computePreferenceMatchScore(preferredMatchCount: number, totalSelectedCandidates: number): number {
  return ratioScore(preferredMatchCount, totalSelectedCandidates);
}

/** Unweighted average of the other seven — same "simple, disclosed composite" precedent `calendarHealthScore` established. */
export function computeOverallAllocationScore(scores: Omit<AllocationScores, "overallAllocationScore">): number {
  const values = Object.values(scores);
  return clampScore(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
}

export interface AllocationScoreInput {
  selectedCandidateScores: number[];
  totalRequiredCandidates: number;
  totalSelectedCandidates: number;
  scheduleFitCount: number;
  availabilityFitCount: number;
  bundleCompleteness: BundleCompletenessResult | null;
  dependencyResults: DependencyCheckResult[];
  capacityChecks: CapacityCheckSummary[];
  preferredMatchCount: number;
}

export function computeAllocationScores(input: AllocationScoreInput): AllocationScores {
  const capabilityFitScore = computeCapabilityFitScore(input.selectedCandidateScores, input.totalRequiredCandidates);
  const scheduleFitScore = computeScheduleFitScore(input.scheduleFitCount, input.totalSelectedCandidates);
  const availabilityFitScore = computeAvailabilityFitScore(input.availabilityFitCount, input.totalSelectedCandidates);
  const bundleCompletenessScore = input.bundleCompleteness === null ? 100 : computeBundleCompletenessScore(input.bundleCompleteness);
  const dependencyHealthScore = computeDependencyHealthScore(input.dependencyResults);
  const capacityHealthScore = computeCapacityHealthScore(input.capacityChecks);
  const preferenceMatchScore = computePreferenceMatchScore(input.preferredMatchCount, input.totalSelectedCandidates);
  const overallAllocationScore = computeOverallAllocationScore({ capabilityFitScore, scheduleFitScore, availabilityFitScore, bundleCompletenessScore, dependencyHealthScore, capacityHealthScore, preferenceMatchScore });
  return { capabilityFitScore, scheduleFitScore, availabilityFitScore, bundleCompletenessScore, dependencyHealthScore, capacityHealthScore, preferenceMatchScore, overallAllocationScore };
}
