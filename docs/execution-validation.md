# Execution Validation Engine

`src/core/fieldOperations/executionValidationEngine.ts` — v2.0 Checkpoint 29, Step 4.

## The 6 named checks — all blocking errors, no warnings

```ts
validateExecution(input: ExecutionValidationInput): ExecutionValidationResult
```

| Check | Rule id | Failing condition |
|---|---|---|
| Dispatch Accepted | `dispatch_not_accepted` | The source Dispatch Assignment's `queue_state !== "accepted"` |
| Execution Package Approved | `package_not_approved` | The source Execution Package's `status !== "approved"` |
| Worker Assigned | `worker_not_assigned` | No `resource_type === "worker"` assignment exists on the order |
| Required Resources Present | `required_resources_missing` | The order has zero assignments |
| Operational Plan Exists | `operational_plan_missing` | The frozen snapshot's `operational_plan_id === null` |
| Assignment Active | `assignment_inactive` | The order isn't `"dispatched"`, or the assignment isn't `"accepted"` |

Unlike Dispatch's own validation engine (which has both blocking errors and informational warnings), every one of Field Operations' 6 named checks is a blocking error — none are merely informational, since none of them describe a state execution could safely proceed under.

## Every fact is resolved by the caller — this engine fetches nothing

`ExecutionValidationInput` is 6 plain booleans. `validateExecution` never calls a repository, never recalculates Dispatch/Allocation/Scheduling to answer any of these questions — `resolveEvaluationContext` in `fieldOperationsActions.ts` is the single place that reads the real Dispatch Order/Assignment/Execution Package/frozen snapshot and derives these 6 facts, every time. This is the same "pure validator, caller resolves the world" split every validation engine in this codebase (`DispatchValidationEngine`, `PackageValidationEngine`, `ScheduleValidationEngine`) already uses.

## "Reject invalid execution attempts"

`ExecutionSessionEngine.evaluateStartDecision` calls `validateExecution`'s result directly and refuses to allow a `started` transition when `valid` is `false` — the spec's own Step 4 line is enforced at the one place a session can actually begin doing work, never bypassed by a second code path.
