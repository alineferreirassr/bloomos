# Execution Health Engine / Execution Explanation Engine

`src/core/fieldOperations/{executionHealthEngine,executionExplanationEngine}.ts` — v2.0 Checkpoint 29, Steps 6-7.

## Execution Health Engine — 6 named scores

```ts
computeExecutionHealthScores(input: ComputeExecutionHealthInput): ExecutionHealthScores
```

| Score | Meaning | Vacuous value |
|---|---|---|
| `executionHealth` | Binary read of `ExecutionValidationResult.valid` | *(genuinely binary, no vacuous case)* |
| `progressHealth` | Average of 4 progress ratios (steps, milestones, checklist, deliverables) | 100 per ratio when nothing of that kind exists to track |
| `pauseHealth` | 1 − (paused share of elapsed time) | 100 when no time has elapsed yet |
| `completionHealth` | Binary once terminal (`100` for `completed`, `0` otherwise) | 100 pre-terminal — nothing bad has happened yet |
| `lifecycleHealth` | Reads `outcome` first (binary once terminal), else `60` for `paused` (a caution, not a failure), else `100` | — |
| `overallOperationalHealth` | Average of all 5 above | — |

## `pauseHealth` — the same asymmetric-vacuous discipline `declineRate` established for Dispatch

`computePauseHealth` is a "badness" metric measured as a healthy-direction score: `100` (fully healthy) when `elapsedTimeSeconds <= 0` — nothing to measure yet — degrading as the paused share of total elapsed time grows. This mirrors Dispatch's own `declineRate` precedent: a metric that measures something bad still gets a vacuous-*good* value, never a vacuous-100-reads-as-100%-bad value.

## `overallOperationalHealth` averages all 5, no exclusions

Unlike Dispatch's own health engine (which excludes `declineRate`/`pendingCount` from its own average because one is a duplicate signal and the other is a raw count, not a score), all 5 of Field Operations' component scores are genuine 0-100 health measures that don't double-count each other's signal — so the average includes every one of them, no exclusion needed.

## `lifecycleHealth` persists a terminal outcome through archiving

Once `outcome` is set (a session reached `completed`/`cancelled`/`aborted`/`failed`), `lifecycleHealth` stays binary on that outcome even after the session is later `archived` — archiving is filing away what happened, not erasing it. Only while `outcome` is still `null` does `lifecycleHealth` fall back to treating `paused` as a caution (`60`).

## Execution Explanation Engine — readable prose over already-computed data

```ts
explainExecution(validation, health, session, progress): ExecutionExplanation
```

Mirrors `dispatchExplanationEngine.ts`'s/`packageExplanationEngine.ts`'s shape exactly (`summary`/`healthSummary`, plus 4 named "why" lists). Detects nothing new — every line traces back to a validation error, the session's own `reason`, or the Operational Progress Engine's already-computed remaining-work counts:

| Field | Populated when |
|---|---|
| `whyCannotStart` | The session hasn't started yet (`started_at === null`) — lists every current validation error |
| `whyPaused` | `lifecycle_state === "paused"` and a `reason` was given |
| `whyResumed` | `lifecycle_state === "resumed"` — a fixed description, since Resume carries no domain reason of its own (only Cancel/Abort/Fail require one) |
| `whyFailed` | `lifecycle_state === "failed"` and a `reason` was given |
| `whyCompletionRejected` | The session is active and any of: steps remaining, milestones pending, checklist \< 100%, deliverables \< 100% |
