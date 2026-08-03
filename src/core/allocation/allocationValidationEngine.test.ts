import { describe, expect, it } from "vitest";
import { validateAllocation, type AllocationValidationInput } from "@/core/allocation/allocationValidationEngine";
import type { AllocationRequirementLine, AllocationCandidate, DependencyRule } from "@/types/allocation";

function makeLine(overrides: Partial<AllocationRequirementLine> = {}): AllocationRequirementLine {
  return { resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null, ...overrides };
}

function makeCandidate(overrides: Partial<AllocationCandidate> = {}): AllocationCandidate {
  return { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null, ...overrides };
}

function baseInput(overrides: Partial<AllocationValidationInput> = {}): AllocationValidationInput {
  return {
    requirementLines: [makeLine()],
    candidates: [makeCandidate()],
    dependencyResults: [],
    bundleCompleteness: null,
    capacityChecks: [],
    sharedResourceConflictCount: 0,
    ...overrides,
  };
}

describe("validateAllocation", () => {
  it("is valid when every line is fully filled with no other issues", () => {
    expect(validateAllocation(baseInput())).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("rejects a line with fewer selected candidates than its quantity", () => {
    const result = validateAllocation(baseInput({ requirementLines: [makeLine({ quantity: 2 })], candidates: [makeCandidate()] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "insufficient_quantity")).toBe(true);
  });

  it("rejects an unsatisfied dependency", () => {
    const rule: DependencyRule = { id: "rule_1", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: "Drone", requires_resource_type: "worker", requires_skill: null, requires_certification: "Drone Operator", description: "A drone requires a certified operator." };
    const result = validateAllocation(baseInput({ dependencyResults: [{ rule, satisfied: false, satisfiedByResourceId: null }] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "dependency_unsatisfied" && e.detail === rule.description)).toBe(true);
  });

  it("rejects an incomplete bundle", () => {
    const result = validateAllocation(baseInput({ bundleCompleteness: { requiredLineIndices: [0], optionalLineIndices: [], fulfilledRequiredCount: 0, fulfilledOptionalCount: 0, isComplete: false, missingRequiredLines: [0] } }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "bundle_incomplete")).toBe(true);
  });

  it("does not flag a complete bundle", () => {
    const result = validateAllocation(baseInput({ bundleCompleteness: { requiredLineIndices: [0], optionalLineIndices: [], fulfilledRequiredCount: 1, fulfilledOptionalCount: 0, isComplete: true, missingRequiredLines: [] } }));
    expect(result.valid).toBe(true);
  });

  it("rejects a breached capacity check", () => {
    const result = validateAllocation(baseInput({ capacityChecks: [{ scope: "team", withinCapacity: false }] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "capacity_exceeded")).toBe(true);
  });

  it("warns but does not block on shared resource conflicts", () => {
    const result = validateAllocation(baseInput({ sharedResourceConflictCount: 2 }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "shared_resource_conflict")).toBe(true);
  });
});
