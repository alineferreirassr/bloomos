# Travel Estimation Engine

`src/core/routeOptimization/travelEngine.ts` — v2.0 Checkpoint 30, Step 3.

## What it calculates

```ts
computeTravelEstimate(input: ComputeTravelEstimateInput): TravelEstimate
```

| Field | Derivation |
|---|---|
| `estimatedTravelMinutes` | Sum of every `TravelLeg.declared_travel_minutes` |
| `estimatedDistanceKm` | Sum of every `TravelLeg.declared_distance_km` |
| `estimatedIdleMinutes` | Always `0` this checkpoint — see below |
| `estimatedTotalDurationMinutes` | `estimatedTravelMinutes` + summed `RouteSegment.work_duration_minutes` + `estimatedIdleMinutes` |
| `estimatedDepartureAt` | Echoes the caller's declared start time — `null` when none is declared |
| `estimatedArrivalAt` | `estimatedDepartureAt` + `estimatedTotalDurationMinutes`, or `null` when no start time exists to add to |

Pure arithmetic over already-declared `TravelLeg`/`RouteSegment` figures — never a live measurement, never an external map/traffic API call.

## Estimated Idle Time — always `0`, a disclosed placeholder

Real idle time (a worker arriving before work is allowed to start) would need per-waypoint scheduled time windows, and that data belongs to Scheduling (27), never duplicated here. The field exists and is computed so a future checkpoint can wire real windows in without changing this shape — it is not a fabricated figure standing in for real behavior, it is an honest `0` until real scheduling-window data is available to this domain.

## Caller wiring

`evaluateRoutePlanAction` (in `routeOptimizationActions.ts`) calls `computeTravelEstimate` with the current version's own `travel_legs`/`segments` and a `departureAt` of `null` (no declared start time this checkpoint) every time a route plan is evaluated — a pure, side-effect-free read, never persisted as a stored field of its own.
