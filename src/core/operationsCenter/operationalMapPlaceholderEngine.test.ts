import { describe, expect, it } from "vitest";
import { computeOperationalLocationSummary, type MapPlaceholderSourceData } from "@/core/operationsCenter/operationalMapPlaceholderEngine";
import type { LocationSnapshot } from "@/types/workforce";

function makeSnapshot(overrides: Partial<LocationSnapshot> = {}): LocationSnapshot {
  return { worker_id: "worker_1", workspace_id: "ws_1", latitude: 40, longitude: -74, accuracy_meters: 10, recorded_at: "2026-01-01T00:00:00.000Z", source: "mobile_app", ...overrides };
}

function baseData(overrides: Partial<MapPlaceholderSourceData> = {}): MapPlaceholderSourceData {
  return { workerLocationSnapshots: [], totalWorkerCount: 5, knownOperationLocationsCount: 0, knownRouteWaypointsCount: 0, now: "2026-01-01T00:10:00.000Z", ...overrides };
}

describe("computeOperationalLocationSummary", () => {
  it("never exposes latitude/longitude on the returned summary", () => {
    const summary = computeOperationalLocationSummary(baseData({ workerLocationSnapshots: [makeSnapshot()] }));
    expect(JSON.stringify(summary)).not.toContain("40");
    expect(JSON.stringify(summary)).not.toContain("-74");
  });

  it("counts known vs. unknown worker locations against the total worker count", () => {
    const summary = computeOperationalLocationSummary(baseData({ workerLocationSnapshots: [makeSnapshot({ worker_id: "w1" }), makeSnapshot({ worker_id: "w2" })], totalWorkerCount: 5 }));
    expect(summary.knownWorkerLocationsCount).toBe(2);
    expect(summary.unknownLocationCount).toBe(3);
  });

  it("reports no location data when nothing has been recorded", () => {
    const summary = computeOperationalLocationSummary(baseData());
    expect(summary.locationAccuracySummary).toBe("No worker location data is currently available.");
    expect(summary.lastLocationTimestamp).toBeNull();
  });

  it("takes the most recent recorded_at as lastLocationTimestamp", () => {
    const summary = computeOperationalLocationSummary(baseData({ workerLocationSnapshots: [makeSnapshot({ recorded_at: "2026-01-01T00:00:00.000Z" }), makeSnapshot({ worker_id: "w2", recorded_at: "2026-01-01T00:08:00.000Z" })] }));
    expect(summary.lastLocationTimestamp).toBe("2026-01-01T00:08:00.000Z");
  });

  it("splits current vs. stale locations in the accuracy summary using Workforce's own staleness rule", () => {
    const summary = computeOperationalLocationSummary(baseData({ workerLocationSnapshots: [makeSnapshot({ recorded_at: "2026-01-01T00:09:00.000Z" }), makeSnapshot({ worker_id: "w2", recorded_at: "2025-12-01T00:00:00.000Z" })] }));
    expect(summary.locationAccuracySummary).toContain("1 of 2");
  });

  it("passes known operation locations and route waypoint counts straight through", () => {
    const summary = computeOperationalLocationSummary(baseData({ knownOperationLocationsCount: 3, knownRouteWaypointsCount: 12 }));
    expect(summary.knownOperationLocationsCount).toBe(3);
    expect(summary.knownRouteWaypointsCount).toBe(12);
  });
});
