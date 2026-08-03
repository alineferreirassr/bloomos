# Field Operations Platform — Architecture

v2.0 Checkpoint 29. Dispatch (28) **assigns** work — it never executes it. Field Operations manages and tracks **EXECUTION STATE ONLY**: no GPS, no maps, no live tracking, no route optimization, no evidence capture, no media upload, no AI, no recalculation of Dispatch, no rebuilding of Execution Packages, no duplication of Knowledge Graph/Timeline/Executive Decisions/Operational Intelligence/Scheduling/Allocation/Operational Planning/Dispatch. Every engine here is a pure, deterministic function — no randomness, no live clock reads inside an engine itself.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/fieldOperations.ts` | Below |
| Mock store | `lib/data/mock/fieldOperationsStore.ts` | — |
| Accessors | `core/fieldOperations/index.ts` | — |
| Field Operation Engine / Session Engine | `core/fieldOperations/{fieldOperationEngine,executionSessionEngine}.ts` | [`execution-lifecycle.md`](execution-lifecycle.md), [`execution-session.md`](execution-session.md) |
| Execution Validation Engine | `core/fieldOperations/executionValidationEngine.ts` | [`execution-validation.md`](execution-validation.md) |
| Execution State Engine | `core/fieldOperations/executionStateEngine.ts` | [`execution-session.md`](execution-session.md) |
| Execution Health Engine / Explanation Engine | `core/fieldOperations/{executionHealthEngine,executionExplanationEngine}.ts` | [`execution-health.md`](execution-health.md) |
| Operational Progress Engine | `core/fieldOperations/operationalProgressEngine.ts` | [`execution-progress.md`](execution-progress.md) |
| Execution Timeline Engine | `core/fieldOperations/executionTimelineEngine.ts` | [`execution-timeline.md`](execution-timeline.md) |
| Field Operation Risk Engine / Findings Engine | `core/fieldOperations/{fieldOperationRiskEngine,fieldOperationFindingsEngine}.ts` | Below |
| Module layer | `modules/fieldOperations/fieldOperationsActions.ts` | Below |
| Dashboards | `/field-operations`, `/field-operations/[id]` | [`execution-dashboard.md`](execution-dashboard.md), [`field-operation-detail.md`](field-operation-detail.md) |

## Domain shape — a three-tier aggregate, one level deeper than Dispatch's own

`FieldOperation` (one per Dispatch Assignment, a coarse shell `status`: `active`/`completed`/`cancelled`/`archived`) carries `sessions: ExecutionSession[]` — one run of execution, more than one only when a prior session ended `cancelled`/`aborted`/`failed` and work restarted via `restartFieldOperationAction`. Each `ExecutionSession` carries its own `attempts: ExecutionAttempt[]` transition log, the exact `DispatchAttempt` precedent. This directly parallels Dispatch's own Order → Assignment → Attempt tiers, extended one level: Order → Assignment → **Session** → Attempt. The spec's own Step 3 line — "Sessions belong to one Dispatch Assignment" — holds transitively, since every session belongs to the one `FieldOperation` that itself maps 1:1 to a Dispatch Assignment.

`transitionSession` in `fieldOperationsStore.ts` is the single function every lifecycle transition goes through — it appends the `ExecutionAttempt`, stamps `started_at`/`paused_at`/`resumed_at`/`completed_at` as appropriate, and sets `outcome` only once a terminal state is reached. The attempt log and the session's own `lifecycle_state` can never drift apart.

## Naming collisions, disclosed and resolved

The spec's own Step 1 names "Execution Priority" and "Execution Context" as domain nouns, but `types/executionPackage.ts` already exports `ExecutionPriority` (an `AppointmentPriority` alias) and `ExecutionContext` (a package's own context/customer/location/priority bundle) — real, unrelated concepts from Checkpoint 27.3.

- **"Execution Priority"** reuses the existing `ExecutionPriority` type directly — exactly like `DispatchPriority = ExecutionPriority` did before it.
- **"Execution Context"** is satisfied by a plain `KnowledgeNodeRef | null` field on `FieldOperation` — the same shape every other context reference in this codebase already uses, never a reinvented struct.
- **"Execution Status"** (distinct from Step 5's own "Execution State") is satisfied by `ExecutionLifecycleState` — renamed only to dodge `executionPackage.ts`'s own `ExecutionStatus`, a different concept (a package's own draft/validated/approved/archived approval status).

## Route naming — `/field-operations`

No naming collision existed for this prefix, any of the 10 named doc filenames, or the `field-operations` navigation entry — confirmed by research before implementation began.

## Module layer — `fieldOperationsActions.ts`

- **`buildFieldOperationAction`** — resolves the source Dispatch Order/Assignment/Execution Package, gates on `evaluateFieldOperationEligibility`, and persists a `FieldOperation` with its first session starting `"created"`. No Timeline event on build — the spec's own 7 named events (Step 9) begin only at "Execution Started."
- **`evaluateFieldOperationAction`** — resolves the real Dispatch/Package/frozen-snapshot state via `resolveEvaluationContext`, then composes `ExecutionValidationEngine` + `ExecutionStateEngine` + `OperationalProgressEngine` + `ExecutionHealthEngine` + `ExecutionExplanationEngine` into one `ExecutionResult`, a pure read.
- **`startSessionAction`/`pauseSessionAction`/`resumeSessionAction`/`completeSessionAction`/`cancelSessionAction`/`abortSessionAction`/`failSessionAction`/`archiveSessionAction`** — each validated via the matching `ExecutionSessionEngine` decision, routed through one private `transition()` helper that appends the attempt and emits the matching Timeline event.
- **`restartFieldOperationAction`** — appends a fresh `ExecutionSession` after a prior one ended `cancelled`/`aborted`/`failed`, never mutating history.
- **`updateSessionProgressAction`** — records live step/milestone/checklist/deliverable completion on the current session's own overlay fields; emits no Timeline event, since progress changes aren't among the spec's 7 named events.
- **`evaluateFieldOperationsPlatformHealthAction`** — the Dashboard's and Executive Decisions' shared data source: re-evaluates every operation in the workspace, then runs `detectFieldOperationRisks`.

Same minimal session-gate discipline every prior checkpoint's module layer uses — every action only checks `session.kind !== "active"`; `field_operations.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline.

## Permissions

`field_operations.view`/`field_operations.manage` collapse the spec's 8 named capabilities into 2, the same narrower-manage/broader-view precedent every module in this codebase uses. `manager` gets both; `staff` gets only `view`.

## Known disclosed gap — the Dashboard/Detail UI is read-only

Every mutation action (`buildFieldOperationAction`, `startSessionAction`, `completeSessionAction`, etc.) exists and is fully tested, but no button in `FieldOperationsDashboardView`/`FieldOperationDetailView` calls them yet — the same "no create/mutate control wired" scope every prior platform dashboard in this codebase discloses. `evaluateFieldOperationAction` is the one wired exception, a genuine read.
