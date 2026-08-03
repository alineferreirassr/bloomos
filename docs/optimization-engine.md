# Optimization Engine

`src/core/routeOptimization/optimizationEngine.ts` — v2.0 Checkpoint 30, Step 5.

## A deterministic greedy reorder, not a full TSP solver — and deliberately not one

`TravelLeg.declared_*` figures are an ops planner's own declared inputs, not measured distances — there is no real pairwise distance matrix anywhere in this domain to run a proper TSP solver against (building one would mean fabricating a full grid of distances nobody declared). The heuristic instead sorts each `phase_stop` waypoint by its own already-declared "cost to reach" — the `declared_travel_minutes` of the leg that currently arrives at it — ascending.

```ts
optimizeRoute(input: OptimizeRouteInput): OptimizeRouteOutput
```

- **Stable-sorted**: with every leg still at its `0` build-time default (the common case this checkpoint, before any real figures are entered), the order never changes and `improved` is honestly `false`.
- **No GPS, no traffic API, no randomness** — the same input always produces the same output (verified directly by a dedicated test).
- **New adjacent pairs get a fresh `0`-declared placeholder leg.** If reordering makes two waypoints adjacent that never had a declared leg between them before, a new `TravelLeg` is created with `declared_distance_km: 0, declared_travel_minutes: 0` — the same "not yet declared" convention `buildRouteStructure` itself uses, never a fabricated figure.

## The 6 named outputs

| Field | Derivation |
|---|---|
| `optimizedWaypointOrder` | The reordered `phase_stop` waypoint ids only — the synthetic `origin`/`destination` bookends are never reordered |
| `totalTravelMinutes` | Sum of declared minutes along the new, optimized order |
| `totalIdleMinutes` | Always `0` — the same disclosed placeholder `travelEngine.ts` uses |
| `travelEfficiency` | The work share of total time: `workMinutes / (workMinutes + travelMinutes) * 100`, vacuous-100 when both are `0` |
| `resourceUtilization` | The share of `phase_stop` waypoints that actually have work (`work_duration_minutes > 0`), vacuous-100 when there are no stops at all |
| `optimizationScore` | `round((travelEfficiency + resourceUtilization) / 2)` |
| `improved` | `true` only when the optimized order's total travel is strictly less than the original order's |

## Caller wiring — `optimizeRoutePlanAction`

Reads the current version's snapshot, calls `optimizeRoute`, and passes the returned reordered `waypoints`/`segments`/`travelLegs` straight into `appendOptimizedVersion` — a fresh immutable version, never mutating a prior one. Emits `route_optimized` (first time) or `optimization_recalculated` (every time after), based on whether any prior version already carried a non-`null` `optimization_result`.
