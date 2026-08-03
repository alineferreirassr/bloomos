# v2.0 Checkpoint 28 — Dispatch Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Execution Package (27.3) determines EVERYTHING required to perform planned work — a single, immutable, frozen bundle. Dispatch consumes an **approved, ready** Execution Package and creates Dispatch Orders — it **assigns** work, it never **executes** work. Every engine here is a pure, deterministic function over already-frozen data — no AI, no randomness, no live execution, no GPS, no route optimization, no evidence capture, no recalculation of Capability/Scheduling/Allocation, no rebuilding of Operational Plans/Execution Packages.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/dispatch.ts` | `DispatchOrder`/`DispatchAssignment`/`DispatchAttempt`/`DispatchBatch` + 6 computed-only result shapes — see [`dispatch.md`](dispatch.md) |
| Mock stores | `lib/data/mock/{dispatchOrdersStore,dispatchBatchesStore}.ts` | One aggregate document per order; `transitionAssignment` is the single function every queue transition goes through |
| Dispatch Builder | `core/dispatch/dispatchBuilderEngine.ts` | [`dispatch-builder.md`](dispatch-builder.md) — the one eligibility gate |
| Assignment Engine | `core/dispatch/assignmentEngine.ts` | [`dispatch-assignment-engine.md`](dispatch-assignment-engine.md) — carries forward frozen selections, no recalculation |
| Dispatch Validation Engine | `core/dispatch/dispatchValidationEngine.ts` | [`dispatch-validation.md`](dispatch-validation.md) — 7 named checks |
| Dispatch Queue Engine / Acceptance Engine | `core/dispatch/{dispatchQueueEngine,acceptanceEngine}.ts` | [`dispatch-queue.md`](dispatch-queue.md) — 8 named queue states, Accept/Decline/Timeout |
| Dispatch Health Engine / Explanation Engine | `core/dispatch/{dispatchHealthEngine,dispatchExplanationEngine}.ts` | [`dispatch-health.md`](dispatch-health.md) — 7 named scores |
| Dispatch Timeline Engine / Knowledge Graph Engine | `core/dispatch/{dispatchTimelineEngine,dispatchKnowledgeGraphEngine}.ts` | [`dispatch-timeline-and-knowledge-graph.md`](dispatch-timeline-and-knowledge-graph.md) — 7 named events, 3 live/4 reserved relationships |
| Dispatch Risk Engine / Findings Engine | `core/dispatch/{dispatchRiskEngine,dispatchFindingsEngine}.ts` | [`dispatch-executive-integration.md`](dispatch-executive-integration.md) — 6 named findings → Executive Decisions |
| Module layer | `modules/dispatch/dispatchActions.ts` | Full lifecycle: build, evaluate, assign/present/accept/decline/timeout, cancel/archive order, batches, platform health |
| Dashboards | `/dispatch`, `/dispatch/[id]` | [`dispatch.md`](dispatch.md), [`dispatch-detail.md`](dispatch-detail.md) |

## Reuse, honored exactly as the stop condition requires

