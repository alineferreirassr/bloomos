import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockAllocationRequestsRepository, resetAllocationRequestsStore, type CreateAllocationRequestInput } from "@/lib/data/mock/allocationRequestsStore";

const baseInput: CreateAllocationRequestInput = {
  context_type: "event",
  context: { nodeType: "event", nodeId: "event_1" },
  required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }],
  required_starts_at: "2026-08-03T10:00:00.000Z",
  required_ends_at: "2026-08-03T11:00:00.000Z",
  calendar_id: null,
  priority: "medium",
  deadline: null,
  location_placeholder: null,
  special_instructions: null,
  bundle_id: null,
  source: "manual",
};

beforeEach(() => resetAllocationRequestsStore());
afterEach(() => resetAllocationRequestsStore());

describe("mockAllocationRequestsRepository", () => {
  it("creates a request", async () => {
    const result = await mockAllocationRequestsRepository.createRequest("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects a request with no resource requirements", async () => {
    const result = await mockAllocationRequestsRepository.createRequest("ws_1", "member_1", { ...baseInput, required_resources: [] });
    expect(result.success).toBe(false);
  });

  it("rejects ends_at not after starts_at", async () => {
    const result = await mockAllocationRequestsRepository.createRequest("ws_1", "member_1", { ...baseInput, required_ends_at: baseInput.required_starts_at });
    expect(result.success).toBe(false);
  });

  it("listRequestsForWorkspace scopes to the workspace", async () => {
    await mockAllocationRequestsRepository.createRequest("ws_1", "member_1", baseInput);
    await mockAllocationRequestsRepository.createRequest("ws_2", "member_1", baseInput);
    expect(await mockAllocationRequestsRepository.listRequestsForWorkspace("ws_1")).toHaveLength(1);
  });

  it("getRequestById returns null for an unknown id", async () => {
    expect(await mockAllocationRequestsRepository.getRequestById("missing")).toBeNull();
  });
});
