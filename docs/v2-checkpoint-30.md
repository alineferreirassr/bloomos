# v2.0 Checkpoint 30 — Route Optimization Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Dispatch (28) assigns work. Field Operations (29) executes work and tracks its state. Route Optimization **calculates and manages routes** for work already assigned — it never executes work, never modifies Dispatch or Field Operations state, never performs GPS tracking, never calls an external map/traffic provider, and introduces no AI. Every engine is a pure, deterministic function over already-declared or already-computed data.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/routeOptimization.ts` | `RoutePlan`/`RouteVersion`/`RouteSnapshot`/`Waypoint`/`TravelLeg`/`RouteSegment`/`TravelConstraint` + 5 computed-only result shapes — see [`route-optimization.md`](route-optimization.md) |
| Mock store | `lib/data/mock/routeOptimizationStore.ts` | One aggregate document per route plan; `appendOptimizedVersion` is the single function every optimization run goes through, never mutating a prior version |
| Route Builder | `core/routeOptimization/routeEngine.ts` | [`route-builder.md`](route-builder.md) — no recalculation of Allocation, declared travel figures default to `0` |
| Travel Estimation Engine | `core/routeOptimization/travelEngine.ts` | [`travel-estimation.md`](travel-estimation.md) — 6 named calculations, pure arithmetic |
| Route Validation Engine | `core/routeOptimization/routeValidationEngine.ts` | [`route-validation.md`](route-validation.md) — 7 named checks |
| Optimization Engine | `core/routeOptimization/optimizationEngine.ts` | [`optimization-engine.md`](optimization-engine.md) — deterministic greedy reorder, not a fabricated TSP solve |
| Route Health Engine / Explanation Engine | `core/routeOptimization/{routeHealthEngine,routeExplanationEngine}.ts` | [`route-health.md`](route-health.md) — 6 named scores |
| Route Timeline Engine / Risk Engine / Findings Engine | `core/routeOptimization/{routeTimelineEngine,routeRiskEngine,routeFindingsEngine}.ts` | [`route-timeline.md`](route-timeline.md) — 6 named events, 0 live/6 reserved KG relationships, 5 named findings |
| Module layer | `modules/routeOptimization/routeOptimizationActions.ts` | Build, evaluate, optimize, validate, approve, archive, platform health |
| Dashboards | `/route-optimization`, `/route-optimization/[id]` | [`optimization-dashboard.md`](optimization-dashboard.md), [`route-detail.md`](route-detail.md) |

## Reuse, honored exactly as the stop condition requires

- **Dispatch, Execution Package, Operational Planning, Knowledge Graph, Timeline, Executive Decisions** — never duplicated. `resolveEvaluationContext` is the single private helper every read action funnels through to resolve the real Dispatch Order/Assignment/Execution Package a `RoutePlan` was built from — never a second, duplicate resolution. `evaluateRouteEligibility` checks only the Dispatch Assignment's own `queue_state` and the Execution Package's own `status` — which resource was selected for which requirement line was already decided by Allocation/Dispatch, and is never re-derived here.
- **Knowledge Graph** — 0 live edges, 6 reserved (`route_plan`/`route_segment`/`waypoint`/`travel_leg`/`travel_estimate`/`optimization_result`), the same fully-conservative ratio Field Operations established.
- **Timeline** — every real lifecycle transition records through the same `recordTimelineActivity` every checkpoint uses; the pure-read `evaluateRoutePlanAction`/`evaluateRouteOptimizationPlatformHealthAction` emit nothing. `route_created` fires on build — a deliberate, disclosed difference from Field Operations (whose own 7 named events begin only at execution start), since the spec's own Step 8 explicitly names "Route Created" among its 6 events.
- **Executive Decisions** — `routeOptimizationRecommendationsForExecutiveDecisions()` translates `RouteFinding[]` into the existing `OperationalRecommendation` shape and is wired into `executiveDecisionsActions.ts`'s `recommendationSources` array as one more contributor (`generatedBy: "route_optimization_engine"`), additive — confirmed by the full pre-existing Executive Decisions test suite (13/13) still passing unchanged.
- **Permissions** — `route_optimization.view`/`route_optimization.manage` follow the exact narrower-manage/broader-view precedent every module in this codebase uses; wired into `permission.ts`, `permissionMatrix.ts` (manager gets both, staff gets only `view`), and `routeAccess.ts` (`/route-optimization` gated on `route_optimization.view`).
- **No AI, no randomness, no GPS, no external map/traffic provider anywhere.** Every travel figure is a plain declared number — `TravelLeg.declared_distance_km`/`declared_travel_minutes` — never fetched, never fabricated to look measured.

