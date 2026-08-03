import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockDispatchBatchesRepository, resetDispatchBatchesStore } from "@/lib/data/mock/dispatchBatchesStore";

beforeEach(() => resetDispatchBatchesStore());
afterEach(() => resetDispatchBatchesStore());

describe("mockDispatchBatchesRepository", () => {
  it("creates a batch with its member order ids", async () => {
    const result = await mockDispatchBatchesRepository.createBatch("ws_1", "member_1", { name: "Saturday Weddings", order_ids: ["dispatch_order_1", "dispatch_order_2"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Saturday Weddings");
      expect(result.data.order_ids).toEqual(["dispatch_order_1", "dispatch_order_2"]);
    }
  });

  it("rejects a blank name", async () => {
    const result = await mockDispatchBatchesRepository.createBatch("ws_1", "member_1", { name: "  ", order_ids: ["dispatch_order_1"] });
    expect(result.success).toBe(false);
  });

  it("rejects a batch with no orders", async () => {
    const result = await mockDispatchBatchesRepository.createBatch("ws_1", "member_1", { name: "Empty Batch", order_ids: [] });
    expect(result.success).toBe(false);
  });

  it("listBatchesForWorkspace scopes to the workspace", async () => {
    await mockDispatchBatchesRepository.createBatch("ws_1", "member_1", { name: "Batch A", order_ids: ["dispatch_order_1"] });
    await mockDispatchBatchesRepository.createBatch("ws_2", "member_1", { name: "Batch B", order_ids: ["dispatch_order_2"] });

    const ws1 = await mockDispatchBatchesRepository.listBatchesForWorkspace("ws_1");
    expect(ws1).toHaveLength(1);
    const ws2 = await mockDispatchBatchesRepository.listBatchesForWorkspace("ws_2");
    expect(ws2).toHaveLength(1);
  });

  it("getBatchById returns null for a batch that doesn't exist", async () => {
    expect(await mockDispatchBatchesRepository.getBatchById("dispatch_batch_missing")).toBeNull();
  });
});
