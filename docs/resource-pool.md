# Resource Pool Engine

`src/core/allocation/resourcePoolEngine.ts` — v2.0 Checkpoint 27.1, Step 15.

## What it answers

Across every active allocation, what's the real state of every resource in use — available, reserved, busy, unavailable — and which ones are shared or a single point of failure?

## A read model, not a re-derivation

`state` is resolved by the caller (`allocationActions.ts`) from real Checkpoint 26 data (`Worker`/`AvailabilityStatus` via the real `resolveCurrentAvailability`, `Equipment.status`, `Vehicle.status`) — this file only aggregates that state, plus what `sharedResourceEngine.ts`/`detectCriticalResources` already computed, into one `ResourcePoolSnapshot`.

```ts
buildResourcePoolSnapshot(resources, sharedResourceKeys, criticalResourceKeys): ResourcePoolSnapshot
// { entries, availableCount, reservedCount, busyCount, unavailableCount, sharedCount, criticalCount }
```

`"reserved"` is never produced by `allocationActions.ts`'s own state resolution — Allocations never reserve resources (this checkpoint's own stop condition). It's reserved vocabulary for a future Dispatch checkpoint that books real `Reservation`s from an approved `Allocation`.

## `detectCriticalResources`

```ts
detectCriticalResources(eligiblePoolsByLine: EligiblePoolEntry[][]): Set<string>
```

A resource is critical when it's the *only* eligible candidate for some active requirement line — removing it would make that line unfulfillable. The same "single point of failure" concept `capabilityRiskEngine.ts`'s `single_eligible_worker` detector established, generalized across every resource type this checkpoint allocates.

## `resourceKey`

`` `${resource_type}:${resource_id}` `` — the one canonical key every engine in this checkpoint (shared-resource conflicts, workload counts, resource pool entries, critical-resource detection) uses to identify a resource across allocations.

## Consumers

- `evaluateResourceAllocationHealthAction` (`allocationActions.ts`) — the Allocation Dashboard's `resourcePool` data.
- `allocationRiskEngine.ts` — the `resource_bottleneck` finding, triggered when a critical resource is also in use across more than one active allocation.
