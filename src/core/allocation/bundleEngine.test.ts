import { describe, expect, it } from "vitest";
import { buildRequirementLinesFromBundle, evaluateBundleCompleteness, computeBundleCompletenessScore } from "@/core/allocation/bundleEngine";
import type { ResourceBundle, AllocationCandidate, BundleResourceLine } from "@/types/allocation";

function makeLine(overrides: Partial<BundleResourceLine> = {}): BundleResourceLine {
  return { resource_type: "worker", quantity: 1, capability_requirement_id: null, notes: null, ...overrides };
}

function makeBundle(overrides: Partial<Pick<ResourceBundle, "required_resources" | "optional_resources">> = {}): Pick<ResourceBundle, "required_resources" | "optional_resources"> {
  return { required_resources: [makeLine({ quantity: 2 })], optional_resources: [makeLine({ resource_type: "equipment" })], ...overrides };
}

function makeCandidate(overrides: Partial<AllocationCandidate> = {}): AllocationCandidate {
  return { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null, ...overrides };
}

describe("buildRequirementLinesFromBundle", () => {
  it("places required lines before optional lines", () => {
    const bundle = makeBundle();
    const lines = buildRequirementLinesFromBundle(bundle);
    expect(lines).toHaveLength(2);
    expect(lines[0].resource_type).toBe("worker");
    expect(lines[0].quantity).toBe(2);
    expect(lines[1].resource_type).toBe("equipment");
  });
});

describe("evaluateBundleCompleteness", () => {
  it("is complete when every required line meets its quantity", () => {
    const bundle = makeBundle();
    const candidates = [makeCandidate({ resource_id: "worker_1" }), makeCandidate({ resource_id: "worker_2" })];
    const result = evaluateBundleCompleteness(bundle, candidates);
    expect(result.isComplete).toBe(true);
    expect(result.fulfilledRequiredCount).toBe(1);
    expect(result.missingRequiredLines).toEqual([]);
  });

  it("is incomplete when a required line falls short of its quantity", () => {
    const bundle = makeBundle();
    const candidates = [makeCandidate({ resource_id: "worker_1" })];
    const result = evaluateBundleCompleteness(bundle, candidates);
    expect(result.isComplete).toBe(false);
    expect(result.missingRequiredLines).toEqual([0]);
  });

  it("does not count an unselected (rejected) candidate toward fulfillment", () => {
    const bundle = makeBundle({ required_resources: [makeLine({ quantity: 1 })], optional_resources: [] });
    const candidates = [makeCandidate({ selected: false, rejection_reason: "Not available" })];
    const result = evaluateBundleCompleteness(bundle, candidates);
    expect(result.isComplete).toBe(false);
  });

  it("tracks optional line fulfillment separately from completeness", () => {
    const bundle = makeBundle({ required_resources: [makeLine({ quantity: 1 })], optional_resources: [makeLine({ resource_type: "equipment", quantity: 1 })] });
    const candidates = [makeCandidate({ requirement_line_index: 0 })];
    const result = evaluateBundleCompleteness(bundle, candidates);
    expect(result.isComplete).toBe(true);
    expect(result.fulfilledOptionalCount).toBe(0);
  });

  it("is vacuously complete with no required lines", () => {
    const bundle = makeBundle({ required_resources: [], optional_resources: [] });
    const result = evaluateBundleCompleteness(bundle, []);
    expect(result.isComplete).toBe(true);
  });
});

describe("computeBundleCompletenessScore", () => {
  it("is a vacuous 100 with no required lines", () => {
    const result = evaluateBundleCompleteness({ required_resources: [], optional_resources: [] }, []);
    expect(computeBundleCompletenessScore(result)).toBe(100);
  });

  it("scales with the fraction of required lines fulfilled", () => {
    const bundle = { required_resources: [makeLine(), makeLine()], optional_resources: [] };
    const candidates = [makeCandidate({ requirement_line_index: 0 })];
    const result = evaluateBundleCompleteness(bundle, candidates);
    expect(computeBundleCompletenessScore(result)).toBe(50);
  });
});
