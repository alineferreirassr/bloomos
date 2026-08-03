import { describe, expect, it } from "vitest";
import { resourceKey, buildResourcePoolSnapshot, detectCriticalResources, type ResourcePoolResourceInput } from "@/core/allocation/resourcePoolEngine";

function makeResource(overrides: Partial<ResourcePoolResourceInput> = {}): ResourcePoolResourceInput {
  return { resource_type: "worker", resource_id: "worker_1", state: "available", ...overrides };
}

describe("resourceKey", () => {
  it("combines resource_type and resource_id", () => {
    expect(resourceKey("worker", "worker_1")).toBe("worker:worker_1");
  });
});

describe("buildResourcePoolSnapshot", () => {
  it("tallies each state count correctly", () => {
    const resources = [makeResource({ resource_id: "w1", state: "available" }), makeResource({ resource_id: "w2", state: "reserved" }), makeResource({ resource_id: "w3", state: "busy" }), makeResource({ resource_id: "w4", state: "unavailable" })];
    const snapshot = buildResourcePoolSnapshot(resources, new Set(), new Set());
    expect(snapshot.availableCount).toBe(1);
    expect(snapshot.reservedCount).toBe(1);
    expect(snapshot.busyCount).toBe(1);
    expect(snapshot.unavailableCount).toBe(1);
  });

  it("marks entries shared/critical from the supplied key sets", () => {
    const resources = [makeResource({ resource_id: "w1" }), makeResource({ resource_id: "w2" })];
    const snapshot = buildResourcePoolSnapshot(resources, new Set([resourceKey("worker", "w1")]), new Set([resourceKey("worker", "w2")]));
    expect(snapshot.entries.find((e) => e.resource_id === "w1")?.isShared).toBe(true);
    expect(snapshot.entries.find((e) => e.resource_id === "w1")?.isCritical).toBe(false);
    expect(snapshot.entries.find((e) => e.resource_id === "w2")?.isCritical).toBe(true);
    expect(snapshot.sharedCount).toBe(1);
    expect(snapshot.criticalCount).toBe(1);
  });

  it("returns zeroed counts for an empty resource list", () => {
    const snapshot = buildResourcePoolSnapshot([], new Set(), new Set());
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.availableCount).toBe(0);
  });
});

describe("detectCriticalResources", () => {
  it("flags a resource that is the only eligible candidate for a line", () => {
    const pools = [[{ resource_type: "worker" as const, resource_id: "worker_1" }]];
    const critical = detectCriticalResources(pools);
    expect(critical.has(resourceKey("worker", "worker_1"))).toBe(true);
  });

  it("does not flag a resource when multiple candidates are eligible for the line", () => {
    const pools = [
      [
        { resource_type: "worker" as const, resource_id: "worker_1" },
        { resource_type: "worker" as const, resource_id: "worker_2" },
      ],
    ];
    const critical = detectCriticalResources(pools);
    expect(critical.size).toBe(0);
  });

  it("does not flag anything for a line with zero eligible candidates", () => {
    const pools: Array<Array<{ resource_type: "worker"; resource_id: string }>> = [[]];
    const critical = detectCriticalResources(pools);
    expect(critical.size).toBe(0);
  });
});
