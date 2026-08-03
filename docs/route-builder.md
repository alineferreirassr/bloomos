# Route Builder

`src/core/routeOptimization/routeEngine.ts` — v2.0 Checkpoint 30, Step 2.

## What it answers

Given an already-accepted Dispatch Assignment and an already-approved Execution Package, decides whether a Route Plan may be built at all, then assembles its waypoints/segments/travel legs from the frozen snapshot's own phases.

```ts
evaluateRouteEligibility(input: RouteEligibilityInput): RouteEligibilityResult
```

Returns `{ canBuild: false, reason }` when `assignmentQueueState !== "accepted"` or `packageStatus !== "approved"`. Otherwise `{ canBuild: true, reason: null }`. Mirrors `fieldOperationEngine.ts`'s own minimal eligibility gate exactly.

## No recalculation of Allocation

This engine reads only the Dispatch Assignment's own `queue_state` and the Execution Package's own `status` — which resource was selected for which requirement line was already decided by Allocation/Dispatch, and is never re-derived here. `buildRouteStructure` never touches `AllocationCandidate` data at all.

## Building the route's structure

```ts
buildRouteStructure(routePlanId: string, phases: ExecutionPhase[]): RouteStructure
```

One waypoint per frozen `ExecutionPhase` (ordered by `phase.order`), bookended by a synthetic `origin` and `destination` stop — a route always has somewhere to start from and someone to return to, even though no real address exists for either. One `TravelLeg` and one `RouteSegment` per consecutive waypoint pair; each segment's `work_duration_minutes` sums the destination waypoint's own frozen phase steps' `estimated_duration_minutes` (`0` for the synthetic bookends).

## `TravelLeg.declared_*` fields default to `0` — a disclosed placeholder, not fabricated data

No real distance/travel-time data exists anywhere in this codebase, and inventing realistic-looking numbers would misrepresent real travel data as measured when it isn't. Every leg the builder produces starts at `declared_distance_km: 0, declared_travel_minutes: 0` — an honest "not yet declared" sentinel an ops planner would fill in through a future manual-entry UI (not wired this checkpoint, the same disclosed gap every prior platform dashboard in this codebase carries). Every downstream engine (Travel Estimation, Optimization, Health) is a pure function that operates correctly over these zeros exactly as it would over real declared figures.

## Caller wiring — `buildRoutePlanAction`

`modules/routeOptimization/routeOptimizationActions.ts`'s `buildRoutePlanAction` resolves the named Dispatch Order/Assignment/Execution Package, calls `evaluateRouteEligibility`, then `buildRouteStructure` against the frozen `ExecutionVersion.snapshot.phases`, and persists the result via the store's `createRoutePlan`. A rejection here returns the eligibility's own `reason` as the action's error, never a generic message.
