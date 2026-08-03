# Dispatch Platform — Architecture

v2.0 Checkpoint 28. Execution Package (27.3) determines EVERYTHING required to perform planned work — a single, immutable, frozen bundle. Dispatch consumes an **approved, ready** Execution Package and creates Dispatch Orders — it **assigns** work, it never **executes** work. Every engine here is a pure, deterministic function over already-frozen data — no AI, no randomness, no live execution, no GPS, no route optimization, no evidence capture, no recalculation of Capability/Scheduling/Allocation, no rebuilding of Operational Plans/Execution Packages.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/dispatch.ts` | Below |
| Mock stores | `lib/data/mock/{dispatchOrdersStore,dispatchBatchesStore}.ts` | — |
| Accessors | `core/dispatch/index.ts` | — |
| Dispatch Builder | `core/dispatch/dispatchBuilderEngine.ts` | [`dispatch-builder.md`](dispatch-builder.md) |
| Assignment Engine | `core/dispatch/assignmentEngine.ts` | [`dispatch-assignment-engine.md`](dispatch-assignment-engine.md) |
| Dispatch Validation Engine | `core/dispatch/dispatchValidationEngine.ts` | [`dispatch-validation.md`](dispatch-validation.md) |
| Dispatch Queue Engine / Acceptance Engine | `core/dispatch/{dispatchQueueEngine,acceptanceEngine}.ts` | [`dispatch-queue.md`](dispatch-queue.md) |
| Dispatch Health Engine / Explanation Engine | `core/dispatch/{dispatchHealthEngine,dispatchExplanationEngine}.ts` | [`dispatch-health.md`](dispatch-health.md) |
| Dispatch Timeline Engine / Knowledge Graph Engine | `core/dispatch/{dispatchTimelineEngine,dispatchKnowledgeGraphEngine}.ts` | [`dispatch-timeline-and-knowledge-graph.md`](dispatch-timeline-and-knowledge-graph.md) |
| Dispatch Risk Engine / Findings Engine | `core/dispatch/{dispatchRiskEngine,dispatchFindingsEngine}.ts` | [`dispatch-executive-integration.md`](dispatch-executive-integration.md) |
| Module layer | `modules/dispatch/dispatchActions.ts` | Below |
| Dashboards | `/dispatch`, `/dispatch/[id]` | Below, [`dispatch-detail.md`](dispatch-detail.md) |

## Domain shape — one aggregate document per order

A `DispatchOrder` (`status`/`priority`/`source`/`execution_package_id`/`execution_version_id`) carries its `assignments: DispatchAssignment[]` inline — each assignment carries its own `attempts: DispatchAttempt[]` history — the same "whole graph as one document" precedent `OperationalPlan`/`ExecutionPackage` established before it. `execution_version_id` pins the exact immutable `ExecutionVersion` consumed, so "which snapshot was dispatched" never needs re-deriving. Every `DispatchAttempt` is appended by the single store function `transitionAssignment`, so the attempt log and the assignment's current `queue_state` can never drift apart.

## Route naming — `/dispatch`

No naming collision existed for this prefix, any of the 10 named doc filenames, or the `dispatch` navigation entry — confirmed by research before implementation began. `assignment-engine.md` was already taken by Checkpoint 26's Workforce Assignment Engine, so this platform's own doc is named `dispatch-assignment-engine.md` instead.

## Dispatch Queue — the real precedence

The spec's 8 named states (`queued`/`pending`/`assigned`/`accepted`/`declined`/`cancelled`/`expired`/`completed_placeholder`) resolve to a real precedence: `queued` (created) → `assigned` (locked to its resource) → `pending` (presented, awaiting a response) → one of `accepted`/`declined`/`expired` (terminal). `cancelled` is reachable from any non-terminal state. `completed_placeholder` is reserved vocabulary for a future Field Operations "job done" signal — the Stop Condition forbids executing work, so no code path in this checkpoint ever reaches it.

## Module layer — `dispatchActions.ts`

- **`buildDispatchOrderAction`** — resolves the named `ExecutionPackage`, gates on `evaluateDispatchEligibility` (approved + ready), carries forward exactly the `selected: true` candidates from the frozen `ExecutionSnapshot.allocation_candidates` via `buildDispatchAssignments`, and persists the order with every assignment starting `"queued"`.
- **`evaluateDispatchOrderAction`** — resolves live Worker/Team/Equipment/Vehicle/Vendor status and live Appointment activity, then composes `DispatchValidationEngine` + `DispatchHealthEngine` + `DispatchExplanationEngine` into one `DispatchOrderResult`, a pure read.
- **`assignDispatchAssignmentAction`/`presentDispatchAssignmentAction`** — advance `queued → assigned → pending`, the queue-progression half of dispatching (no Accept/Decline semantics, just a legal-transition check).
- **`acceptDispatchAssignmentAction`/`declineDispatchAssignmentAction`/`timeoutDispatchAssignmentAction`** — the Acceptance Engine's three named decisions, each validated against `DispatchQueueEngine.isLegalQueueTransition`.
- **`cancelDispatchOrderAction`/`archiveDispatchOrderAction`** — order-level status transitions, records `dispatch_cancelled`/`dispatch_archived`.
- **`createDispatchBatchAction`/`listDispatchBatchesAction`** — the Dispatch Batch grouping named in Step 1.
- **`evaluateDispatchPlatformHealthAction`** — the Dashboard's and Executive Decisions' shared data source: re-evaluates every order in the workspace, then runs `detectDispatchRisks`.

Same minimal session-gate discipline every prior checkpoint's module layer uses — every action only checks `session.kind !== "active"`, no additional inline permission checks; `dispatch.manage` exists in `permissionMatrix.ts` for future UI-level gating.

## Permissions

`dispatch.view`/`dispatch.manage` collapse the spec's 6 named capabilities into 2 permissions, following the narrower-manage/broader-view precedent every other module in this codebase uses. `manager` gets both; `staff` gets only `view`.

## Known disclosed gap — the Dashboard/Detail UI is read-only

Every mutation action (`buildDispatchOrderAction`, `assignDispatchAssignmentAction`, `acceptDispatchAssignmentAction`, etc.) exists and is fully tested, but no button in `DispatchDashboardView`/`DispatchDetailView` calls them yet — the same "no create/mutate control wired" scope every prior platform dashboard in this codebase discloses. `evaluateDispatchOrderAction` is the one wired exception, a genuine read.
