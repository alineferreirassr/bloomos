import type { EligibilityState } from "@/types/capability";

/**
 * v2.0 Checkpoint 26.1 — the "prior-evaluation storage"
 * `capabilityTimelineEngine.ts` needs to tell "this worker just became
 * eligible" from "this worker was already eligible last time too." Same
 * convention as `businessHealthSnapshotsStore.ts`: module-scoped `Map`,
 * immutable reassignment, `resetXStore()` for tests only. Mock-only —
 * there is no Supabase table for this yet.
 */
export interface CapabilityEvaluationSnapshot {
  requirementId: string;
  workerId: string;
  state: EligibilityState;
  overallCapabilityScore: number;
}

let snapshots = new Map<string, CapabilityEvaluationSnapshot>();

function snapshotKey(requirementId: string, workerId: string): string {
  return `${requirementId}:${workerId}`;
}

export function getEvaluationSnapshot(requirementId: string, workerId: string): CapabilityEvaluationSnapshot | null {
  return snapshots.get(snapshotKey(requirementId, workerId)) ?? null;
}

export function setEvaluationSnapshot(snapshot: CapabilityEvaluationSnapshot): void {
  snapshots = new Map(snapshots).set(snapshotKey(snapshot.requirementId, snapshot.workerId), snapshot);
}

/** All snapshots for one requirement — used to prune snapshots for workers no longer in the evaluated set (e.g. archived since the last run) without leaking stale entries forever. */
export function listEvaluationSnapshotsForRequirement(requirementId: string): CapabilityEvaluationSnapshot[] {
  return Array.from(snapshots.values()).filter((s) => s.requirementId === requirementId);
}

export function resetCapabilityEvaluationSnapshotsStore(): void {
  snapshots = new Map();
}
