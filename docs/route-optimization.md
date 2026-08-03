# Route Optimization Platform — Architecture

v2.0 Checkpoint 30. Dispatch (28) assigns work. Field Operations (29) executes work and tracks its state. Route Optimization **calculates and manages routes** for work already assigned — it never executes work, never modifies Dispatch or Field Operations state, never performs GPS tracking, never calls an external map/traffic provider, and introduces no AI. Every engine here is a pure, deterministic function over already-declared or already-computed data — no randomness.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/routeOptimization.ts` | Below |
| Mock store | `lib/data/mock/routeOptimizationStore.ts` | — |
| Accessors | `core/routeOptimization/index.ts` | — |
| Route Builder | `core/routeOptimization/routeEngine.ts` | [`route-builder.md`](route-builder.md) |
| Travel Estimation Engine | `core/routeOptimization/travelEngine.ts` | [`travel-estimation.md`](travel-estimation.md) |
| Route Validation Engine | `core/routeOptimization/routeValidationEngine.ts` | [`route-validation.md`](route-validation.md) |
| Optimization Engine | `core/routeOptimization/optimizationEngine.ts` | [`optimization-engine.md`](optimization-engine.md) |
| Route Health Engine / Explanation Engine | `core/routeOptimization/{routeHealthEngine,routeExplanationEngine}.ts` | [`route-health.md`](route-health.md) |
| Route Timeline Engine / Risk Engine / Findings Engine | `core/routeOptimization/{routeTimelineEngine,routeRiskEngine,routeFindingsEngine}.ts` | [`route-timeline.md`](route-timeline.md) |
| Module layer | `modules/routeOptimization/routeOptimizationActions.ts` | Below |
| Dashboards | `/route-optimization`, `/route-optimization/[id]` | [`optimization-dashboard.md`](optimization-dashboard.md), [`route-detail.md`](route-detail.md) |

## Domain shape — mirrors Execution Package's own Package/Version/Snapshot precedent

A `RoutePlan` is one aggregate document per Dispatch Assignment (a `RoutePlanStatus` shell — reuses `ExecutionStatus` directly: `draft`/`validated`/`approved`/`archived`) carrying `versions: RouteVersion[]` inline — each version's own frozen `RouteSnapshot` (waypoints, segments, travel legs, constraints, and an `optimization_result` that starts `null`). A fresh version is appended every time optimization runs, never mutating a prior version's own snapshot — the exact "immutable version history" precedent `ExecutionPackage` established.

`Route` (a plain, computed-only view — `routePlan` + `snapshot` + `validation` + `travelEstimate` + `optimization` + `health` + `explanation`) is never a second stored source of truth; it's assembled fresh on every evaluation from the plan's own current version.

## No real geography anywhere — "declared, never measured"

No address, coordinate, or GPS field exists on any prior domain type this platform reuses, and the Stop Condition forbids adding one. Every travel figure here — `TravelLeg.declared_distance_km`/`declared_travel_minutes` — is a plain, author-declared number, the same discipline `ExecutionStep.estimated_duration_minutes` already established. The Route Builder defaults every leg to `0` ("not yet declared") rather than fabricating a realistic-looking distance; every downstream engine (Travel Estimation, Optimization, Health) operates correctly and deterministically over these numbers regardless of whether they're `0` or a real declared figure.

## Naming pair, disclosed — "Route" vs. "Route Plan"

The spec's own Step 1 names both nouns. `RoutePlan` is the persisted, versioned aggregate; `Route` is a plain computed convenience view over a plan's current version — never a second stored source of truth that could drift from the plan's own frozen snapshot.

## Route naming — `/route-optimization`

No naming collision existed for this prefix, any of the 10 named doc filenames, or the `route-optimization` navigation entry — confirmed by research before implementation began.

## Module layer — `routeOptimizationActions.ts`

- **`buildRoutePlanAction`** — resolves the source Dispatch Order/Assignment/Execution Package, gates on `evaluateRouteEligibility`, builds the route's waypoints/segments/travel legs via `buildRouteStructure`, and persists the plan with its first version in `draft` status. Emits `route_created` — unlike Field Operations (which emits nothing on build), Route Optimization's own Step 8 explicitly names "Route Created" as one of its 6 Timeline events.
- **`evaluateRoutePlanAction`** — composes `RouteValidationEngine` + `TravelEstimationEngine` + `RouteHealthEngine` + `RouteExplanationEngine` into one `Route`, a pure read.
- **`optimizeRoutePlanAction`** — runs the Optimization Engine over the plan's current stop order and appends a fresh version carrying the reordered waypoints/segments/travel legs. Emits `route_optimized` the first time a plan is ever optimized, `optimization_recalculated` every time after.
- **`validateRoutePlanAction`/`approveRoutePlanAction`/`archiveRoutePlanAction`** — status transitions (`draft → validated → approved → archived`), each gated on the prior status and emitting the matching named Timeline event.
- **`evaluateRouteOptimizationPlatformHealthAction`** — the Dashboard's and Executive Decisions' shared data source: re-evaluates every route plan in the workspace, then runs `detectRouteRisks`.

Same minimal session-gate discipline every prior checkpoint's module layer uses — every action only checks `session.kind !== "active"`; `route_optimization.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline.

## Permissions

`route_optimization.view`/`route_optimization.manage` — the spec names these 2 capabilities directly, already the narrower-manage/broader-view split every module in this codebase uses. `manager` gets both; `staff` gets only `view`.

## Known disclosed gap — the Dashboard/Detail UI is read-only

Every mutation action (`buildRoutePlanAction`, `optimizeRoutePlanAction`, `approveRoutePlanAction`, etc.) exists and is fully tested, but no button in `RouteOptimizationDashboardView`/`RouteDetailView` calls them yet — the same "no create/mutate control wired" scope every prior platform dashboard in this codebase discloses. `evaluateRoutePlanAction` is the one wired exception, a genuine read.
