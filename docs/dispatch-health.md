# Dispatch Health Engine / Explanation Engine

`src/core/dispatch/{dispatchHealthEngine,dispatchExplanationEngine}.ts` — v2.0 Checkpoint 28, Steps 7-8.

## Dispatch Health Engine — 7 named scores

```ts
computeDispatchHealthScores(assignments: DispatchAssignment[], validationValid: boolean): DispatchHealthScores
```

| Score | Meaning | Vacuous value (0 assignments / 0 terminal responses) |
|---|---|---|
| `assignmentCoverage` | % of assignments not still `queued` | 100 |
| `acceptanceRate` | % of terminal responses that are `accepted` | 100 |
| `declineRate` | % of terminal responses that are `declined` | **0** |
| `queueHealth` | % of assignments in a healthy (non-declined/expired) state | 100 |
| `pendingCount` | raw count of assignments in `pending` | — (not a score) |
| `dispatchReadiness` | binary 100/0 reflecting `validationValid` | — (no vacuous case, genuinely binary) |
| `overallDispatchHealth` | average of `{assignmentCoverage, acceptanceRate, queueHealth, dispatchReadiness}` | — |

## The one deliberate asymmetry — `declineRate`'s vacuous value is `0`, not `100`

Every other score in this codebase's "vacuous-100" convention treats "no data yet" as the good state. `computeDeclineRate` breaks that convention on purpose: 0 declines out of 0 terminal responses is genuinely the good state for a metric that measures badness — vacuous-`100` would read as "100% decline rate," the opposite of what's true. Disclosed here rather than silently deviating from the codebase-wide pattern.

## `overallDispatchHealth` deliberately excludes `declineRate` and `pendingCount`

`declineRate` is an informational/negative signal, not a positive-health input — folding it into the average would double-count the same signal `acceptanceRate`/`queueHealth` already capture from the opposite direction. `pendingCount` is a raw count, not a 0-100 score, so it can't be averaged in directly.

## Dispatch Explanation Engine — readable prose over already-computed data

```ts
explainDispatch(validation: DispatchValidationResult, health: DispatchHealthScores, assignments: DispatchAssignment[]): DispatchExplanation
```

Mirrors `packageExplanationEngine.ts`'s shape exactly (`summary`/`whyFailed`/`whySucceeded`/`validationFailures`/`acceptanceFailures`/`queueStatus`/`dispatchReadinessSummary`). `queueStatus` is built by reusing `countByQueueState` from the Queue Engine — never a second, duplicate tally.
