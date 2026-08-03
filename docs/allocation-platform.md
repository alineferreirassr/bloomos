# Resource Allocation Platform — Architecture

v2.0 Checkpoint 27.1. Capability (26.1) determines **WHO** is eligible. Scheduling (27) determines **WHEN** work can happen. Resource Allocation determines **WHICH combination of resources** should perform the work — planning only. Dispatch (a future checkpoint) determines **WHO is actually sent**. Every engine here is a pure, deterministic function — no AI, no randomness, no worker dispatch, no route optimization, no live GPS.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/allocation.ts` | [`allocation-domain.md`](allocation-domain.md) |
| 4 mock stores | `lib/data/mock/{allocationRequests,allocations,resourceBundles,dependencyRules}Store.ts` | — |
| Accessors | `core/allocation/index.ts` | — |
| AllocationEngine | `core/allocation/allocationEngine.ts` | [`allocation-engine.md`](allocation-engine.md) |
| Dependency Engine | `core/allocation/dependencyEngine.ts` | [`allocation-dependency-engine.md`](allocation-dependency-engine.md) |
| Fallback Engine | `core/allocation/fallbackEngine.ts` | [`fallback-engine.md`](fallback-engine.md) |
| Bundle Engine | `core/allocation/bundleEngine.ts` | [`bundle-engine.md`](bundle-engine.md) |
| Shared Resource Engine | `core/allocation/sharedResourceEngine.ts` | [`shared-resource-engine.md`](shared-resource-engine.md) |
| Validation / Score / Explanation / Comparison | `core/allocation/{allocationValidationEngine,allocationScoreEngine,allocationExplanationEngine,allocationComparisonEngine}.ts` | [`allocation-scoring.md`](allocation-scoring.md) |
| Resource Pool Engine | `core/allocation/resourcePoolEngine.ts` | [`resource-pool.md`](resource-pool.md) |
| Allocation Timeline Engine | `core/allocation/allocationTimelineEngine.ts` | Below |
| Allocation Knowledge Graph Engine | `core/allocation/allocationKnowledgeGraphEngine.ts` | Below |
| Allocation Risk Engine / Findings Engine | `core/allocation/{allocationRiskEngine,allocationFindingsEngine}.ts` | Below |
| Module layer | `modules/allocation/allocationActions.ts` | Below |
| Dashboards | `/allocations`, `/allocations/requests/[id]`, `/allocations/bundles` | [`allocation-dashboard.md`](allocation-dashboard.md) |

## Allocation Timeline Engine — the 8 named events

`allocation_created/updated/recalculated/fallback_used/dependency_failed/bundle_completed/approved/archived`. Pure `{ type, description }` builders; `allocationActions.ts` calls them only on a real transition, never on every read. `reEvaluateAllocationAction` (a genuine "recalculate on demand" action) is the only path that emits `allocation_recalculated`; the read-only `compareAllocationProposalsAction`/`evaluateResourceAllocationHealthAction` re-derive the same scores via a shared internal helper without emitting anything, so viewing a comparison or the dashboard never spams the Timeline.

`allocation_updated` is registered but not currently emitted — no code path in this checkpoint mutates an existing allocation's candidates in place (`updateAllocationCandidates` exists on the store but has no module-layer caller yet); reserved for a future edit flow.

## Allocation Knowledge Graph Engine — 4 live relationships, 2 reserved

`allocated_to` (a selected candidate resource → the request's own context node), `depends_on` (a subject resource → the co-allocated resource satisfying its dependency), `backup_for` (a fallback resource → the primary it stands in for), `shares_resource_with` (two requests' context nodes allocated the same resource, ordered deterministically by node key, never by time). All real, persisted via `allocationActions.ts`'s `syncAllocationKnowledgeGraph`. `allocation_candidate` and `allocation_bundle` are registered in `RelationshipType` but never emitted — the same reserved-vocabulary discipline `blocks`/`occurs_during` established for Scheduling. `backup_for` never fires in practice this checkpoint (see `fallback-engine.md` — `is_fallback` stays `false` on every initial proposal); the builder exists and is tested, ready for the future flow that would set it.

## Allocation Risk Engine / Findings Engine — Executive Integration

`detectAllocationRisks()` runs 8 named, deterministic detectors (Insufficient Resources, Critical Dependency, Bundle Incomplete, Resource Bottleneck, Shared Resource Conflict, Fallback Activated, No Allocation Possible, Resource Shortage) over already-computed data — every detector calls into an engine this checkpoint already built, never a new evaluation. `allocationFindingsToRecommendations()` translates the result into the Executive Decision Platform's existing `OperationalRecommendation` shape — the same "translate, don't duplicate" discipline `schedulingFindingsEngine.ts`/`capabilityFindingsEngine.ts` established. Wired into `executiveDecisionsActions.ts`'s `recommendationSources` as one more contributor (`generatedBy: "allocation_engine"`), additive — a workspace with no allocation requests contributes zero findings.

## Module layer — `allocationActions.ts`

Full CRUD for `ResourceBundle`/`DependencyRule`/`AllocationRequest`/`Allocation`, plus the orchestration every UI surface reads from:

- **`generateAllocationProposalAction(requestId, strategy)`** — builds a `CandidatePoolEntry[]` pool per requirement line (workers via Checkpoint 26.1's real `evaluateCapabilityRequirementAction` when a `capability_requirement_id` is set, or a baseline active-worker pool when not; team/equipment/vehicle/vendor via simple status checks; asset/custom get an honest empty pool), calls `buildAllocationProposal`, persists the result, scores/validates/explains it, and syncs Timeline + Knowledge Graph.
- **`generateAllocationProposalsForComparisonAction(requestId, strategies[])`** — one proposal per strategy sharing a `group_id`, each independently evaluated against the same pre-batch resource state (the fair baseline for comparing alternatives, not a sequential race).
- **`reEvaluateAllocationAction(allocationId)`** / **`compareAllocationProposalsAction(groupId)`** — re-derive scores/validation/explanation from an already-persisted `candidates` array, never re-selecting; only the former emits `allocation_recalculated`.
- **`approveAllocationAction` / `archiveAllocationAction`** — thin status-transition wrappers, each recording its named Timeline event.
- **`evaluateResourceAllocationHealthAction()`** — the Allocation Dashboard's and Executive Decisions' shared data source: re-derives validation/dependency/bundle/shared-conflict state for every active allocation, then runs `detectAllocationRisks` and `buildResourcePoolSnapshot`.

Same minimal session-gate discipline `workforceActions.ts`/`capabilityActions.ts`/`schedulingActions.ts` use — every action only checks `session.kind !== "active"`, no additional inline permission checks; `allocations.manage` exists in `permissionMatrix.ts` for future UI-level gating.
