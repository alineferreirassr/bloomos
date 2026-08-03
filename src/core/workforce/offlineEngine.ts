import type { OfflineQueueEntry } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26, Step 8 — Offline Foundation's only real logic.
 * There is no sync engine and no conflict resolution this checkpoint —
 * this file exists purely to summarize what's queued, so a future
 * checkpoint's real sync processor (and this checkpoint's own dashboard)
 * has an honest count to show instead of a fabricated one.
 */
export interface OfflineQueueSummary {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  oldestPendingQueuedAt: string | null;
}

export function summarizeOfflineQueue(entries: OfflineQueueEntry[]): OfflineQueueSummary {
  const pending = entries.filter((e) => e.status === "pending");
  const oldestPending = pending.slice().sort((a, b) => a.queued_at.localeCompare(b.queued_at))[0];

  return {
    pendingCount: pending.length,
    syncedCount: entries.filter((e) => e.status === "synced").length,
    failedCount: entries.filter((e) => e.status === "failed").length,
    oldestPendingQueuedAt: oldestPending?.queued_at ?? null,
  };
}
