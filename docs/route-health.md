# Route Health Engine / Route Explanation Engine

`src/core/routeOptimization/{routeHealthEngine,routeExplanationEngine}.ts` — v2.0 Checkpoint 30, Steps 6-7.

## Route Health Engine — 6 named scores

```ts
computeRouteHealthScores(input: ComputeRouteHealthInput): RouteHealthScores
```

| Score | Meaning | Vacuous value |
|---|---|---|
| `travelHealth` | 100 when travel is within a declared `max_travel_minutes` constraint (or none is declared); degrades proportionally once exceeded | 100 — nothing declared to violate |
| `efficiencyHealth` | A direct read of the Optimization Engine's own `travelEfficiency` | 100 — nothing optimized yet, nothing inefficient found |
| `delayRisk` | The one score that runs the opposite direction — higher means *more* risk | 0 (no risk) — no `latest_arrival_at` deadline declared, or no arrival estimate to compare against it |
| `constraintHealth` | The share of every declared `TravelConstraint` currently satisfied | 100 — no constraints declared at all |
| `optimizationHealth` | A direct read of the Optimization Engine's own `optimizationScore` | 100 — nothing optimized yet |
| `overallRouteHealth` | Average of the 5 above, `delayRisk` inverted first | — |

## `delayRisk` — 1 point of risk per minute late, capped at 100

A simple, deterministic, disclosed scale — never a live schedule lookup. If a `latest_arrival_at` constraint is declared and the estimated arrival runs past it, risk = minutes overrun, capped at 100. With no such constraint declared, or no arrival estimate to compare (no declared departure time exists yet), the score is vacuous-0 — no risk, since nothing exists to be at risk of missing.

## `overallRouteHealth` inverts `delayRisk` before averaging

The same asymmetric-vacuous-exclusion discipline `dispatchHealthEngine.ts`'s own `declineRate` and `executionHealthEngine.ts`'s own `pauseHealth` already established: a metric that measures badness gets excluded from a plain average unless inverted first, or it would silently pull the composite in the wrong direction. `overallRouteHealth = average(travelHealth, efficiencyHealth, 100 - delayRisk, constraintHealth, optimizationHealth)`.

## Route Explanation Engine — readable prose over already-computed data

```ts
explainRoute(validation, health, travelEstimate, optimization, constraints, phaseStopCount): RouteExplanation
```

Mirrors `dispatchExplanationEngine.ts`'s/`executionExplanationEngine.ts`'s shape exactly. Detects nothing new — every line traces back to a validation error, a declared constraint, or the Optimization/Health/Travel engines' own already-computed output:

| Field | Populated from |
|---|---|
| `rejectedRouteReasons` | Every current validation error's own detail, when the route is invalid |
| `constraintViolations` | Every declared constraint currently unsatisfied (reuses `isConstraintSatisfied`, exported from `routeHealthEngine.ts` — never a second, duplicate check) |
| `optimizationDecisions` | The optimized stop order and whether it improved travel — or "No optimization has been run yet" |
| `travelEstimateSummary` / `optimizationScoreSummary` / `healthSummary` | Direct summaries of the Travel/Optimization/Health engines' own output |
