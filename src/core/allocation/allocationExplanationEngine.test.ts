import { describe, expect, it } from "vitest";
import { explainAllocation } from "@/core/allocation/allocationExplanationEngine";
import type { AllocationCandidate, AllocationScores, AllocationValidationResult } from "@/types/allocation";

const perfectScores: AllocationScores = { capabilityFitScore: 100, scheduleFitScore: 100, availabilityFitScore: 100, bundleCompletenessScore: 100, dependencyHealthScore: 100, capacityHealthScore: 100, preferenceMatchScore: 100, overallAllocationScore: 100 };
const validResult: AllocationValidationResult = { valid: true, errors: [], warnings: [] };

function makeCandidate(overrides: Partial<AllocationCandidate> = {}): AllocationCandidate {
  return { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null, ...overrides };
}

describe("explainAllocation", () => {
  it("summary always includes prose context alongside the score, never a bare number", () => {
    const explanation = explainAllocation([makeCandidate()], perfectScores, validResult, [], null);
    expect(explanation.summary).toContain("100/100");
    expect(explanation.summary).toContain("resource");
  });

  it("separates selected and rejected reasons, each with real detail", () => {
    const candidates = [makeCandidate({ resource_id: "worker_selected" }), makeCandidate({ resource_id: "worker_rejected", selected: false, rejection_reason: "Missing certification." })];
    const explanation = explainAllocation(candidates, perfectScores, validResult, [], null);
    expect(explanation.selectedReasons).toHaveLength(1);
    expect(explanation.selectedReasons[0]).toContain("worker_selected");
    expect(explanation.rejectedReasons).toHaveLength(1);
    expect(explanation.rejectedReasons[0]).toContain("Missing certification.");
  });

  it("surfaces missing resources and constraint failures from validation errors", () => {
    const validation: AllocationValidationResult = { valid: false, errors: [{ rule: "insufficient_quantity", detail: "Line 1 needs 2 but only 1 found." }, { rule: "dependency_unsatisfied", detail: "Drone requires an operator." }], warnings: [] };
    const explanation = explainAllocation([makeCandidate()], perfectScores, validation, [], null);
    expect(explanation.missingResources).toEqual(["Line 1 needs 2 but only 1 found."]);
    expect(explanation.constraintFailures).toEqual(["Drone requires an operator."]);
  });

  it("reports a selected fallback candidate under fallbacksUsed", () => {
    const candidates = [makeCandidate({ is_fallback: true, fallback_tier: 1 })];
    const explanation = explainAllocation(candidates, perfectScores, validResult, [], null);
    expect(explanation.fallbacksUsed).toHaveLength(1);
    expect(explanation.fallbacksUsed[0]).toContain("tier 1");
  });

  it("does not report an unselected fallback candidate as used", () => {
    const candidates = [makeCandidate({ selected: false, rejection_reason: "Unavailable", is_fallback: true, fallback_tier: 2 })];
    const explanation = explainAllocation(candidates, perfectScores, validResult, [], null);
    expect(explanation.fallbacksUsed).toEqual([]);
  });

  it("describes bundle completion state honestly for a non-bundle allocation", () => {
    const explanation = explainAllocation([makeCandidate()], perfectScores, validResult, [], null);
    expect(explanation.bundleCompletion).toContain("not based on a resource bundle");
  });

  it("describes an incomplete bundle", () => {
    const explanation = explainAllocation([makeCandidate()], perfectScores, validResult, [], { requiredLineIndices: [0, 1], optionalLineIndices: [], fulfilledRequiredCount: 1, fulfilledOptionalCount: 0, isComplete: false, missingRequiredLines: [1] });
    expect(explanation.bundleCompletion).toContain("1 required line(s) still missing");
  });
});
