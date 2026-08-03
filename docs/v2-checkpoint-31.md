# v2.0 Checkpoint 31 — Real-Time Operations Center

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Dispatch (28) assigns work, Field Operations (29) executes it, Route Optimization (30) plans travel for it. The Operations Center **observes and coordinates** across all of them, plus Scheduling, Allocation, Execution Package, Workforce, Executive Decisions, Objectives, Business Health, and the Knowledge Graph — it never creates planning decisions, never recalculates capability/schedules/allocations, never rebuilds Execution Packages, never dispatches workers, never changes execution state, never optimizes routes, never tracks GPS, and never sends external notifications. Almost the entire surface is computed fresh on every read; only two genuinely new entities are persisted.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/operationsCenter.ts` | `OperationalSnapshot`/`OperationalStatus`/`OperationalAlert`/`OperationalIncident`/`OperationalFeedItem`/`OperationalKpiSnapshot`/`OperationsCenterHealthScores`/`PriorityQueueItem`/`ResourceOverview`/`OperationalLocationSummary`/`OperationsBrief` |
| Mock stores | `lib/data/mock/{operationalAlertsStore,operationalIncidentsStore}.ts` | The only two persisted entities this checkpoint introduces |
| Cross-Module Aggregation Engine | `core/operationsCenter/crossModuleAggregationEngine.ts` | [`operations-center.md`](operations-center.md) — 4-state source model (`successful`/`failed`/`unavailable`/`stale`) with built-in source-level caching |
| Snapshot / Status Engines | `core/operationsCenter/{operationalSnapshotEngine,operationalStatusEngine}.ts` | [`operational-snapshot.md`](operational-snapshot.md) — 6-state most-severe-wins status |
| Alert Engine / Alert Lifecycle Engine | `core/operationsCenter/{operationalAlertEngine,alertLifecycleEngine}.ts` | [`operational-alerts.md`](operational-alerts.md) — 17 named rules, 6-state lifecycle, dedupe/reconcile/auto-resolve |
| Incident Engine | `core/operationsCenter/incidentEngine.ts` | [`incident-engine.md`](incident-engine.md) — groups 2+ open critical alerts, never duplicates an existing cluster |
| Operations Feed Engine | `core/operationsCenter/operationsFeedEngine.ts` | [`operations-feed.md`](operations-feed.md) — 9 named sources, filter/sort, pinning |
| Operations KPI Engine | `core/operationsCenter/operationsKpiEngine.ts` | [`operations-kpis.md`](operations-kpis.md) — 18 named KPIs |
| Health Composition Engine | `core/operationsCenter/operationsCenterHealthEngine.ts` | [`operations-health.md`](operations-health.md) — 10 reused component scores, unweighted average |
| Priority Queue Engine | `core/operationsCenter/priorityQueueEngine.ts` | [`operations-priority-queue.md`](operations-priority-queue.md) — merges 8 categories, never re-scores Executive Decisions |
| Resource Overview Engine | `core/operationsCenter/resourceOverviewEngine.ts` | [`resource-overview.md`](resource-overview.md) — reuses Workforce's own already-computed figures only |
| Map Placeholder / Communication / Brief Engines | `core/operationsCenter/{operationalMapPlaceholderEngine,communicationIntegrationEngine,operationsBriefEngine}.ts` | List-based location summary (never coordinates), plain digest text, deterministic template Brief |
| Module layer | `modules/operationsCenter/operationsCenterActions.ts` | Evaluate, Brief, Feed, full Alert CRUD, full Incident CRUD |
| Dashboards | `/operations-center`, `/operations-center/alerts/[id]`, `/operations-center/incidents/[id]` | [`operations-center-dashboard.md`](operations-center-dashboard.md) |

## Reuse, honored exactly as the stop condition requires

- **Dispatch, Field Operations, Route Optimization, Scheduling, Allocation, Execution Package, Workforce, Executive Decisions, Objectives, Business Health, Knowledge Graph** — every figure the Operations Center shows is read from these modules' own already-computed outputs (health scores, findings, scorecards, readiness) through 11 `SourceFetcher`s wired in `gatherSourceData`. Nothing is refiltered from raw records when a module's own computed summary already answers the question — worker availability comes from `WorkforceScorecard.availableNow`, never from re-reading `Worker.status`.
- **Executive Decisions** — the Priority Queue reads open critical decisions' own already-assigned priority/status verbatim; the engine's own doc states explicitly that this "does not create a second Executive Decision Engine."
- **Knowledge Graph** — `operational_alert`/`operational_incident` were added as `EntityType` values so the existing generic `CommentsPanel` attaches comments with zero new comment code; no new graph edges, traversal, or health logic were written — `knowledgeHealth` in the Health Composition reads `KnowledgeHealthReport`'s existing issue counts.
- **Timeline** — every real Alert/Incident lifecycle transition (`operational_alert_opened`/`_acknowledged`/`_resolved`/`_dismissed`/`_escalated`, `operational_incident_opened`/`_acknowledged`/`_resolved`) records through the same `recordTimelineActivity` every checkpoint uses; every pure-read evaluation emits nothing.
- **Permissions** — 6 named capabilities (`operations_center.view`/`.manage`, `operations_alerts.acknowledge`/`.resolve`, `operations_incidents.manage`, `operations_sensitive_data.view`) follow the exact narrower-manage/broader-view precedent every module uses; manager gets the first 5, staff gets only `operations_center.view`.
- **No AI, no GPS, no external map/traffic/notification/payment/calendar provider anywhere.** The Brief is plain template-sentence assembly over already-computed data; the Location Summary never returns a coordinate, verified by a dedicated test asserting `JSON.stringify(summary)` never contains a raw latitude/longitude value.

## The storage-split design decision, disclosed

Persisting a computed duplicate of any of these views would itself become the forbidden "second source of truth," so almost everything — Snapshot, Signal detection, Feed, KPIs, Health composition, Priority Queue, Resource Overview, Map Summary, Brief — is computed fresh on every `evaluateOperationsCenterAction()` call, never persisted. The only two genuinely stateful, persisted entities are `OperationalAlert` (a real 6-state lifecycle: open → acknowledged → resolved/dismissed, plus escalated) and `OperationalIncident` (a real 3-state lifecycle that groups alerts) — both of which need to persist because their lifecycle state (who acknowledged what, when) is not derivable from re-reading source modules on the next call.

## The `sourceRecordId` fix, disclosed

Most Operations Center source domains (Dispatch, Field Operations, Route Optimization, Scheduling, Allocation, Execution Package, Executive Decisions, Objectives) have no `KnowledgeNodeType`/`EntityType` of their own, so `sourceRef` (a `KnowledgeNodeType`-keyed reference) would be `null` for nearly every alert. Caught before shipping: this would have collapsed the dedupe key (`ruleId:sourceRef`) and silently merged genuinely distinct alerts about different records into one. Fixed by adding a plain `sourceRecordId: string | null` field to both `OperationalSignal` and `OperationalAlert`, and rewriting the dedupe key to use it first, falling back to `sourceRef` only when no record id exists — without inventing a new `EntityType` for every source domain.

## Known limitations (disclosed, not hidden)

1. **No live authenticated browser verification.** `NEXT_PUBLIC_DATA_MODE=mock` still requires sign-in and this session has no demo credentials; per policy, credentials are never requested in chat. Verified instead through 14 component tests exercising the actual rendered UI (loading/error/empty states, KPI rendering, wired Acknowledge/Resolve/Dismiss/Escalate mutations and their effect on re-rendered state) against mocked module actions, plus a successful `next build` of all three new routes.
2. **`AvailabilitySummary`'s real 9-state breakdown is shimmed to 3 states.** No public Workforce action exposes the full breakdown outside `WorkforceScorecard`; rather than add a new calculation, `gatherSourceData` derives a coarser 3-state version from the Scorecard's own `availableNow`/`onAssignmentNow` figures — disclosed in `docs/resource-overview.md`.
3. **`criticalSinglePointsOfFailure` and Priority Queue `bottlenecks` are always empty.** Both fields are accepted as plain pass-through inputs with the interface ready for a future detector, rather than inventing a new eligibility/bottleneck calculation to fill them now.
4. **Feed pinning is not yet persisted.** `pinnedIds` is accepted as a caller-supplied set; no storage layer remembers pins across requests yet.
5. **`recentImprovements`/`recentRegressions` need a caller-supplied `previousKpis`.** The Operations Center keeps no history of its own, so without a previous snapshot passed to `getOperationsBriefAction`, both arrays stay empty rather than fabricating a trend.

## Quality gates

- `tsc --noEmit -p .`: clean
- `eslint .`: clean (17 pre-existing warnings, entirely unrelated to Operations Center)
- `vitest run`: **820/820 test files, 7379/7379 tests passing** (152 new tests across 14 new engine/store test files, the `operationsCenterActions.ts` integration suite, and 3 new component test files)
- `next build`: succeeds, including the three new `/operations-center`, `/operations-center/alerts/[id]`, `/operations-center/incidents/[id]` routes

## Success criteria, answered

- **What is happening right now?** `OperationalSnapshot` — live counts across every source domain, computed fresh by `computeOperationalSnapshot` on every read.
- **What requires attention first?** The Priority Queue — 8 merged categories sorted by severity, never re-scored.
- **Which operations are blocked?** `snapshot.blockedOperations` plus the Priority Queue's `operation`-type items, sourced from Field Operations' own blocked-state records.
- **Which dispatches are waiting?** `kpis.pendingAcceptances` and the Priority Queue's dispatch-acceptance items, read from Dispatch's own queue state.
- **Which routes are at risk?** `snapshot.highRiskRoutes`/`kpis.highRiskRoutes`, sourced from Route Optimization's own `RouteHealthEngine.computeDelayRisk` findings.
- **Which resources are unavailable?** The Resource Overview — workers/equipment/vehicles, folded from Workforce's own utilization figures.
- **Which incidents are open?** `listOperationalIncidentsAction` filtered to `open`/`acknowledged`, the platform's own persisted incident lifecycle.
- **How healthy is the operation?** `OperationsCenterHealthScores.overallOperationsCenterHealth` — an unweighted average of 10 reused module health scores.
- **What changed recently?** The Operations Feed — 9 named event sources, chronologically or priority-sorted, plus the Brief's `recentImprovements`/`recentRegressions` when a previous KPI snapshot is supplied.

Stop condition honored throughout: no worker dispatching, no Field Operations state changes, no route/schedule/capability/allocation recalculation, no Execution Package rebuilding, no GPS/map/email/payment/calendar/external-realtime providers, no AI-generated facts, no duplication of Timeline/Communication/Executive Decisions/Operational Intelligence/Knowledge Graph/any existing health engine. The Operations Center answers every named question from data it already owns, and never becomes a second source of truth.
