import { describe, expect, it } from "vitest";
import { detectAllocationRisks, type DetectAllocationRisksInput } from "@/core/allocation/allocationRiskEngine";
import { resourceKey } from "@/core/allocation/resourcePoolEngine";
import type { Allocation, AllocationCandidate, AllocationValidationResult, DependencyRule } from "@/types/allocation";

const NOW = "2026-01-01T00:00:00.000Z";

function makeCandidate(overrides: Partial<AllocationCandidate> = {}): AllocationCandidate {
  return { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null, ...overrides };
}

function makeAllocation(overrides: Partial<Allocation> = {}): Allocation {
  return { id: "allocation_1", workspace_id: "ws_1", request_id: "request_1", group_id: "group_1", strategy: "highest_capability", status: "draft", candidates: [makeCandidate()], created_by: "member_1", created_at: NOW, updated_at: NOW, approved_at: null, approved_by: null, archived_at: null, ...overrides };
}

const validResult: AllocationValidationResult = { valid: true, errors: [], warnings: [] };

function baseInput(overrides: Partial<DetectAllocationRisksInput> = {}): DetectAllocationRisksInput {
  return {
    allocations: [makeAllocation()],
    validationResultsByAllocationId: new Map([["allocation_1", validResult]]),
    dependencyResultsByAllocationId: new Map(),
    bundleCompletenessByAllocationId: new Map(),
    sharedResourceConflictCountByAllocationId: new Map(),
    criticalResourceKeys: new Set(),
    ...overrides,
  };
}

describe("detectAllocationRisks — insufficient_resources / no_allocation_possible", () => {
  it("flags insufficient_resources when validation has an insufficient_quantity error", () => {
    const validation: AllocationValidationResult = { valid: false, errors: [{ rule: "insufficient_quantity", detail: "Line 1 short." }], warnings: [] };
    const findings = detectAllocationRisks(baseInput({ validationResultsByAllocationId: new Map([["allocation_1", validation]]) }));
    expect(findings.some((f) => f.type === "insufficient_resources")).toBe(true);
  });

  it("flags no_allocation_possible when nothing was selected", () => {
    const allocation = makeAllocation({ candidates: [makeCandidate({ selected: false, rejection_reason: "Unavailable" })] });
    const findings = detectAllocationRisks(baseInput({ allocations: [allocation] }));
    expect(findings.some((f) => f.type === "no_allocation_possible")).toBe(true);
  });

  it("flags neither for a fully healthy allocation", () => {
    const findings = detectAllocationRisks(baseInput());
    expect(findings.some((f) => f.type === "insufficient_resources" || f.type === "no_allocation_possible")).toBe(false);
  });
});

describe("detectAllocationRisks — critical_dependency", () => {
  it("flags an unsatisfied dependency", () => {
    const rule: DependencyRule = { id: "rule_1", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: "Drone", requires_resource_type: "worker", requires_skill: null, requires_certification: "Drone Operator", description: "A drone requires a certified operator." };
    const findings = detectAllocationRisks(baseInput({ dependencyResultsByAllocationId: new Map([["allocation_1", [{ rule, satisfied: false, satisfiedByResourceId: null }]]]) }));
    expect(findings.some((f) => f.type === "critical_dependency")).toBe(true);
  });
});

describe("detectAllocationRisks — bundle_incomplete", () => {
  it("flags an incomplete bundle", () => {
    const findings = detectAllocationRisks(baseInput({ bundleCompletenessByAllocationId: new Map([["allocation_1", { requiredLineIndices: [0], optionalLineIndices: [], fulfilledRequiredCount: 0, fulfilledOptionalCount: 0, isComplete: false, missingRequiredLines: [0] }]]) }));
    expect(findings.some((f) => f.type === "bundle_incomplete")).toBe(true);
  });
});

describe("detectAllocationRisks — resource_bottleneck", () => {
  it("flags a critical resource used across more than one active allocation", () => {
    const allocations = [makeAllocation({ id: "allocation_1", candidates: [makeCandidate({ resource_id: "worker_1" })] }), makeAllocation({ id: "allocation_2", candidates: [makeCandidate({ resource_id: "worker_1" })] })];
    const findings = detectAllocationRisks(baseInput({ allocations, criticalResourceKeys: new Set([resourceKey("worker", "worker_1")]) }));
    expect(findings.some((f) => f.type === "resource_bottleneck")).toBe(true);
  });

  it("does not flag a critical resource used in only one allocation", () => {
    const findings = detectAllocationRisks(baseInput({ criticalResourceKeys: new Set([resourceKey("worker", "worker_1")]) }));
    expect(findings.some((f) => f.type === "resource_bottleneck")).toBe(false);
  });
});

describe("detectAllocationRisks — shared_resource_conflict", () => {
  it("flags a nonzero shared-resource conflict count", () => {
    const findings = detectAllocationRisks(baseInput({ sharedResourceConflictCountByAllocationId: new Map([["allocation_1", 2]]) }));
    expect(findings.some((f) => f.type === "shared_resource_conflict")).toBe(true);
  });
});

describe("detectAllocationRisks — fallback_activated", () => {
  it("flags an allocation with a selected fallback candidate", () => {
    const allocation = makeAllocation({ candidates: [makeCandidate({ is_fallback: true, fallback_tier: 1 })] });
    const findings = detectAllocationRisks(baseInput({ allocations: [allocation] }));
    expect(findings.some((f) => f.type === "fallback_activated")).toBe(true);
  });
});

describe("detectAllocationRisks — resource_shortage", () => {
  it("flags a workspace-wide shortage when 2+ distinct requests are short on the same resource type", () => {
    const validation: AllocationValidationResult = { valid: false, errors: [{ rule: "insufficient_quantity", detail: "short" }], warnings: [] };
    const allocations = [makeAllocation({ id: "allocation_1", request_id: "request_1", candidates: [makeCandidate({ selected: false })] }), makeAllocation({ id: "allocation_2", request_id: "request_2", candidates: [makeCandidate({ selected: false })] })];
    const findings = detectAllocationRisks(
      baseInput({
        allocations,
        validationResultsByAllocationId: new Map([
          ["allocation_1", validation],
          ["allocation_2", validation],
        ]),
      }),
    );
    expect(findings.some((f) => f.type === "resource_shortage")).toBe(true);
  });

  it("does not flag a shortage from a single isolated request", () => {
    const validation: AllocationValidationResult = { valid: false, errors: [{ rule: "insufficient_quantity", detail: "short" }], warnings: [] };
    const allocation = makeAllocation({ candidates: [makeCandidate({ selected: false })] });
    const findings = detectAllocationRisks(baseInput({ allocations: [allocation], validationResultsByAllocationId: new Map([["allocation_1", validation]]) }));
    expect(findings.some((f) => f.type === "resource_shortage")).toBe(false);
  });
});
