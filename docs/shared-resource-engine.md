# Shared Resource Engine

`src/core/allocation/sharedResourceEngine.ts` — v2.0 Checkpoint 27.1, Step 10.

## What it answers

A resource can legitimately appear as a candidate in more than one active allocation — a truck used for both a morning and an evening event. This engine only ever flags the invalid case: the *same* resource proposed across two allocations whose required time windows genuinely overlap.

## Never a second `ConflictEngine`/`ReservationEngine`

Checkpoint 27's `ConflictEngine`/`ReservationEngine` operate on real, persisted `Reservation`s — a later, committed stage. This engine operates on still-proposed `Allocation` candidates, one stage earlier, before anything is reserved. Same underlying "does this time window collide" question, deliberately never reimplemented against a different data shape.

## `findSharedResourceConflicts`

```ts
findSharedResourceConflicts(candidate: ResourceUsageWindow, others: ResourceUsageWindow[]): ResourceUsageWindow[]
```

Returns every other allocation's usage of the *same* `resource_type`/`resource_id` whose `[starts_at, ends_at)` genuinely overlaps the candidate's — the raw material a `shared_resource_conflict` `AllocationFinding` is built from.

## `isResourceShared`

`true` when a resource is proposed across more than one distinct allocation at all, regardless of whether their windows overlap. A shared-but-non-overlapping resource isn't invalid — it's just worth surfacing on the Resource Pool as `isShared`.

## How `allocationActions.ts` builds the usage list

`computeSharedResourceConflictCount` gathers every selected candidate from every non-archived allocation workspace-wide (paired with its own request's `required_starts_at`/`required_ends_at`), excluding the allocation currently being evaluated, then runs `findSharedResourceConflicts` for each of the candidate allocation's own selected resources. The result feeds both `AllocationValidationEngine` (a non-blocking `shared_resource_conflict` warning) and `AllocationScoreEngine`'s implicit health signal.
