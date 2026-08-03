import type { LocationSnapshot } from "@/types/workforce";
import type { OperationalLocationSummary } from "@/types/operationsCenter";
import { isSnapshotStale } from "@/core/workforce/locationEngine";

/**
 * v2.0 Checkpoint 31, Step 13 — Operational Map Placeholder. Deliberately
 * list-based, never a real map: this engine never renders a map, never
 * calls a map/geocoding provider, never exposes a `LocationSnapshot`'s own
 * `latitude`/`longitude`, and never returns a location history — only
 * counts, a last-updated timestamp, and a plain-language accuracy summary.
 * A future provider-ready map surface would read Workforce's own location
 * store directly and enforce its own coordinate-visibility permission
 * check; this engine is what the dashboard shows until that surface
 * exists.
 */
export interface MapPlaceholderSourceData {
  workerLocationSnapshots: LocationSnapshot[];
  totalWorkerCount: number;
  knownOperationLocationsCount: number;
  knownRouteWaypointsCount: number;
  now: string;
}

export function computeOperationalLocationSummary(data: MapPlaceholderSourceData): OperationalLocationSummary {
  const knownWorkerLocationsCount = data.workerLocationSnapshots.length;
  const unknownLocationCount = Math.max(0, data.totalWorkerCount - knownWorkerLocationsCount);

  const lastLocationTimestamp = data.workerLocationSnapshots.reduce<string | null>((latest, snapshot) => (latest === null || snapshot.recorded_at > latest ? snapshot.recorded_at : latest), null);

  const staleCount = data.workerLocationSnapshots.filter((s) => isSnapshotStale(s, data.now)).length;
  const locationAccuracySummary =
    knownWorkerLocationsCount === 0 ? "No worker location data is currently available." : `${knownWorkerLocationsCount - staleCount} of ${knownWorkerLocationsCount} known worker location${knownWorkerLocationsCount === 1 ? "" : "s"} ${knownWorkerLocationsCount - staleCount === 1 ? "is" : "are"} current; ${staleCount} ${staleCount === 1 ? "is" : "are"} stale.`;

  return {
    knownWorkerLocationsCount,
    knownOperationLocationsCount: data.knownOperationLocationsCount,
    knownRouteWaypointsCount: data.knownRouteWaypointsCount,
    unknownLocationCount,
    lastLocationTimestamp,
    locationAccuracySummary,
  };
}
