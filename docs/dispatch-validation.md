# Dispatch Validation Engine

`src/core/dispatch/dispatchValidationEngine.ts` — v2.0 Checkpoint 28, Step 4.

## What it answers

"Reject invalid dispatches" — 7 named checks over a `DispatchOrder` and its frozen `ExecutionSnapshot`, producing errors (block dispatch) and warnings (informational, never blocking).

```ts
validateDispatch(input: DispatchValidationInput): DispatchValidationResult
```

| Check | Rule | Severity |
|---|---|---|
| Package Approved | `packageStatus !== "approved"` | error (`package_not_approved`) |
| Package Ready | `packageReadinessState !== "ready"` | error (`package_not_ready`) |
| Assignment Exists | `order.assignments.length === 0` | error (`no_assignments`) |
| Dependencies Complete | any unsatisfied `snapshot.dependency_checks` entry | error (`dependencies_incomplete`) |
| Worker Active | a `worker` assignment's live status ≠ `"active"` | error (`worker_inactive`) |
| Resource Available | a `team`/`equipment`/`vehicle`/`vendor` assignment's live status ≠ its eligible status | error (`resource_unavailable`) |
| Resource Status Unknown | no live status entry exists for an assignment's resource | warning (`resource_status_unknown`) |
| Schedule Active | `snapshot.appointment_id !== null` and the live Appointment is no longer active | error (`schedule_inactive`) |

## `ELIGIBLE_STATUS_BY_RESOURCE_TYPE` — the disclosed status mapping

```ts
{ worker: "active", team: "active", equipment: "available", vehicle: "available", vendor: "active" }
```

`asset`/`custom` have no live status registry — same disclosed gap `RESOURCE_TYPES_WITH_NO_NODE` established for Allocation — they're silently skipped, never fabricated.

## This engine never fetches anything itself

Every real-world fact this pure validator needs (live Worker/Team/Equipment/Vehicle/Vendor status, whether the live Appointment is still active, the Execution Package's own status and readiness) is resolved by the caller, `modules/dispatch/dispatchActions.ts`'s `evaluateOrder`, and handed in as `resourceStatusByKey: Record<string, string>` (keyed `"${resource_type}:${resource_id}"`) and `scheduleActive: boolean`. `scheduleActive` is `true` when the snapshot has no schedule at all (nothing to invalidate) or when the live Appointment's status is neither `"cancelled"` nor `"completed"`.
