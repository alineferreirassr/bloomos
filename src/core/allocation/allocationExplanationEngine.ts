import type { AllocationCandidate, AllocationScores, AllocationValidationResult, FallbackChain, AllocationExplanation } from "@/types/allocation";
import type { BundleCompletenessResult } from "@/core/allocation/bundleEngine";

/**
 * v2.0 Checkpoint 27.1, Step 13 — Allocation Explanation Engine. Turns
 * an allocation's already-computed candidates/scores/validation into
 * readable prose — same discipline `capabilityExplanationEngine.ts`
 * established: never expose only a bare score, always the reasoning
 * behind it. `fallbackChains` is accepted for API symmetry with the
 * rest of this checkpoint's engines but the actual "was a fallback
 * used" signal comes from each candidate's own `is_fallback`/
 * `fallback_tier` — set once, at selection time, by `AllocationEngine`.
 */

function describeCandidate(candidate: AllocationCandidate): string {
  if (candidate.selected) {
    const fallbackNote = candidate.is_fallback ? ` (tier ${candidate.fallback_tier} fallback)` : "";
    return `${candidate.resource_type} "${candidate.resource_id}" selected for requirement line ${candidate.requirement_line_index + 1}${fallbackNote}.`;
  }
  return `${candidate.resource_type} "${candidate.resource_id}" rejected for requirement line ${candidate.requirement_line_index + 1}: ${candidate.rejection_reason ?? "no reason recorded"}.`;
}

export function explainAllocation(candidates: AllocationCandidate[], scores: AllocationScores, validation: AllocationValidationResult, fallbackChains: FallbackChain[], bundleCompleteness: BundleCompletenessResult | null): AllocationExplanation {
  const selectedReasons = candidates.filter((c) => c.selected).map(describeCandidate);
  const rejectedReasons = candidates.filter((c) => !c.selected).map(describeCandidate);
  const missingResources = validation.errors.filter((e) => e.rule === "insufficient_quantity").map((e) => e.detail);
  const constraintFailures = validation.errors.filter((e) => e.rule !== "insufficient_quantity").map((e) => e.detail);
  const fallbacksUsed = candidates.filter((c) => c.selected && c.is_fallback).map((c) => `${c.resource_type} "${c.resource_id}" used as a tier ${c.fallback_tier} backup for requirement line ${c.requirement_line_index + 1}.`);

  const bundleCompletion = bundleCompleteness === null ? "This allocation is not based on a resource bundle." : bundleCompleteness.isComplete ? "Bundle fully satisfied — every required line filled." : `Bundle incomplete — ${bundleCompleteness.missingRequiredLines.length} required line(s) still missing.`;

  const selectedCount = candidates.filter((c) => c.selected).length;
  const statusNote = validation.valid ? "" : ` (${validation.errors.length} validation issue${validation.errors.length === 1 ? "" : "s"} present)`;
  const summary = `${selectedCount} resource${selectedCount === 1 ? "" : "s"} selected — overall allocation score ${scores.overallAllocationScore}/100${statusNote}.`;

  return { summary, selectedReasons, rejectedReasons, missingResources, constraintFailures, fallbacksUsed, bundleCompletion };
}
