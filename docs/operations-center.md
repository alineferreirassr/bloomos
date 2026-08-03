# Real-Time Operations Center — Architecture

v2.0 Checkpoint 31, the final operational kernel layer of BloomOS. Dispatch, Field Operations, Route Optimization, Scheduling, Allocation, Execution Packages, Workforce, Capability, Executive Decisions, Objectives, Business Health, and Knowledge Health each own their own truth. The Operations Center **observes and coordinates** — it aggregates already-computed facts from every one of those platforms into one read-oriented command surface, and never becomes a second source of truth. It never dispatches a worker, never changes Field Operations state, never recalculates a route/schedule/allocation, never rebuilds an Execution Package, never tracks GPS, and calls no external map/email/payment/calendar/realtime provider. No AI generates any fact it surfaces.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/operationsCenter.ts` | Below |
| Alert store | `lib/data/mock/operationalAlertsStore.ts` | [`operational-alerts.md`](operational-alerts.md) |
| Incident store | `lib/data/mock/operationalIncidentsStore.ts` | [`incident-engine.md`](incident-engine.md) |
| Accessors | `core/operationsCenter/index.ts` | — |
| Cross-Module Aggregation Engine | `core/operationsCenter/crossModuleAggregationEngine.ts` | Below |
| Operational Snapshot Engine | `core/operationsCenter/operationalSnapshotEngine.ts` | [`operational-snapshot.md`](operational-snapshot.md) |
| Operational Status Engine | `core/operationsCenter/operationalStatusEngine.ts` | [`operational-snapshot.md`](operational-snapshot.md) |
| Operational Alert Engine / Alert Lifecycle Engine | `core/operationsCenter/{operationalAlertEngine,alertLifecycleEngine}.ts` | [`operational-alerts.md`](operational-alerts.md) |
| Incident Engine | `core/operationsCenter/incidentEngine.ts` | [`incident-engine.md`](incident-engine.md) |
| Operations Feed Engine | `core/operationsCenter/operationsFeedEngine.ts` | [`operations-feed.md`](operations-feed.md) |
| Operations KPI Engine | `core/operationsCenter/operationsKpiEngine.ts` | [`operations-kpis.md`](operations-kpis.md) |
| Operations Center Health Engine | `core/operationsCenter/operationsCenterHealthEngine.ts` | [`operations-health.md`](operations-health.md) |
| Priority Queue Engine / Resource Overview Engine | `core/operationsCenter/{priorityQueueEngine,resourceOverviewEngine}.ts` | [`operations-priority-queue.md`](operations-priority-queue.md), [`resource-overview.md`](resource-overview.md) |
| Map Placeholder / Communication Integration | `core/operationsCenter/{operationalMapPlaceholderEngine,communicationIntegrationEngine}.ts` | Below |
| Operations Brief Engine | `core/operationsCenter/operationsBriefEngine.ts` | [`operations-brief.md`](operations-brief.md) |
| Module layer | `modules/operationsCenter/operationsCenterActions.ts` | Below |
| Dashboards | `/operations-center`, `/operations-center/alerts/[id]`, `/operations-center/incidents/[id]` | [`operations-center-dashboard.md`](operations-center-dashboard.md) |

## Storage split — the single most important design decision this checkpoint made

Almost everything the Operations Center surfaces is **computed fresh on every read**: the Snapshot, Signal, Feed, KPIs, Health composition, Priority Queue, Resource Overview, Map Summary, and Brief. None of these are persisted anywhere — persisting a duplicate of data another module already owns would itself be the forbidden "second source of truth."

Exactly two genuinely new, stateful entities exist, each with its own lifecycle: `OperationalAlert` (6-state lifecycle: open/acknowledged/resolved/dismissed/escalated/expired) and `OperationalIncident` (3-state lifecycle: open/acknowledged/resolved, groups alerts). These are the only rows this checkpoint's own store ever writes.

## Cross-Module Aggregation Engine — the reusable core

`crossModuleAggregationEngine.ts` never imports a single other module's action or store directly — it only orchestrates whatever `SourceFetcher<T>`s the caller (`operationsCenterActions.ts`) constructs by wrapping real public actions (`evaluateDispatchPlatformHealthAction`, `evaluateWorkspaceSchedulingAction`, `evaluateWorkforceAction`, etc.). Each source resolves to one of four states — `successful`/`failed`/`unavailable`/`stale` — with `stale` meaning a previously-successful cached value is served when the latest fetch fails, so one failing source never blanks the whole Operations Center. `computeSnapshotConfidence` scores the aggregate 0-100 (`successful` = 1, `stale` = 0.5, everything else = 0; vacuous-100 with zero sources), and this same cache doubles as Step 27's own "Source-Level Caching" requirement — one mechanism satisfying both.

## Severity vocabulary reuse — `OperationalSeverity = DecisionPriority`

Rather than invent a new severity scale, `OperationalSeverity` is a direct alias of Executive Decisions' own `DecisionPriority` (`critical`/`high`/`medium`/`low`/`informational`). Operations Center sits at the same executive altitude as Executive Decisions and both name "Critical Alerts"/"Critical Executive Decision" throughout their own specs.

## Exact source record references, without new entity types

Most Operations Center source domains (Dispatch, Field Operations, Route Optimization, Scheduling, Allocation, Execution Package, Executive Decisions, Objectives) have no `EntityType`/`KnowledgeNodeType` of their own yet — the same "0 live Knowledge Graph relationships" limitation Route Optimization's own checkpoint disclosed. Rather than force an incorrect `KnowledgeNodeRef`, `OperationalSignal`/`OperationalAlert` carry a plain, type-unconstrained `sourceRecordId: string | null` alongside `sourceRef` — this is what actually satisfies "each alert references the exact source record," and what the Alert store's own dedupe key is keyed on so two different records tripping the same rule never collapse into one alert.

## Module layer — `operationsCenterActions.ts`

- **`evaluateOperationsCenterAction`** — the single big orchestrator every dashboard reads from. Fetches every dependency once through `gatherSourceData`, builds the Snapshot and Status, detects Signals and reconciles them against the Alert store, auto-creates Incidents from clusters of open critical Alerts (only when no existing open Incident already covers the exact same alert set), then computes the KPIs, Health composition, Priority Queue, Resource Overview, Map Summary, and Digest — all from that one fetch.
- **`getOperationsBriefAction`** — re-runs the same evaluation and feeds its result through `computeOperationsBrief`; accepts an optional previous KPI snapshot to diff against for improvements/regressions.
- **`getOperationalFeedAction`** — builds the unified Feed from the live Alert/Incident stores plus recent workspace Timeline activity, with category/date/pinned filtering and chronological/priority sorting.
- **`acknowledgeAlertAction`/`resolveAlertAction`/`dismissAlertAction`/`escalateAlertAction`**, **`setIncidentStatusAction`** — the only mutation surfaces. Each only ever changes the Alert/Incident's own record and records a matching named Timeline event; none touch a source module.

Same minimal session-gate discipline every prior checkpoint's module layer uses — every action only checks `session.kind !== "active"`; the six new Operations Center permissions exist in `permissionMatrix.ts` for future UI-level gating, never checked inline.

## Permissions

`operations_center.view`/`.manage`, `operations_alerts.acknowledge`/`.resolve`, `operations_incidents.manage`, `operations_sensitive_data.view` — the spec names all six directly. `manager` gets everything except `operations_sensitive_data.view`; `staff` gets only `operations_center.view` — matching `workforce.sensitive_data.view`'s own owner/admin-only precedent, since exact worker locations are the one field this checkpoint's own Privacy section explicitly protects.

## Known disclosed gaps

1. **No creation/mutation UI for Incidents beyond status transitions.** Incidents are auto-created from clustered critical alerts by `evaluateOperationsCenterAction` itself; there is no manual "create incident" control, consistent with "do not create an external incident-management platform."
2. **`Pin` persistence for Feed items is not wired.** `buildOperationalFeed` accepts a `pinnedIds: Set<string>` and correctly marks matching items, but no store persists which ids are pinned yet — the Dashboard passes an empty set.
3. **No live browser verification.** The dev environment requires a real sign-in this session has no credentials for; per policy, credentials are never requested in chat. Verified instead through the full quality-gate suite, dedicated component tests exercising the actual rendered UI against mocked module actions, and a successful `next build` of all three new routes.
