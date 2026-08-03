# Route Timeline Engine / Knowledge Graph Integration / Executive Integration

`src/core/routeOptimization/{routeTimelineEngine,routeRiskEngine,routeFindingsEngine}.ts` — v2.0 Checkpoint 30, Steps 8-10.

## Route Timeline Engine — the spec's 6 named events

```ts
routeCreatedEvent(): RouteTimelineEvent
routeOptimizedEvent(score: number): RouteTimelineEvent
routeValidatedEvent(): RouteTimelineEvent
routeApprovedEvent(): RouteTimelineEvent
routeArchivedEvent(): RouteTimelineEvent
optimizationRecalculatedEvent(score: number): RouteTimelineEvent
```

Each is a pure builder — `{ type, description }` — mirroring `executionTimelineEngine.ts`'s shape exactly. `routeOptimizationActions.ts` calls one of these only on a real transition, never on every read/re-evaluation — the same "avoid Timeline noise" discipline every prior checkpoint's Timeline integration follows.

`route_created` fires on build — a deliberate, disclosed difference from Field Operations (which emits nothing on build): the spec's own Step 8 explicitly names "Route Created" among its 6 events, unlike Field Operations' own 7 named events which begin only at "Execution Started."

`route_optimized` fires the first time a plan is ever optimized; `optimization_recalculated` fires every time after — determined by whether any prior version already carried a non-`null` `optimization_result`.

## Knowledge Graph Integration — 0 live, 6 reserved

```ts
"route_plan", "route_segment", "waypoint", "travel_leg", "travel_estimate", "optimization_result"
```

Registered in `types/knowledgeGraph.ts`'s `RELATIONSHIP_TYPES`/`RELATIONSHIP_TYPE_LABELS`, alongside every other checkpoint's own reserved vocabulary — the single existing `RelationshipType` system, never a second graph. All 6 are reserved, none are emitted this checkpoint — the same fully-conservative ratio Field Operations established.

**Why zero live edges.** A `route_plan`/`route_segment`/`waypoint`/`travel_leg` is a plain record with no real-world node identity of its own — a waypoint has no address, a travel leg no measured distance, only declared numbers on plain records, the same discipline `DispatchAssignment`/`ExecutionAttempt` held to before them. `travel_estimate`/`optimization_result` are computed-only bundles — never stored, exactly like `execution_result`/`DispatchOrderResult`. Route Optimization "calculates and manages routes" over Dispatch's own already-assigned Worker/Vehicle/Equipment — it introduces no new resource reference of its own, so no live edge exists to build.

## Executive Integration — 5 named findings

```ts
detectRouteRisks(inputs: RouteRiskInput[]): RouteFinding[]
```

| Finding | Severity | Condition |
|---|---|---|
| `low_route_efficiency` | medium | An optimization result exists and `travelEfficiency < 60` |
| `high_delay_risk` | high | `health.delayRisk > 60` |
| `travel_constraint` | medium | `health.constraintHealth < 100` — one or more declared constraints currently violated |
| `optimization_opportunity` | low | The route has never been optimized (`optimization === null`) |
| `healthy_route` | low | `validation.valid` + `overallRouteHealth >= 80` |

```ts
routeFindingsToRecommendations(findings, routePlans, workspaceId): OperationalRecommendation[]
```

Mirrors `fieldOperationFindingsEngine.ts`/`dispatchFindingsEngine.ts` exactly: severity map `high → critical` / `medium → warning` / `low → info`, `ruleId` prefixed `"route_optimization.${finding.type}"`, node resolution falls back to the route plan's own `context` then the workspace. Wired into `executiveDecisionsActions.ts`'s `recommendationSources` array (`generatedBy: "route_optimization_engine"`) — additive, confirmed by the full pre-existing Executive Decisions test suite (13/13) still passing unchanged.
