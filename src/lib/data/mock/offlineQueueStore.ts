import type { OfflineQueueEntry } from "@/types/workforce";
import { type DataResult, ok } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 26, Step 8 — Offline Foundation. Infrastructure only:
 * this store records that a mobile client queued a change while offline.
 * There is no sync engine, no conflict resolution, and nothing ever
 * transitions an entry away from `"pending"` this checkpoint — the
 * `status`/`synced_at` fields exist so a future checkpoint has somewhere
 * real to write real sync results, per the stop condition ("Build only
 * the reusable operational foundation that future checkpoints will
 * extend").
 */
let entries: OfflineQueueEntry[] = [];

export function resetOfflineQueueStore(): void {
  entries = [];
}

export interface QueueOfflineEntryInput {
  worker_id: string;
  mobile_session_id: string;
  entity_type: string;
  entity_id: string | null;
  payload_summary: string;
}

async function listEntriesForWorkspace(workspaceId: string): Promise<OfflineQueueEntry[]> {
  return entries.filter((e) => e.workspace_id === workspaceId);
}

async function listEntriesForWorker(workerId: string): Promise<OfflineQueueEntry[]> {
  return entries.filter((e) => e.worker_id === workerId);
}

async function queueEntry(workspaceId: string, input: QueueOfflineEntryInput): Promise<DataResult<OfflineQueueEntry>> {
  const entry: OfflineQueueEntry = {
    id: generateId("offline_queue_entry"),
    workspace_id: workspaceId,
    worker_id: input.worker_id,
    mobile_session_id: input.mobile_session_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    payload_summary: input.payload_summary,
    status: "pending",
    queued_at: nowIso(),
    synced_at: null,
  };
  entries = [...entries, entry];
  return ok(entry);
}

export interface OfflineQueueRepository {
  listEntriesForWorkspace: typeof listEntriesForWorkspace;
  listEntriesForWorker: typeof listEntriesForWorker;
  queueEntry: typeof queueEntry;
}

export const mockOfflineQueueRepository: OfflineQueueRepository = {
  listEntriesForWorkspace,
  listEntriesForWorker,
  queueEntry,
};
