# Readiness Engine

`src/core/executionPackage/readinessEngine.ts` — v2.0 Checkpoint 27.3, Step 16.

## What it answers

Classifies a package's already-computed validation + health into the single most actionable state — Ready, Blocked, Incomplete, Waiting Approval, Waiting Resources, Waiting Schedule, Waiting Dependencies, Waiting Evidence. Never re-detects anything; only composes `PackageValidationEngine`/`PackageHealthEngine`'s existing output.

## `computePackageReadiness`

```ts
computePackageReadiness(input: { validation: PackageValidationResult; health: PackageHealthScores }): PackageReadinessResult
```

## Precedence — most fundamental prerequisite first

A package can't meaningfully be "waiting on approval" if it has no allocation at all yet, so the precedence runs from the most fundamental prerequisite to the least:

1. **`waiting_resources`** — `missing_allocation` error present.
2. **`waiting_schedule`** — `missing_schedule` error present.
3. **`waiting_dependencies`** — `broken_dependencies` error present, or any unsatisfied `capability_gap` warning.
4. **`waiting_evidence`** — `missing_evidence` error present.
5. **`waiting_approval`** — `required_approvals` warning present, nothing more fundamental blocking.
6. **`blocked`** — any other blocking validation error not covered above (e.g. `missing_deliverables`, `missing_milestones`).
7. **`incomplete`** — valid (no blocking errors) but a non-approval warning exists, or `overallPackageHealth` falls below the incomplete threshold (80) with no warnings at all.
8. **`ready`** — valid, no warnings, health at or above the threshold.

Each state maps to exactly one `PackageValidationEngine` rule (or a small, disclosed group of them), so the reader always knows which validation issue produced a given readiness state — never an opaque classification.

## Consumers

- `executionPackageActions.ts` — `evaluateExecutionPackageAction`/`validateExecutionPackageAction`/`evaluateExecutionPackagePlatformHealthAction` all surface `readiness.state` directly.
- `ExecutionPackageDashboardView.tsx` — the "Ready for Execution" KPI counts packages whose `readinessByPackageId[id].state === "ready"`.
- `executionPackageRiskEngine.ts` — the `package_ready`/`package_incomplete` findings read `readiness.state` directly.
