# Capacity Engine

`src/core/scheduling/capacityEngine.ts` — v2.0 Checkpoint 27, Step 10.

## What it answers

Given a `CapacityRule` (max concurrent bookings per worker/team/resource/workspace, per day or per time window), would adding one more booking breach it — and by how much is the scope currently used?

## Model

`CapacityRule.scope` is `worker`/`team`/`resource`/`workspace`; `scope_id` is `null` only for `workspace` scope. `window` is `day` (count everything on the same calendar date) or `time_window` (count only genuinely overlapping bookings).

```ts
resolveApplicableCapacityRule(rules, scope, scopeId): CapacityRule | null
countConcurrentUsage(rule, candidateInterval, existingUsage): number
checkCapacity(rule, candidateInterval, existingUsage): { withinCapacity, currentUsage, maxConcurrent }
```

## Deliberately generic over "usage"

This engine never touches `Reservation` or `Appointment` directly — it takes a caller-mapped `CapacityUsageEntry[]` (`{ scope, scope_id, starts_at, ends_at }`). `schedulingActions.buildCapacityUsageEntries()` is the one place that maps real bookings into that shape: an appointment's `worker_id` becomes a `worker`-scope entry, every appointment counts toward `workspace` scope, and a calendar whose `context_type` is `"team"` contributes its appointments to that team's scope. This keeps `CapacityEngine` from ever duplicating `assignmentConflictEngine.ts`'s team-size check (a *who*-question) — this engine only ever answers *when*.

## Vacuous pass when unconfigured

No `CapacityRule` for a scope means `checkCapacity` returns `{ withinCapacity: true, currentUsage: 0, maxConcurrent: null }` — an unconfigured scope is never artificially capped, the same discipline `capabilityScoreEngine.ts` established for "not applicable resolves to a pass, never a fabricated failure."

## Consumers

- `conflictEngine.buildCapacityConflict()` — turns a breach into a `capacity_conflict`.
- `schedulingRiskEngine.ts` — the `capacity_exhausted` finding.
- `schedulingScoreEngine.ts` — `capacityUtilizationScore`.
