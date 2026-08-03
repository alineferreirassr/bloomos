# Dispatch Builder

`src/core/dispatch/dispatchBuilderEngine.ts` — v2.0 Checkpoint 28, Step 2.

## What it answers

Given an Execution Package's own `status` and already-computed `readiness.state`, decides whether a Dispatch Order may be built from it at all.

```ts
evaluateDispatchEligibility(input: DispatchEligibilityInput): DispatchEligibilityResult
```

Returns `{ canDispatch: false, reason }` when `packageStatus !== "approved"`, or when `packageReadinessState !== "ready"`. Otherwise `{ canDispatch: true, reason: null }`.

## Why this is the *only* eligibility gate — "Approved Allocation"/"Approved Schedule"/"Approved Operational Plan" need no separate check

The spec's Step 2 building-block list opens with "Approved Execution Package, Approved Allocation, Approved Schedule, Approved Operational Plan, Approved Snapshot." Only the Execution Package's own status/readiness is checked here, because:

- Allocation/Schedule/Operational Plan presence and validity were already vetted the moment the Execution Package itself became `"approved"` — Checkpoint 27.3's own `approveExecutionPackageAction` blocks on `PackageValidationEngine` returning `valid: true`, which composes Allocation/Schedule/Plan presence checks internally.
- "Approved Snapshot" is simply the package's own current, already-frozen `ExecutionVersion.snapshot` — Dispatch reads it, it never rebuilds it.

Re-checking any of Allocation/Schedule/Operational Plan independently here would mean recalculating Capability/Scheduling/Allocation or rebuilding Operational Plans — both explicitly forbidden by the Stop Condition.

## Caller wiring — `buildDispatchOrderAction`

`modules/dispatch/dispatchActions.ts`'s `buildDispatchOrderAction` resolves the named `ExecutionPackage`, re-derives `validatePackage`/`computePackageHealthScores`/`computePackageReadiness` against its current version's snapshot (the same engines Checkpoint 27.3 built — never re-implemented), then calls `evaluateDispatchEligibility({ packageStatus: pkg.status, packageReadinessState: readiness.state })`. A rejection here returns the eligibility's own `reason` as the action's error, never a generic message.
