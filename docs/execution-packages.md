# Execution Package Platform — Architecture

v2.0 Checkpoint 27.3. Capability (26.1) determines **WHO** is eligible. Scheduling (27) determines **WHEN** work happens. Resource Allocation (27.1) determines **WHICH resources** should be used. Operational Planning (27.2) determines **HOW work should be executed**. Execution Package determines **EVERYTHING required to perform that work** — a single, immutable, frozen bundle Dispatch (a future checkpoint) will consume without recalculating any planning. Every engine here is a pure, deterministic function over already-computed data — no AI, no randomness, no dispatch, no live execution, no GPS, no route optimization, no automated execution.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/executionPackage.ts` | Below |
| Mock store | `lib/data/mock/executionPackagesStore.ts` | [`package-versioning.md`](package-versioning.md) |
| Accessors | `core/executionPackage/index.ts` | — |
| Package Builder | `core/executionPackage/packageBuilderEngine.ts` | [`package-builder.md`](package-builder.md) |
| Snapshot Engine | `core/executionPackage/snapshotEngine.ts` | [`snapshot-engine.md`](snapshot-engine.md) |
| Package Validation Engine | `core/executionPackage/packageValidationEngine.ts` | [`package-validation.md`](package-validation.md) |
| Package Health Engine | `core/executionPackage/packageHealthEngine.ts` | [`package-health.md`](package-health.md) |
| Package Explanation Engine / Execution Instructions Engine | `core/executionPackage/{packageExplanationEngine,executionInstructionsEngine}.ts` | Below |
| Package Comparison Engine | `core/executionPackage/packageComparisonEngine.ts` | [`package-comparison.md`](package-comparison.md) |
| Readiness Engine | `core/executionPackage/readinessEngine.ts` | [`package-readiness.md`](package-readiness.md) |
| Execution Package Timeline Engine | `core/executionPackage/executionPackageTimelineEngine.ts` | 7 named Timeline events |
| Execution Package Risk Engine / Findings Engine | `core/executionPackage/{executionPackageRiskEngine,executionPackageFindingsEngine}.ts` | 7 named findings → Executive Decisions |
| Module layer | `modules/executionPackage/executionPackageActions.ts` | Below |
| Dashboards | `/execution-packages`, `/execution-packages/[id]` | [`package-dashboard.md`](package-dashboard.md), [`execution-package-detail.md`](execution-package-detail.md) |

## Domain shape — a mutable shell around append-only immutable versions

An `ExecutionPackage` (`metadata`/`context`/`source`/`status`) is a thin, mutable shell around `versions: ExecutionVersion[]` — an append-only array where each entry is frozen the moment it's created and never mutated again, the same "immutable, append-only version" discipline `WorkflowVersion` (Checkpoint 12/13) established. `current_version_id` points at the version Dispatch would consume today. Each `ExecutionVersion` carries one `ExecutionSnapshot` — a plain-value copy of `ExecutionPhase[]`/`Milestone[]`/`Deliverable[]`/`EvidenceRequirement[]`/`PlanChecklist[]`/`ApprovalRequirement[]` (reused directly from `types/operationalPlanning.ts`) and `AllocationCandidate[]`/`ResourceBundle`/`DependencyCheckResult[]`/`ResourcePoolSnapshot` (reused directly from `types/allocation.ts`) — the exact values a real `OperationalPlan`/`Allocation` carried at build time, frozen by value, never a live reference back to either.

## Route naming — `/execution-packages`

No naming collision existed for this prefix, any of the 11 named doc filenames, or the `execution-packages` navigation entry — confirmed by research before implementation began.

## Execution Package Timeline Engine — the 7 named events

`package_created/updated/validated/approved/archived`, `snapshot_created`, `version_created`. Pure `{ type, description }` builders; `executionPackageActions.ts` calls them only on a real transition — `buildExecutionPackageAction` emits `package_created` + `snapshot_created`; `createExecutionPackageVersionAction` emits `snapshot_created` + `version_created`; `validateExecutionPackageAction` (a genuine, explicit user transition, distinct from the passive dashboard read `evaluateExecutionPackageAction` performs) emits `package_validated`; `approveExecutionPackageAction`/`archiveExecutionPackageAction` emit `package_approved`/`package_archived`. The pure-read `evaluateExecutionPackageAction`/`compareExecutionPackageVersionsAction`/`evaluateExecutionPackagePlatformHealthAction` emit nothing, so viewing a package or the dashboard never spams the Timeline.

## Knowledge Graph Integration — 0 live relationships, 8 reserved

`execution_package`, `package_snapshot`, `package_version`, `contains_plan`, `contains_allocation`, `contains_schedule`, `contains_capability`, `contains_bundle` are registered in `RelationshipType` but **none are ever emitted**. `ExecutionPackage`/`ExecutionVersion`/`ExecutionSnapshot` have no node identity of their own — frozen records inside a package's own aggregate document, the same discipline `OperationalPlan`/`Allocation`/`Calendar` held to before them. Unlike Operational Planning's `produces_deliverable` (which pointed at a real Document/MediaAsset node), nothing this checkpoint aggregates — an Operational Plan, an Allocation, an Appointment, a CapabilityRequirement, a ResourceBundle — has real node identity either; every one of them is itself plain registry data, not a Knowledge Graph node. Fabricating a node for any of them to satisfy these 8 relationship types would violate the "reuse the existing graph, never fake a node" rule. This is an even more conservative live/reserved ratio than Operational Planning's own 1-live/7-reserved, because this checkpoint's entire job is aggregating already-non-node planning artifacts into one frozen bundle for Dispatch — it never touches a genuinely new node relationship.

## Execution Package Risk Engine / Findings Engine — Executive Integration

`detectExecutionPackageRisks()` runs 7 named, deterministic detectors (Package Ready, Package Incomplete, Package Invalid, Missing Requirement, Version Drift, Operational Risk, Planning Risk) over already-computed data — every detector reads a validation/health/readiness result the caller already computed, never re-implementing any of it. `executionPackageFindingsToRecommendations()` translates the result into the Executive Decision Platform's existing `OperationalRecommendation` shape — the same "translate, don't duplicate" discipline `operationalFindingsEngine.ts`/`allocationFindingsEngine.ts`/`schedulingFindingsEngine.ts`/`capabilityFindingsEngine.ts` established. Reaching the spec's other two named feed targets (Business Health, Operational Intelligence) happens transitively through Executive Decisions — the same scope every prior checkpoint's own Executive Integration disclosed; none of Scheduling/Allocation/Operational Planning touched `core/knowledge/businessHealthEngine.ts`'s own input signature either, and this checkpoint doesn't either.

## Module layer — `executionPackageActions.ts`

- **`buildExecutionPackageAction`** — resolves the real `OperationalPlan`/`Allocation`/`Appointment`/`AllocationRequest`/`ResourceBundle` a caller names, freezes them into a snapshot via `SnapshotEngine`, generates `ExecutionInstructions` via `ExecutionInstructionsEngine`, assembles `ExecutionAttachment[]` (references to the plan, checklist templates, evidence requirements, deliverables, an optional customer note, plus the 4 named placeholders), and persists the first version.
- **`createExecutionPackageVersionAction`** — re-resolves sources and appends a new immutable version; the package resets to `"draft"` (a new version needs re-validation/re-approval).
- **`evaluateExecutionPackageAction`** — composes `PackageValidationEngine` + `PackageHealthEngine` + `PackageExplanationEngine` + `ReadinessEngine` into one `ExecutionPackageResult`, a pure read.
- **`validateExecutionPackageAction`** — the same composition, but a genuine user-triggered transition that records `package_validated`.
- **`approveExecutionPackageAction`/`archiveExecutionPackageAction`** — approval blocks on any blocking validation error.
- **`compareExecutionPackageVersionsAction`** — compares two versions by their version number via `PackageComparisonEngine`.
- **`evaluateExecutionPackagePlatformHealthAction`** — the Dashboard's and Executive Decisions' shared data source: re-derives validation/health/readiness for every package, detects Version Drift by comparing each snapshot's `captured_at` against its live source's `updated_at`, then runs `detectExecutionPackageRisks`.

Same minimal session-gate discipline every prior checkpoint's module layer uses — every action only checks `session.kind !== "active"`, no additional inline permission checks; `execution_packages.manage` exists in `permissionMatrix.ts` for future UI-level gating.

## Permissions

`execution_packages.view`/`execution_packages.manage` collapse the spec's 6 named capabilities into 2 permissions, following the narrower-manage/broader-view precedent every other module in this codebase uses. `manager` gets both; `staff` gets only `view`.

## Known disclosed gap — `dependency_checks` is caller-supplied

`ExecutionSnapshot.dependency_checks` defaults to `[]` unless the caller of `buildExecutionPackageAction`/`createExecutionPackageVersionAction` explicitly supplies a pre-computed `DependencyCheckResult[]`. Re-deriving it from scratch would mean re-running Allocation's own worker-resolution and `checkDependencies` logic — internal to `allocationActions.ts`, never exported — which would duplicate Allocation. Disclosed here and in [`package-builder.md`](package-builder.md), not silently omitted.
