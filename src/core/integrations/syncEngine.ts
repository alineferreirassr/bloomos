import { generateId, nowIso } from "@/lib/data/utils";
import type { SyncCheckpoint, SyncConflict, SyncMode, SyncRun } from "@/core/integrations/types";

/**
 * The Synchronization Engine (v2 Checkpoint 22, Step 13) — bookkeeping
 * for a bidirectional sync run, entirely mock: no real remote system is
 * ever read from or written to. What's real is the run lifecycle
 * (`running` → `succeeded`/`failed`/`conflict`), a per-connection cursor
 * (`SyncCheckpoint`) so a future incremental sync knows where it left
 * off, and last-write-wins conflict resolution (`SyncConflict.resolution`)
 * — the one strategy this phase supports, comparing two ISO timestamps a
 * caller already has (a real bidirectional merge is out of scope; see
 * `docs/integration-platform.md`'s Known Limitations).
 */

let checkpoints: SyncCheckpoint[] = [];
let conflicts: SyncConflict[] = [];
let runs: SyncRun[] = [];

export function resetSyncEngine(): void {
  checkpoints = [];
  conflicts = [];
  runs = [];
}

export function getSyncCheckpoint(connectionId: string): SyncCheckpoint | null {
  return checkpoints.find((checkpoint) => checkpoint.connection_id === connectionId) ?? null;
}

export function updateSyncCheckpoint(connectionId: string, cursor: string | null): SyncCheckpoint {
  const now = nowIso();
  const existing = getSyncCheckpoint(connectionId);
  const updated: SyncCheckpoint = existing
    ? { ...existing, cursor, last_synced_at: now, updated_at: now }
    : { id: generateId("sync-checkpoint"), connection_id: connectionId, cursor, last_synced_at: now, updated_at: now };
  checkpoints = existing ? checkpoints.map((c) => (c.connection_id === connectionId ? updated : c)) : [...checkpoints, updated];
  return updated;
}

export function startSyncRun(connectionId: string, mode: SyncMode): SyncRun {
  const run: SyncRun = {
    id: generateId("sync-run"),
    connection_id: connectionId,
    mode,
    status: "running",
    records_processed: 0,
    conflicts_detected: 0,
    started_at: nowIso(),
    completed_at: null,
    error: null,
  };
  runs = [...runs, run];
  return run;
}

function updateRun(runId: string, patch: Partial<SyncRun>): SyncRun | null {
  const existing = runs.find((run) => run.id === runId);
  if (!existing) return null;
  const updated: SyncRun = { ...existing, ...patch };
  runs = runs.map((run) => (run.id === runId ? updated : run));
  return updated;
}

export function completeSyncRun(runId: string, recordsProcessed: number): SyncRun | null {
  const run = runs.find((r) => r.id === runId);
  const hasConflicts = (run?.conflicts_detected ?? 0) > 0;
  return updateRun(runId, { status: hasConflicts ? "conflict" : "succeeded", records_processed: recordsProcessed, completed_at: nowIso() });
}

export function failSyncRun(runId: string, error: string): SyncRun | null {
  return updateRun(runId, { status: "failed", completed_at: nowIso(), error });
}

/** Last-write-wins: the side with the later `updated_at` wins automatically — resolved the instant it's detected, so `resolved_at` is never null for this phase's own single supported strategy. */
export function detectConflict(runId: string, connectionId: string, entityRef: string, localUpdatedAt: string, remoteUpdatedAt: string): SyncConflict {
  const resolution = localUpdatedAt === remoteUpdatedAt ? "unresolved" : new Date(localUpdatedAt).getTime() > new Date(remoteUpdatedAt).getTime() ? "local_wins" : "remote_wins";
  const now = nowIso();
  const conflict: SyncConflict = {
    id: generateId("sync-conflict"),
    connection_id: connectionId,
    entity_ref: entityRef,
    local_updated_at: localUpdatedAt,
    remote_updated_at: remoteUpdatedAt,
    resolution,
    detected_at: now,
    resolved_at: resolution === "unresolved" ? null : now,
  };
  conflicts = [...conflicts, conflict];

  const run = runs.find((r) => r.id === runId);
  if (run) updateRun(runId, { conflicts_detected: run.conflicts_detected + 1 });

  return conflict;
}

export function listSyncRunsForConnection(connectionId: string): SyncRun[] {
  return runs.filter((run) => run.connection_id === connectionId).sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export function listConflictsForConnection(connectionId: string): SyncConflict[] {
  return conflicts.filter((conflict) => conflict.connection_id === connectionId).sort((a, b) => b.detected_at.localeCompare(a.detected_at));
}
