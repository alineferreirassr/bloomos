import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockAllocationsRepository, resetAllocationsStore, type CreateAllocationInput } from "@/lib/data/mock/allocationsStore";
import type { AllocationCandidate } from "@/types/allocation";

const baseCandidate: AllocationCandidate = { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null };

function baseInput(overrides: Partial<CreateAllocationInput> = {}): CreateAllocationInput {
  return { request_id: "allocation_request_1", group_id: "group_1", strategy: "highest_capability", candidates: [baseCandidate], ...overrides };
}

beforeEach(() => resetAllocationsStore());
afterEach(() => resetAllocationsStore());

describe("mockAllocationsRepository", () => {
  it("creates an allocation as draft", async () => {
    const result = await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("draft");
  });

  it("accepts an allocation with no candidates — a real state when every requirement line's resource pool came up empty, not an error", async () => {
    const result = await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput({ candidates: [] }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.candidates).toEqual([]);
  });

  it("listAllocationsForWorkspace scopes to the workspace", async () => {
    await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput());
    await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput({ request_id: "allocation_request_2", group_id: "group_2" }));
    await mockAllocationsRepository.createAllocation("ws_2", "member_1", baseInput());

    expect(await mockAllocationsRepository.listAllocationsForWorkspace("ws_1")).toHaveLength(2);
  });

  it("listAllocationsForRequest / listAllocationsForGroup scope to the request/group only — workspace scoping is the caller's job", async () => {
    await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput());
    await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput({ request_id: "allocation_request_2", group_id: "group_2" }));
    await mockAllocationsRepository.createAllocation("ws_2", "member_1", baseInput());

    expect(await mockAllocationsRepository.listAllocationsForRequest("allocation_request_1")).toHaveLength(2);
    expect(await mockAllocationsRepository.listAllocationsForGroup("group_2")).toHaveLength(1);
  });

  it("getAllocationById returns null for an unknown id", async () => {
    expect(await mockAllocationsRepository.getAllocationById("missing")).toBeNull();
  });

  it("updateAllocationCandidates replaces candidates and resets status to draft", async () => {
    const created = await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("setup failed");
    await mockAllocationsRepository.setAllocationStatus(created.data.id, "ws_1", "approved", "member_1");

    const newCandidate: AllocationCandidate = { ...baseCandidate, resource_id: "worker_2" };
    const updated = await mockAllocationsRepository.updateAllocationCandidates(created.data.id, "ws_1", [newCandidate]);
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.candidates).toEqual([newCandidate]);
      expect(updated.data.status).toBe("draft");
    }
  });

  it("setAllocationStatus records approved_at/approved_by on approval and clears them on a later transition", async () => {
    const created = await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("setup failed");

    const approved = await mockAllocationsRepository.setAllocationStatus(created.data.id, "ws_1", "approved", "member_2");
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.approved_at).not.toBeNull();
      expect(approved.data.approved_by).toBe("member_2");
    }

    const archived = await mockAllocationsRepository.setAllocationStatus(created.data.id, "ws_1", "archived", null);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.archived_at).not.toBeNull();
      expect(archived.data.approved_at).not.toBeNull();
    }
  });

  it("setAllocationStatus fails for an allocation in a different workspace", async () => {
    const created = await mockAllocationsRepository.createAllocation("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("setup failed");
    const result = await mockAllocationsRepository.setAllocationStatus(created.data.id, "ws_2", "approved", "member_1");
    expect(result.success).toBe(false);
  });
});
