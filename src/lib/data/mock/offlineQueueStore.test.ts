import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockOfflineQueueRepository, resetOfflineQueueStore, type QueueOfflineEntryInput } from "@/lib/data/mock/offlineQueueStore";

const baseInput: QueueOfflineEntryInput = { worker_id: "worker_1", mobile_session_id: "session_1", entity_type: "checklist_item", entity_id: "item_1", payload_summary: "Marked complete offline" };

beforeEach(() => resetOfflineQueueStore());
afterEach(() => resetOfflineQueueStore());

describe("mockOfflineQueueRepository", () => {
  it("queues an entry as pending, never synced", async () => {
    const result = await mockOfflineQueueRepository.queueEntry("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
      expect(result.data.synced_at).toBeNull();
    }
  });

  it("lists entries scoped to the workspace", async () => {
    await mockOfflineQueueRepository.queueEntry("ws_1", baseInput);
    await mockOfflineQueueRepository.queueEntry("ws_2", baseInput);
    expect(await mockOfflineQueueRepository.listEntriesForWorkspace("ws_1")).toHaveLength(1);
  });

  it("lists entries scoped to a worker", async () => {
    await mockOfflineQueueRepository.queueEntry("ws_1", baseInput);
    await mockOfflineQueueRepository.queueEntry("ws_1", { ...baseInput, worker_id: "worker_2" });
    expect(await mockOfflineQueueRepository.listEntriesForWorker("worker_1")).toHaveLength(1);
  });
});
