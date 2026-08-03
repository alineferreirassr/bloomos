# Package Builder

`src/core/executionPackage/packageBuilderEngine.ts` — v2.0 Checkpoint 27.3, Step 2.

## What it answers

Given already-resolved planning data (an `OperationalPlan`'s own context, an `AllocationRequest`'s location/priority, an explicit Customer reference, an explicit priority override), assembles a package's `ExecutionContext`/`ExecutionMetadata`. Pure and deterministic — it never fetches anything itself; `executionPackageActions.ts`'s `resolveSnapshotSources` does every real lookup (Operational Plan, Allocation, Appointment, Allocation Request, Resource Bundle) before calling in here.

## `buildExecutionContext`

```ts
buildExecutionContext(input: PackageContextInput): ExecutionContext
```

Carries the source Operational Plan's `context_type`/`context` through unchanged — a package's primary context (e.g. an Event) is the same concept as the plan's own context, never re-derived independently. Priority resolves `priorityOverride ?? requestedPriority ?? "medium"` — an explicit override always wins, then the Allocation Request's own priority, then a sane default.

## `buildExecutionMetadata`

```ts
buildExecutionMetadata(planName, notes, tags): ExecutionMetadata
```

Derives a package title from the plan name (`"${planName} — Execution Package"`) — deterministic, never invented.

## Reuse discipline — "Capability" and "Business Rules" need no dedicated field

The spec's Step 2 lists Capability and Business Rules among the building blocks. Neither gets a dedicated field on `ExecutionContext`/`ExecutionMetadata`:

- **Capability** already flows through on each `ExecutionStep.required_capability_requirement_id` inside the snapshot's own `phases` — carried over by `SnapshotEngine`, never re-declared at the package level.
- **Business Rules** is satisfied by `PackageValidationEngine` (Step 4), which runs immediately after a package is built — never a second, duplicate rule engine. The Stop Condition is explicit: never duplicate Operational Intelligence's own Business Rule Engine.

## The Execution Instructions Engine's phase-kind → section mapping

`executionInstructionsEngine.ts` (Steps 6-7, built alongside the Package Builder) folds the spec's 9 named `ExecutionPhaseKind`s into its 5 named instruction sections: `preparation`/`travel` → `preparation`; `arrival`/`setup` → `arrival`; `execution`/`custom` → `execution`; `cleanup` → `cleanup`; `quality_review`/`completion` → `completion`. A disclosed, deterministic simplification — every instruction line still traces back to a real step's own `instructions` field, never fabricated.

## Disclosed gap — `dependency_checks` is caller-supplied, never re-derived

`buildExecutionPackageAction`'s `BuildExecutionPackageInput.dependencyChecks` defaults to `[]`. Re-deriving a fresh `DependencyCheckResult[]` from an Allocation's real Worker candidates would mean re-running Allocation's own `checkDependencies`/worker-resolution logic (internal to `allocationActions.ts`, never exported) — duplicating Allocation, which the Stop Condition forbids. A caller with fresh, already-computed dependency results (e.g. from a recent `reEvaluateAllocationAction`-style call) may supply them explicitly; otherwise the snapshot's dependency section is honestly empty rather than fabricated.
