import { describe, expect, it } from "vitest";
import { buildAllocationProposal, type CandidatePoolEntry, type AllocationEngineInput } from "@/core/allocation/allocationEngine";
import type { AllocationRequirementLine } from "@/types/allocation";

function makeEntry(overrides: Partial<CandidatePoolEntry> = {}): CandidatePoolEntry {
  return { resource_type: "worker", resource_id: "worker_1", eligible: true, ineligibleReason: null, score: 80, currentWorkload: 0, isPreferred: false, ...overrides };
}

function makeLine(overrides: Partial<AllocationRequirementLine> = {}): AllocationRequirementLine {
  return { resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null, ...overrides };
}

describe("buildAllocationProposal — selection basics", () => {
  it("selects exactly the top N candidates by score for highest_capability", () => {
    const pool = [makeEntry({ resource_id: "worker_low", score: 40 }), makeEntry({ resource_id: "worker_high", score: 90 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    const selected = result.candidates.filter((c) => c.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].resource_id).toBe("worker_high");
  });

  it("records a real rejection reason for an unselected but eligible candidate", () => {
    const pool = [makeEntry({ resource_id: "worker_a", score: 90 }), makeEntry({ resource_id: "worker_b", score: 80 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine({ quantity: 1 })], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    const rejected = result.candidates.find((c) => c.resource_id === "worker_b");
    expect(rejected?.selected).toBe(false);
    expect(rejected?.rejection_reason).toContain("Not selected");
  });

  it("records the ineligible reason for an ineligible candidate", () => {
    const pool = [makeEntry({ resource_id: "worker_ineligible", eligible: false, ineligibleReason: "Missing required certification." })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    expect(result.candidates[0].selected).toBe(false);
    expect(result.candidates[0].rejection_reason).toBe("Missing required certification.");
  });

  it("selects exactly quantity candidates for a multi-quantity line", () => {
    const pool = [makeEntry({ resource_id: "w1", score: 90 }), makeEntry({ resource_id: "w2", score: 80 }), makeEntry({ resource_id: "w3", score: 70 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine({ quantity: 2 })], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    expect(result.candidates.filter((c) => c.selected)).toHaveLength(2);
  });

  it("selects nothing and builds no fallback chain when the pool is empty", () => {
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [[]], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    expect(result.candidates).toEqual([]);
    expect(result.fallbackChains).toEqual([]);
  });
});

describe("buildAllocationProposal — strategies", () => {
  it("least_busy prefers lower workload over score", () => {
    const pool = [makeEntry({ resource_id: "busy_but_strong", score: 95, currentWorkload: 5 }), makeEntry({ resource_id: "idle_but_weaker", score: 60, currentWorkload: 0 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "least_busy" };
    const result = buildAllocationProposal(input);
    expect(result.candidates.find((c) => c.selected)?.resource_id).toBe("idle_but_weaker");
  });

  it("balanced_workload can still prefer a busier but much stronger candidate", () => {
    const pool = [makeEntry({ resource_id: "busy_but_strong", score: 95, currentWorkload: 1 }), makeEntry({ resource_id: "idle_but_weaker", score: 60, currentWorkload: 0 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "balanced_workload" };
    const result = buildAllocationProposal(input);
    // blended: strong = 95 - 5 = 90; weaker = 60 - 0 = 60 -> strong wins
    expect(result.candidates.find((c) => c.selected)?.resource_id).toBe("busy_but_strong");
  });

  it("preferred_worker always ranks a preferred resource first regardless of score", () => {
    const pool = [makeEntry({ resource_id: "preferred_but_weaker", score: 50 }), makeEntry({ resource_id: "stronger", score: 90 })];
    const line = makeLine({ preferred_resource_ids: ["preferred_but_weaker"] });
    const input: AllocationEngineInput = { requirementLines: [line], candidatePoolsByLineIndex: [pool], strategy: "preferred_worker" };
    const result = buildAllocationProposal(input);
    expect(result.candidates.find((c) => c.selected)?.resource_id).toBe("preferred_but_weaker");
  });

  it("custom strategy ranks isPreferred candidates first", () => {
    const pool = [makeEntry({ resource_id: "flagged", score: 50, isPreferred: true }), makeEntry({ resource_id: "unflagged", score: 90, isPreferred: false })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "custom" };
    const result = buildAllocationProposal(input);
    expect(result.candidates.find((c) => c.selected)?.resource_id).toBe("flagged");
  });

  it("lowest_cost falls back to score as a deterministic secondary key", () => {
    const pool = [makeEntry({ resource_id: "worker_low", score: 40 }), makeEntry({ resource_id: "worker_high", score: 90 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "lowest_cost" };
    const result = buildAllocationProposal(input);
    expect(result.candidates.find((c) => c.selected)?.resource_id).toBe("worker_high");
  });

  it("ties break deterministically on resource_id", () => {
    const pool = [makeEntry({ resource_id: "worker_b", score: 80 }), makeEntry({ resource_id: "worker_a", score: 80 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine()], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    expect(result.candidates.find((c) => c.selected)?.resource_id).toBe("worker_a");
  });
});

describe("buildAllocationProposal — fallback chains", () => {
  it("builds a fallback chain for a quantity:1 line with the primary as rank 1", () => {
    const pool = [makeEntry({ resource_id: "primary", score: 90 }), makeEntry({ resource_id: "backup", score: 70 })];
    const input: AllocationEngineInput = { requirementLines: [makeLine({ quantity: 1 })], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    expect(result.fallbackChains).toHaveLength(1);
    expect(result.fallbackChains[0].primary?.resource_id).toBe("primary");
    expect(result.fallbackChains[0].backups[0].resource_id).toBe("backup");
  });

  it("does not build a fallback chain for a multi-quantity line", () => {
    const pool = [makeEntry({ resource_id: "w1" }), makeEntry({ resource_id: "w2" })];
    const input: AllocationEngineInput = { requirementLines: [makeLine({ quantity: 2 })], candidatePoolsByLineIndex: [pool], strategy: "highest_capability" };
    const result = buildAllocationProposal(input);
    expect(result.fallbackChains).toEqual([]);
  });
});