## The "no real geography" design decision, disclosed

No address, coordinate, or GPS field exists on any prior domain type this platform reuses, and the Stop Condition forbids adding one. Rather than invent real geography (which would edge toward mapping), every travel figure is a *declared* input — the same discipline `ExecutionStep.estimated_duration_minutes` already established for work time. `buildRouteStructure` defaults every leg to `0` ("not yet declared") rather than fabricating a realistic-looking distance. This cascades cleanly through Travel Estimation (arithmetic over already-known numbers), the Optimization Engine (a stable sort that correctly does nothing when everything is `0`, and genuinely reorders once real figures are declared), and Route Health (vacuous-good scores until a constraint is actually declared and violated) — every engine is honest about "nothing declared yet" rather than simulating realistic-looking behavior from nothing.

## No bugs this checkpoint's own test suite needed to catch

Every engine — Route Builder, Travel Estimation, Route Validation, Optimization, Route Health, Route Explanation, Route Timeline, Risk, Findings — passed cleanly on first run. One genuine architectural gap was caught and fixed mid-build, before the module layer test suite was written: the Route Builder needs the plan's own id to stamp onto every waypoint/segment/leg's `route_plan_id` field before the plan itself exists in the store. Resolved the same way Dispatch's own `DispatchAssignmentSeed` precedent resolves an analogous ordering problem — the id is generated by the caller (`buildRoutePlanAction`) and threaded through to both the Route Builder and the store's `createRoutePlan`, which was updated to accept a pre-generated id rather than minting its own.

## Known limitations (disclosed, not hidden)

1. **No creation/mutation UI wired.** `RouteOptimizationDashboardView`/`RouteDetailView` cover every read/evaluate surface the spec asked for; `evaluateRoutePlanAction` is the one wired exception, a genuine read. Every mutation action (`buildRoutePlanAction`, `optimizeRoutePlanAction`, `approveRoutePlanAction`, etc.) exists and is fully tested, but no button calls them yet — the same precedent every prior platform's UI in this codebase established.
2. **Every declared travel figure defaults to `0` with no UI to enter real ones yet.** The domain, engines, and store all correctly support real declared distances/times — no code path assumes `0` — but no manual-entry surface exists this checkpoint to declare them. Optimization is therefore a well-defined no-op (`improved: false`) until a future checkpoint wires that entry point.
3. **`estimatedIdleMinutes`/`totalIdleMinutes` are always `0`.** Real idle time needs per-waypoint scheduled time windows, which belongs to Scheduling (27) and is never duplicated here — the field exists and is computed so a future checkpoint can wire real windows in without changing this shape.
4. **No live browser verification.** `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real Supabase Auth credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below plus 8 dedicated component tests (`RouteOptimizationDashboardView.test.tsx`/`RouteDetailView.test.tsx`) exercising the actual rendered UI against mocked module actions, and a successful `next build` of both new routes.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: clean
- `vitest run`: **7227/7227 tests passing** across 800 files (97 new tests across 13 new files for this platform alone: 9 core engine test files, 1 mock store test file, the `routeOptimizationActions.ts` integration suite, and 2 dashboard/detail component test files)
- `next build`: succeeds, including the two new `/route-optimization` and `/route-optimization/[id]` routes

## Success criteria, answered

- **Which route is optimal?** The route plan version with the highest `OptimizationResult.optimizationScore` — `optimizeRoutePlanAction` recomputes this on demand, never live.
- **Which routes violate constraints?** `RouteHealthEngine.computeConstraintHealth` — the Dashboard's "Constraint Violations" section lists every plan below 100.
- **Which assignments have inefficient travel?** `OptimizationResult.travelEfficiency` — the `low_route_efficiency` finding surfaces plans below 60.
- **What is the estimated travel time?** `TravelEstimate.estimatedTravelMinutes` — `TravelEstimationEngine.computeTravelEstimate`, a pure sum of declared leg minutes.
- **What is the optimization score?** `OptimizationResult.optimizationScore` — the average of travel efficiency and resource utilization.
- **Which routes have high delay risk?** `RouteHealthEngine.computeDelayRisk` — the `high_delay_risk` finding surfaces plans above 60.

Stop condition honored throughout: no GPS, no Google/Apple Maps, no Mapbox, no HERE Maps, no traffic providers, no AI, no change to Dispatch or Field Operations state, no rebuilding of Execution Packages, no duplication of Knowledge Graph/Timeline/Executive Decisions/Operational Intelligence/Dispatch/Field Operations. The platform answers every named success-criteria question from data it already owns, never from a live measurement.
