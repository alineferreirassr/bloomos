import type { ResourceType, ResourcePoolState, ResourcePoolEntry, ResourcePoolSnapshot } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 15 — Resource Pool Engine. A read model
 * over already-known resource state — `state` is resolved by the caller
 * from real Checkpoint 26 data (`Worker`/`AvailabilityStatus`,
 * `Equipment.status`, `Vehicle.status`) and Checkpoint 27's
 * `ReservationEngine`, never recomputed here. This file only aggregates
 * that state, plus which resources are shared (`sharedResourceEngine.ts`)
 * or critical (single points of failure across active requirement
 * lines), into one `ResourcePoolSnapshot` for the Dashboard.
 */

export function resourceKey(resourceType: ResourceType, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

export interface ResourcePoolResourceInput {
  resource_type: ResourceType;
  resource_id: string;
  state: ResourcePoolState;
}

export function buildResourcePoolSnapshot(resources: ResourcePoolResourceInput[], sharedResourceKeys: ReadonlySet<string>, criticalResourceKeys: ReadonlySet<string>): ResourcePoolSnapshot {
  const entries: ResourcePoolEntry[] = resources.map((r) => ({
    resource_type: r.resource_type,
    resource_id: r.resource_id,
    state: r.state,
    isShared: sharedResourceKeys.has(resourceKey(r.resource_type, r.resource_id)),
    isCritical: criticalResourceKeys.has(resourceKey(r.resource_type, r.resource_id)),
  }));

  return {
    entries,
    availableCount: entries.filter((e) => e.state === "available").length,
    reservedCount: entries.filter((e) => e.state === "reserved").length,
    busyCount: entries.filter((e) => e.state === "busy").length,
    unavailableCount: entries.filter((e) => e.state === "unavailable").length,
    sharedCount: entries.filter((e) => e.isShared).length,
    criticalCount: entries.filter((e) => e.isCritical).length,
  };
}

export interface EligiblePoolEntry {
  resource_type: ResourceType;
  resource_id: string;
}

/** A resource is critical when it's the *only* eligible candidate for some active requirement line — removing it would make that line unfulfillable. The same "single point of failure" concept `capabilityRiskEngine.ts`'s `single_eligible_worker` detector established, generalized across every resource type this checkpoint allocates. */
export function detectCriticalResources(eligiblePoolsByLine: EligiblePoolEntry[][]): Set<string> {
  const critical = new Set<string>();
  for (const pool of eligiblePoolsByLine) {
    if (pool.length === 1) critical.add(resourceKey(pool[0].resource_type, pool[0].resource_id));
  }
  return critical;
}
