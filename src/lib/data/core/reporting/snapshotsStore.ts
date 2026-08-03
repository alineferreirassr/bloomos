import type { ReportSnapshot } from "@/types/reporting";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 42 — append-only. "Snapshots must never overwrite
 * previous snapshots" (this checkpoint's own instruction) — there is
 * deliberately no `updateSnapshot`/`deleteSnapshot` export anywhere in
 * this file.
 */
let snapshots: ReportSnapshot[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetSnapshotsStore(): void {
  snapshots = [];
}

export function listSnapshots(workspaceId: string, reportId: string): ReportSnapshot[] {
  return snapshots.filter((s) => s.workspace_id === workspaceId && s.report_id === reportId).sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

export function getSnapshot(workspaceId: string, id: string): ReportSnapshot | null {
  return snapshots.find((s) => s.workspace_id === workspaceId && s.id === id) ?? null;
}

export type CreateSnapshotInput = Omit<ReportSnapshot, "id" | "generated_at">;

export function createSnapshot(input: CreateSnapshotInput): ReportSnapshot {
  const snapshot: ReportSnapshot = { ...input, id: generateId("report_snapshot"), generated_at: nowIso() };
  snapshots = [...snapshots, snapshot];
  return snapshot;
}