- **Capability, Scheduling, Allocation, Operational Planning, Execution Package, Knowledge Graph, Executive Decisions** — never duplicated. `buildDispatchAssignments` carries forward exactly the `selected: true` entries from the frozen `ExecutionSnapshot.allocation_candidates` — never re-scoring or re-selecting a candidate. `evaluateDispatchEligibility` checks only the Execution Package's own `status`/`readiness.state` — Allocation/Schedule/Operational Plan approval were already vetted the moment the package itself became approved.
- **Knowledge Graph** — reuses the single existing `RelationshipType` system. `dispatch_order`/`dispatch_assignment`/`dispatch_batch`/`dispatch_queue` are registered as reserved vocabulary and never emitted. `assigned_worker`/`assigned_vehicle`/`assigned_equipment` **are** live — the first genuinely new live edges since Operational Planning's `produces_deliverable`, since Worker/Vehicle/Equipment are real `KnowledgeNodeType`s per the existing `RESOURCE_TYPE_TO_NODE_TYPE` mapping. Team/Vendor assignments deliberately get no edge — the spec's own named relationship list only includes worker/vehicle/equipment.
- **Timeline** — every real lifecycle transition records through the same `recordTimelineActivity` every checkpoint uses; the pure-read `evaluateDispatchOrderAction`/`evaluateDispatchPlatformHealthAction` emit nothing, so viewing an order or the dashboard never spams the log. A real naming collision (`"assignment_created"`, already claimed by Checkpoint 26's Workforce Assignment Engine) was caught and fixed by renaming Dispatch's own event to `"dispatch_assignment_created"`.
- **Executive Decisions** — `dispatchRecommendationsForExecutiveDecisions()` translates `DispatchFinding[]` into the existing `OperationalRecommendation` shape and is wired into `executiveDecisionsActions.ts`'s `recommendationSources` array as one more contributor (`generatedBy: "dispatch_engine"`), additive — confirmed by the full pre-existing Executive Decisions test suite still passing unchanged. This checkpoint's own task list carried an explicit self-reminder to wire this — the exact step Checkpoint 27.3 forgot on its first pass.
- **Permissions** — `dispatch.view`/`dispatch.manage` follow the exact narrower-manage/broader-view precedent every module in this codebase uses, collapsing the spec's 6 named capabilities into 2 permissions.
- **No AI, no randomness, no live execution anywhere.** `completed_placeholder` (one of the spec's own 8 named queue states) is reserved vocabulary no code path in this checkpoint ever reaches — the Stop Condition forbids executing work. `evaluateReassignmentPlaceholder()` is an honest, disclosed no-op — reassignment would mean re-selecting a candidate, Resource Allocation's job, not Dispatch's.

## No bugs this checkpoint's own test suite needed to catch

Every engine — Builder, Assignment, Validation, Queue, Acceptance, Health, Explanation, Timeline, Knowledge Graph, Risk, Findings — passed cleanly on first run, apart from two disclosed fixture-level fixes (a decline-reason engine test's trailing-period mismatch; the Timeline event rename after the naming collision was caught). The one genuine module-layer gap caught mid-build — assignments start `queued`, and `queued → accepted` isn't a legal transition, so `dispatchActions.ts` initially had no exported action to advance an assignment through `assigned`/`pending` — was fixed by adding `assignDispatchAssignmentAction`/`presentDispatchAssignmentAction` before the integration test suite was written, not after a test failure; the module-layer integration tests (17 tests seeding real Workers, Operational Plans, Allocations, Appointments, and Execution Packages through their own real mock stores) passed cleanly once those two actions existed.

## Known limitations (disclosed, not hidden)

1. **Reassignment is an explicitly named Placeholder, and stays one.** `evaluateReassignmentPlaceholder()` returns `{ supported: false, reason }` — no code path creates a fresh attempt for a declined/expired assignment against a different resource. Disclosed in [`dispatch-queue.md`](dispatch-queue.md).
2. **`completed_placeholder` is permanently unreachable this checkpoint.** One of the spec's own 8 named queue states, reserved for a future Field Operations "job done" signal — the Stop Condition forbids executing work, so no transition in `LEGAL_TRANSITIONS` ever points to it.
3. **No creation/mutation UI wired.** `DispatchDashboardView`/`DispatchDetailView` cover every read/evaluate surface the spec asked for; `evaluateDispatchOrderAction` is the one wired exception, a genuine read. Every mutation action (`buildDispatchOrderAction`, `acceptDispatchAssignmentAction`, `cancelDispatchOrderAction`, etc.) exists and is fully tested, but no button calls them yet — the same precedent every prior platform's UI in this codebase established.
4. **Vendor status resolution loads the full vendor list per evaluation.** `buildResourceStatusByKey` calls `getVendors()` (no filter) and looks up by id in-memory, rather than a dedicated `getVendorById` per assignment — chosen to avoid `getVendorById`'s throw-on-not-found behavior; acceptable at this checkpoint's scale, disclosed rather than silently accepted.
5. **No live browser verification.** `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below plus 7 dedicated component tests (`DispatchDashboardView.test.tsx`/`DispatchDetailView.test.tsx`) exercising the actual rendered UI against mocked module actions.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: clean (0 errors; 17 pre-existing warnings, all unrelated to this platform)
- `vitest run`: **7001/7001 tests passing** across 773 files (106 new tests across 16 new files for this platform alone: 11 core engine test files, 2 mock store test files, the `dispatchActions.ts` integration suite, and 2 dashboard/detail component test files)
- `next build`: succeeds, including the two new `/dispatch` and `/dispatch/[id]` routes

## Success criteria, answered

- **Can Dispatch consume an approved Execution Package without recalculating planning?** Yes — `buildDispatchOrderAction` gates on `evaluateDispatchEligibility` (approved + ready) and `buildDispatchAssignments` carries forward exactly the frozen, already-selected candidates — no re-scoring, no re-evaluation.
- **What is the state of every assignment right now?** `DispatchAssignment.queue_state` — one of 8 named states, precedence-ordered (`queued → assigned → pending → {accepted|declined|expired}`, `cancelled` from any non-terminal state), backed by an atomic attempt log via `DispatchAssignment.attempts`.
- **Can an assignment legally transition to this next state?** `DispatchQueueEngine.isLegalQueueTransition` — the single state machine every mutation in this checkpoint goes through, never a duplicate.
- **Is this dispatch order valid to dispatch right now?** `DispatchValidationEngine.validateDispatch` — 7 named checks over live resource status and schedule activity, surfaced through `DispatchExplanationEngine`'s readable prose.
- **How healthy is this order, and the platform overall?** `DispatchHealthEngine.computeDispatchHealthScores` — 7 named scores per order; `evaluateDispatchPlatformHealthAction` aggregates across every order in the workspace.
- **What needs executive attention?** `DispatchRiskEngine.detectDispatchRisks` — 6 named findings, translated into `OperationalRecommendation`s and fed into Executive Decisions alongside every prior checkpoint's own contributor.
- **Which real Worker/Vehicle/Equipment is this order actually touching?** `assigned_worker`/`assigned_vehicle`/`assigned_equipment` Knowledge Graph edges — the first genuinely new live relationships since Operational Planning.

Stop condition honored throughout: no work execution, no GPS capture, no live tracking, no route optimization, no evidence collection, no AI, no recalculation of Capability/Scheduling/Allocation, no rebuilding of Operational Plans/Execution Packages, no duplication of Knowledge Graph/Executive Decisions/Operational Intelligence/Timeline.
