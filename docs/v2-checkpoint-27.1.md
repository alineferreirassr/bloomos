# v2.0 Checkpoint 27.1 — Resource Allocation Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Capability (26.1) determines **WHO** is eligible. Scheduling (27) determines **WHEN** work can happen. Resource Allocation determines **WHICH combination of resources** should perform the work — planning only. Dispatch (a future checkpoint) determines **WHO is actually sent**. Every engine here is a pure, deterministic function over already-computed data — no AI, no randomness, no worker dispatch, no route optimization, no live GPS.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/allocation.ts` | AllocationRequest, Allocation, ResourceBundle, DependencyRule, plus 6 computed-only result shapes — [`allocation-domain.md`](allocation-domain.md) |
| 4 mock stores | `lib/data/mock/{allocationRequests,allocations,resourceBundles,dependencyRules}Store.ts` | See [`allocation-platform.md`](allocation-platform.md)'s module map |
| AllocationEngine | `core/allocation/allocationEngine.ts` | [`allocation-engine.md`](allocation-engine.md) — 7 deterministic strategies |
| Dependency Engine | `core/allocation/dependencyEngine.ts` | [`allocation-dependency-engine.md`](allocation-dependency-engine.md) |
| Fallback Engine | `core/allocation/fallbackEngine.ts` | [`fallback-engine.md`](fallback-engine.md) |
| Bundle Engine | `core/allocation/bundleEngine.ts` | [`bundle-engine.md`](bundle-engine.md) |
| Shared Resource Engine | `core/allocation/sharedResourceEngine.ts` | [`shared-resource-engine.md`](shared-resource-engine.md) |
| Validation / Score / Explanation / Comparison | `core/allocation/{allocationValidationEngine,allocationScoreEngine,allocationExplanationEngine,allocationComparisonEngine}.ts` | [`allocation-scoring.md`](allocation-scoring.md) — 8 named scores, 9 named validation checks |
| ResourcePoolEngine | `core/allocation/resourcePoolEngine.ts` | [`resource-pool.md`](resource-pool.md) |
| AllocationTimelineEngine | `core/allocation/allocationTimelineEngine.ts` | 8 named Timeline events |
| AllocationKnowledgeGraphEngine | `core/allocation/allocationKnowledgeGraphEngine.ts` | 4 live relationships, 2 reserved |
| AllocationRiskEngine / AllocationFindingsEngine | `core/allocation/{allocationRiskEngine,allocationFindingsEngine}.ts` | 8 named findings → Executive Decisions |
| Module layer | `modules/allocation/allocationActions.ts` | Full CRUD + `generateAllocationProposalAction`/`generateAllocationProposalsForComparisonAction`/`reEvaluateAllocationAction`/`evaluateResourceAllocationHealthAction` |
| Dashboards | `/allocations`, `/allocations/requests/[id]`, `/allocations/bundles` | [`allocation-dashboard.md`](allocation-dashboard.md) |

## Reuse, honored exactly as the stop condition requires

- **Capability, Scheduling, Conflict, Capacity, Knowledge Graph, Executive Decisions, Operational Intelligence** — never duplicated. `AllocationEngine` never re-evaluates eligibility, availability, or scheduling itself; every `CandidatePoolEntry` it selects among arrives pre-resolved by `allocationActions.ts`, which calls Checkpoint 26.1's real `evaluateCapabilityRequirementAction` for workers with a `capability_requirement_id`, and Checkpoint 27's real `resolveAvailabilityForInterval`/`checkCapacity` for calendar-time and capacity constraints. Certification dependency checks reuse Checkpoint 26.1's real `evaluateCertificationCapability`. Shared-resource conflict detection deliberately operates on still-proposed candidates, one stage before Checkpoint 27's `ReservationEngine`/`ConflictEngine`, which handle real, persisted `Reservation`s — never the same question re-asked against the same data.
- **Knowledge Graph** — reuses the single existing `RelationshipType` system; `allocated_to`/`depends_on`/`backup_for`/`shares_resource_with` are new *values* in that one closed list, never a second relationship mechanism. `asset`/`custom` resource types have no `KnowledgeNodeType` and correctly produce no edge.
- **Timeline** — every lifecycle transition records through the same `recordTimelineActivity` every checkpoint uses; `reEvaluateAllocationAction` is the only path that emits `allocation_recalculated`, so the read-only comparison and health-check views never spam the log.
- **Executive Decisions** — `allocationRecommendationsForExecutiveDecisions()` translates `AllocationFinding[]` into the existing `OperationalRecommendation` shape and is wired into `executiveDecisionsActions.ts`'s `recommendationSources` array as one more contributor (`generatedBy: "allocation_engine"`), additive — confirmed by the full pre-existing Executive Decisions test suite still passing unchanged.
- **Permissions** — `allocations.view`/`allocations.manage` follow the exact `scheduling.view`/`scheduling.manage` narrower-manage/broader-view precedent, collapsing the spec's 7 named capabilities into 2 permissions.
- **No AI, no randomness anywhere** — every score, strategy ranking, and risk detection is a disclosed formula or deterministic comparison; every strategy tie-breaks on `resource_id` for reproducible results.

## A real bug this checkpoint's own test suite caught before shipping

