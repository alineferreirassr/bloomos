import { describe, expect, it } from "vitest";
import { compareAllocations, type ComparisonProposalInput } from "@/core/allocation/allocationComparisonEngine";
import type { AllocationScores } from "@/types/allocation";

function makeScores(overrides: Partial<AllocationScores> = {}): AllocationScores {
  return { capabilityFitScore: 100, scheduleFitScore: 100, availabilityFitScore: 100, bundleCompletenessScore: 100, dependencyHealthScore: 100, capacityHealthScore: 100, preferenceMatchScore: 100, overallAllocationScore: 100, ...overrides };
}

describe("compareAllocations", () => {
  it("flags a high score as a strength and a low score as a weakness", () => {
    const proposal: ComparisonProposalInput = { allocationId: "allocation_1", strategy: "highest_capability", scores: makeScores({ capabilityFitScore: 95, preferenceMatchScore: 40 }) };
    const result = compareAllocations([proposal]);
    expect(result.entries[0].strengths.some((s) => s.startsWith("Capability Fit"))).toBe(true);
    expect(result.entries[0].weaknesses.some((w) => w.startsWith("Preference Match"))).toBe(true);
  });

  it("produces no differences for a single proposal", () => {
    const proposal: ComparisonProposalInput = { allocationId: "allocation_1", strategy: "highest_capability", scores: makeScores() };
    const result = compareAllocations([proposal]);
    expect(result.differences).toEqual([]);
  });

  it("identifies the highest-scoring proposal when comparing multiple", () => {
    const proposals: ComparisonProposalInput[] = [
      { allocationId: "allocation_a", strategy: "highest_capability", scores: makeScores({ overallAllocationScore: 70 }) },
      { allocationId: "allocation_b", strategy: "least_busy", scores: makeScores({ overallAllocationScore: 90 }) },
    ];
    const result = compareAllocations(proposals);
    expect(result.differences[0]).toContain("allocation_b");
    expect(result.differences[0]).toContain("90");
  });

  it("calls out a metric with a notable spread across proposals", () => {
    const proposals: ComparisonProposalInput[] = [
      { allocationId: "allocation_a", strategy: "highest_capability", scores: makeScores({ capabilityFitScore: 95 }) },
      { allocationId: "allocation_b", strategy: "least_busy", scores: makeScores({ capabilityFitScore: 50 }) },
    ];
    const result = compareAllocations(proposals);
    expect(result.differences.some((d) => d.startsWith("Capability Fit"))).toBe(true);
  });

  it("does not call out a metric with a small spread", () => {
    const proposals: ComparisonProposalInput[] = [
      { allocationId: "allocation_a", strategy: "highest_capability", scores: makeScores({ capabilityFitScore: 90 }) },
      { allocationId: "allocation_b", strategy: "least_busy", scores: makeScores({ capabilityFitScore: 85 }) },
    ];
    const result = compareAllocations(proposals);
    expect(result.differences.some((d) => d.startsWith("Capability Fit"))).toBe(false);
  });
});
