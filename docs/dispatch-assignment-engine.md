# Dispatch Assignment Engine

`src/core/dispatch/assignmentEngine.ts` — v2.0 Checkpoint 28, Step 3.

Named `assignmentEngine.ts` in its own directory (`core/dispatch/`), documented here as `dispatch-assignment-engine.md` since `assignment-engine.md` already documents Checkpoint 26's Workforce Assignment Engine (Worker → Client/Event/Project/Asset/Vehicle/Equipment/Vendor/task placeholder) — a distinct concept from a Dispatch Order's own resource assignments.

## What it answers

Assigns Workers, Teams, Vehicles, Equipment, and Vendors to a Dispatch Order — but only ever by carrying forward the Execution Package's own frozen selections.

```ts
buildDispatchAssignments(candidates: AllocationCandidate[]): DispatchAssignmentSeed[]
```

Filters `ExecutionSnapshot.allocation_candidates` down to `selected: true`, mapping each to `{ resource_type, resource_id, requirement_line_index }`. Nothing else — no scoring, no eligibility re-check, no fallback resolution.

## "No recalculation" — the spec's own Step 3 line, honored literally

"Assignments must use the frozen Execution Package. No recalculation" means this engine never re-evaluates capability, availability, or allocation strategy. It reads `ExecutionSnapshot.allocation_candidates` — already frozen at Execution Package build time by Checkpoint 27.3's own `SnapshotEngine` — and produces one seed per already-selected candidate, unchanged. Re-scoring or re-selecting here would duplicate Resource Allocation (27.1), forbidden by the Stop Condition.

## Caller wiring — from seed to persisted assignment

`buildDispatchOrderAction` calls `buildDispatchAssignments(version.snapshot.allocation_candidates)` and passes the resulting `DispatchAssignmentSeed[]` straight through as `CreateDispatchOrderInput.assignments` — the mock store's `createOrder` mints each assignment's `id`/`created_at` and starts every one at `queue_state: "queued"`. The 5 resource types (`worker`/`team`/`equipment`/`vehicle`/`vendor`) all pass through identically; `asset`/`custom` are the same disclosed no-node gap `RESOURCE_TYPES_WITH_NO_NODE` established for Allocation — they simply never appear as selected candidates.