**`allocationsStore.createAllocation`** originally rejected any allocation with zero `candidates`. That's wrong: a requirement line for an `"asset"`/`"custom"` resource type (no registry exists this checkpoint) or a resource type with literally nothing registered in the workspace legitimately produces zero candidates — and that's exactly the "no resource could be allocated at all" state `AllocationRiskEngine`'s `no_allocation_possible` finding exists to catch. Rejecting it at the store layer made that finding unreachable in practice. Caught by `allocationActions.test.ts`'s own end-to-end asset-line and health-evaluation tests on first run (not by `allocationsStore.test.ts` in isolation, which only exercised the happy path); fixed by removing the guard, and `allocationsStore.test.ts`'s own "rejects an allocation with no candidates" test was rewritten to assert the correct behavior instead.

## Known limitations (disclosed, not hidden)

1. **No creation UI for AllocationRequests/ResourceBundles/DependencyRules, and no button wires `generateAllocationProposalAction`/`approveAllocationAction`/`archiveAllocationAction`.** The same precedent Calendars and Capability Requirements established — entities are created through the module action layer, exercised directly in tests; the dashboards cover every read/evaluate surface the spec asked for. `reEvaluateAllocationAction`/`compareAllocationProposalsAction` are the two exceptions, wired directly because they're genuine reads (re-deriving already-computed data, never re-selecting).
2. **`allocation_candidate`/`allocation_bundle` relationship types and `backup_for` are registered but rarely or never emitted.** `allocation_candidate`/`allocation_bundle` are reserved vocabulary, the same disclosed-gap discipline `blocks`/`occurs_during` established for Scheduling. `backup_for`'s builder is real and tested, but `AllocationEngine` never marks `is_fallback: true` on an initial proposal (nothing is "in use" yet at planning time) — it's a hook for a future re-resolution/escalation flow this checkpoint doesn't build.
3. **`lowest_cost` is an honest no-op**, falling back to `score` as a deterministic secondary key. No cost/rate field exists anywhere in Workforce/Equipment/Vehicle/Vendor — fabricating one would risk scope creep into Finance's real invoicing/vendor-cost logic.
4. **Team/equipment/vehicle/vendor candidates get a flat baseline score (80), not a per-instance capability score.** Checkpoint 26.1 only built worker-ranking machinery (`EligibilityEngine`/`CapabilityScoreEngine`); no equivalent per-instance scoring engine exists for these resource types yet. Eligibility itself is still real (status-based: `equipment.status === "available"`, etc.) — only the *score* is a disclosed placeholder.
5. **Capacity checks are scoped to `workspace`-level `CapacityRule`s only.** Worker/team/resource-scoped capacity rules exist in the type system (reused from Scheduling) but this checkpoint's `buildAllocationCapacityChecks` only evaluates the workspace scope, to keep the usage-window construction tractable; a future pass could extend this to per-resource scopes using the same `CapacityEngine.checkCapacity` primitive.
6. **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: clean
- `vitest run`: **6662/6662 tests passing** across 719 files (171 new tests across 22 new files for this platform alone: 14 core engine test files, 4 mock store test files, the `allocationActions.ts` integration suite, and 3 dashboard component test files)
- `next build`: succeeds, including the three new `/allocations`, `/allocations/requests/[id]`, and `/allocations/bundles` routes

## Success criteria, answered

- **Which combination of resources should perform the work?** `AllocationEngine.buildAllocationProposal` — the single authoritative selection, ranked by one of 7 disclosed, deterministic strategies over an already-known-eligible pool.
- **Can a resource have a co-required dependency (a drone needs a certified operator)?** `DependencyEngine.checkDependencies`, reusing Checkpoint 26.1's real certification evaluation, satisfied only by genuine co-allocation.
- **What happens if the top choice becomes unavailable?** `FallbackEngine.buildFallbackChain`/`resolveActiveResource` — a real primary/backup/second-backup chain, ready for a future Dispatch checkpoint to resolve against.
- **Can a reusable template (e.g. "Photography Crew") generate a request?** `BundleEngine.buildRequirementLinesFromBundle`, wired into `createAllocationRequestAction`.
- **Is a resource double-booked across two allocations?** `SharedResourceEngine.findSharedResourceConflicts` — proposal-stage detection, one step before Scheduling's own real Reservation conflicts.
- **How good is a proposal, and can two proposals be compared?** `AllocationScores` (8 disclosed component scores) via `AllocationScoreEngine`, and `AllocationComparisonEngine.compareAllocations` for side-by-side strategy comparison.
- **What's the state of every resource in play?** `ResourcePoolEngine.buildResourcePoolSnapshot` — available/reserved/busy/unavailable counts, plus shared and single-point-of-failure flags.
- **Can a future Dispatch Platform consume these proposals without reimplementing allocation logic?** Yes — `generateAllocationProposalAction`, `reEvaluateAllocationAction`, and `evaluateResourceAllocationHealthAction` return complete, typed `AllocationResult`/`AllocationFinding[]`/`ResourcePoolSnapshot` a dispatcher can read directly, and every `AllocationCandidate.selected` resource is already the exact slot a future Dispatch checkpoint would confirm and send.

Stop condition honored throughout: no worker dispatch, no resource reservation, no schedule modification, no route optimization, no GPS, no live tracking, no field execution, no AI, no duplicated Capability/Scheduling/Conflict/Capacity/Knowledge Graph/Executive Decisions/Operational Intelligence logic.
