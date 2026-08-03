# Execution Session Engine / Execution State Engine

`src/core/fieldOperations/{executionSessionEngine,executionStateEngine}.ts` — v2.0 Checkpoint 29, Steps 3 and 5.

## Execution Session Engine — the spec's 7 named actions, plus one disclosed addition

```ts
evaluateStartDecision(session, validation): SessionDecisionResult
evaluatePauseDecision(session): SessionDecisionResult
evaluateResumeDecision(session): SessionDecisionResult
evaluateCompleteDecision(session, requiredWorkComplete): SessionDecisionResult
evaluateCancelDecision(session, reason): SessionDecisionResult
evaluateAbortDecision(session, reason): SessionDecisionResult
evaluateArchiveDecision(session): SessionDecisionResult
```

Each returns `{ allowed, nextState, error }` — never throws, always readable by the caller. `evaluateStartDecision` additionally requires the Execution Validation Engine's own already-computed result to be valid ("Reject invalid execution attempts," Step 4's own line — never re-implemented here). `evaluateCompleteDecision` takes `requiredWorkComplete`, resolved by the caller from the Operational Progress Engine's own output, never re-derived in this file. Cancel/Abort both require a non-blank `reason` — an audit trail entry, never a bare boolean with no explanation.

### The disclosed addition — `evaluateFailDecision`

Step 3's own "Support" list names only 7 actions (no explicit "Fail Session"), but Step 2 requires all 10 lifecycle states to have deterministic transitions, including `failed`. A session can fail during active work — an execution-side problem distinct from a deliberate cancel/abort — so this engine exposes `evaluateFailDecision(session, reason)` with the exact same reachability `evaluateAbortDecision` has (from any active state, never from `created`/`waiting`).

## Sessions belong to one Dispatch Assignment

Every `ExecutionSession` carries `field_operation_id`, and every `FieldOperation` pins exactly one `dispatch_assignment_id` — so a session's ownership chain is always `Session → FieldOperation → DispatchAssignment`, one level of indirection, never a direct foreign key duplicated onto the session itself.

## Execution State Engine — pure derivations over the attempt log

```ts
computeExecutionState(session: ExecutionSession, now: string): ExecutionState
```

| Field | Derivation |
|---|---|
| `currentState` | `session.lifecycle_state`, read directly |
| `previousState` | `null` if zero attempts; `"created"` if exactly one attempt; otherwise the state two entries back in `attempts[]` |
| `transitionHistory` | `session.attempts`, unmodified |
| `elapsedTimeSeconds` | `created_at` → (`completed_at` or `now`) |
| `pauseDurationSeconds` | sum of every `paused → (resumed \| terminal)` interval in the attempt log, plus an open-ended pause still in progress at `now` |
| `executionDurationSeconds` | `started_at` → (`completed_at` or `now`), minus `pauseDurationSeconds`; `0` if never started |
| `completionDurationSeconds` | `null` until `completed_at` is set, then `created_at` → `completed_at` |

`now` is always supplied by the caller — the same "pure engine takes its timestamp from the caller" discipline `SnapshotEngine` established before it, so this engine never depends on a live clock internally and stays trivially testable with fixed timestamps. `computePauseDuration` handles any number of pause/resume cycles within one session, not just one.
