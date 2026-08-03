import { describe, expect, it } from "vitest";
import { isSnapshotStale, minutesSinceRecorded } from "@/core/workforce/locationEngine";
import type { LocationSnapshot } from "@/types/workforce";

const NOW = "2026-07-30T12:00:00.000Z";

function makeSnapshot(overrides: Partial<LocationSnapshot> = {}): LocationSnapshot {
  return { worker_id: "worker_1", workspace_id: "ws_1", latitude: -23.55, longitude: -46.63, accuracy_meters: 10, recorded_at: "2026-07-30T11:50:00.000Z", source: "mobile_app", ...overrides };
}

describe("isSnapshotStale", () => {
  it("is fresh within the default 30-minute window", () => {
    expect(isSnapshotStale(makeSnapshot({ recorded_at: "2026-07-30T11:50:00.000Z" }), NOW)).toBe(false);
  });

  it("is stale beyond the default window", () => {
    expect(isSnapshotStale(makeSnapshot({ recorded_at: "2026-07-30T11:00:00.000Z" }), NOW)).toBe(true);
  });

  it("respects a custom staleness threshold", () => {
    expect(isSnapshotStale(makeSnapshot({ recorded_at: "2026-07-30T11:50:00.000Z" }), NOW, 5)).toBe(true);
  });
});

describe("minutesSinceRecorded", () => {
  it("computes whole minutes elapsed", () => {
    expect(minutesSinceRecorded(makeSnapshot({ recorded_at: "2026-07-30T11:45:00.000Z" }), NOW)).toBe(15);
  });
});
