import { describe, expect, it } from "vitest";
import { summarizeOfflineQueue } from "@/core/workforce/offlineEngine";
import type { OfflineQueueEntry } from "@/types/workforce";

function makeEntry(overrides: Partial<OfflineQueueEntry> = {}): OfflineQueueEntry {
  return {
    id: "entry_1",
    workspace_id: "ws_1",
    worker_id: "worker_1",
    mobile_session_id: "session_1",
    entity_type: "checklist_item",
    entity_id: "item_1",
    payload_summary: "Marked complete",
    status: "pending",
    queued_at: "2026-07-30T00:00:00.000Z",
    synced_at: null,
    ...overrides,
  };
}

describe("summarizeOfflineQueue", () => {
  it("counts each status independently and finds the oldest pending entry", () => {
    const entries = [
      makeEntry({ id: "e1", status: "pending", queued_at: "2026-07-30T02:00:00.000Z" }),
      makeEntry({ id: "e2", status: "pending", queued_at: "2026-07-30T01:00:00.000Z" }),
      makeEntry({ id: "e3", status: "synced" }),
      makeEntry({ id: "e4", status: "failed" }),
    ];

    const summary = summarizeOfflineQueue(entries);
    expect(summary.pendingCount).toBe(2);
    expect(summary.syncedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.oldestPendingQueuedAt).toBe("2026-07-30T01:00:00.000Z");
  });

  it("returns null oldestPendingQueuedAt when nothing is pending", () => {
    expect(summarizeOfflineQueue([makeEntry({ status: "synced" })]).oldestPendingQueuedAt).toBeNull();
  });

  it("returns all zeros for an empty queue", () => {
    const summary = summarizeOfflineQueue([]);
    expect(summary).toEqual({ pendingCount: 0, syncedCount: 0, failedCount: 0, oldestPendingQueuedAt: null });
  });
});
