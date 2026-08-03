import { generateId } from "@/lib/data/utils";
import type { IntegrationSnapshot } from "@/core/integrations/types";

/**
 * v2 Checkpoint 43. Structurally immutable, same discipline as
 * `lib/data/core/reporting/snapshotsStore.ts` — no `updateSnapshot`/
 * `deleteSnapshot` export exists at all, not "throws if called."
 */
let snapshots: IntegrationSnapshot[] = [];

export function resetIntegrationSnapshotStore(): void {
  snapshots = [];
}

export function createSnapshot(snapshot: IntegrationSnapshot): IntegrationSnapshot {
  snapshots = [...snapshots, snapshot];
  return snapshot;
}

export function listSnapshotsForWorkspace(workspaceId: string): IntegrationSnapshot[] {
  return snapshots.filter((snapshot) => snapshot.workspace_id === workspaceId).sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

export function getSnapshot(workspaceId: string, id: string): IntegrationSnapshot | null {
  return snapshots.find((snapshot) => snapshot.workspace_id === workspaceId && snapshot.id === id) ?? null;
}

export function generateIntegrationSnapshotId(): string {
  return generateId("integration-snapshot");
}
