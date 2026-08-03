import type { LocationSnapshot } from "@/types/workforce";
import { ok, type DataResult } from "@/lib/data/result";
import { nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 26, Step 9 — Location Foundation. Infrastructure only:
 * this store keeps the single latest snapshot per worker (keyed by
 * `worker_id`, overwritten on every new report), never a history. No
 * routing, no maps, no GPS trail, no geofencing — per the stop condition.
 */
let latestByWorkerId: Map<string, LocationSnapshot> = new Map();

export function resetLocationStore(): void {
  latestByWorkerId = new Map();
}

export interface RecordLocationInput {
  worker_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  source: LocationSnapshot["source"];
}

async function recordSnapshot(workspaceId: string, input: RecordLocationInput): Promise<DataResult<LocationSnapshot>> {
  const snapshot: LocationSnapshot = {
    worker_id: input.worker_id,
    workspace_id: workspaceId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_meters: input.accuracy_meters,
    recorded_at: nowIso(),
    source: input.source,
  };
  latestByWorkerId.set(input.worker_id, snapshot);
  return ok(snapshot);
}

async function getLatestSnapshot(workerId: string): Promise<LocationSnapshot | null> {
  return latestByWorkerId.get(workerId) ?? null;
}

async function listLatestSnapshotsForWorkspace(workspaceId: string): Promise<LocationSnapshot[]> {
  return Array.from(latestByWorkerId.values()).filter((s) => s.workspace_id === workspaceId);
}

export interface LocationRepository {
  recordSnapshot: typeof recordSnapshot;
  getLatestSnapshot: typeof getLatestSnapshot;
  listLatestSnapshotsForWorkspace: typeof listLatestSnapshotsForWorkspace;
}

export const mockLocationRepository: LocationRepository = {
  recordSnapshot,
  getLatestSnapshot,
  listLatestSnapshotsForWorkspace,
};
