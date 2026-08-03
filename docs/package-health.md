# Package Health Engine

`src/core/executionPackage/packageHealthEngine.ts` — v2.0 Checkpoint 27.3, Step 5.

## What it answers

Eight disclosed, deterministic formulas over the frozen `ExecutionSnapshot` — same "not applicable resolves to a vacuous pass" discipline every score engine in this codebase follows, with two deliberate exceptions that resolve to `0` (not vacuous) because a package literally cannot execute in either state.

## `computePackageHealthScores`

```ts
computePackageHealthScores(snapshot: ExecutionSnapshot): PackageHealthScores
```

| Score | Formula | Vacuous case |
|---|---|---|
| `planningHealth` | `100 × (present pillars ÷ 3)` — allocation/schedule/operational plan | n/a (always computable) |
| `allocationHealth` | `100 × selected ÷ total candidates` | **`0`, not vacuous**, when there's no allocation at all |
| `operationalHealth` | `computeOperationalHealthScores(...).overallOperationalHealth` — reused wholesale | inherits Operational Planning's own vacuous rules |
| `dependencyHealth` | average of the Operational Plan's step-dependency score and the resource-dependency satisfaction ratio | 100 when there are no dependency checks at all |
| `bundleHealth` | `computeBundleCompletenessScore(evaluateBundleCompleteness(...))` — reused wholesale from `BundleEngine` | 100 when this package isn't based on a bundle |
| `evidenceCoverage` | `computeOperationalHealthScores(...).evidenceCoverageScore` — reused | inherits Operational Planning's rule |
| `checklistCoverage` | `computeOperationalHealthScores(...).checklistCoverageScore` — reused | inherits Operational Planning's rule |
| `overallPackageHealth` | unweighted average of the other seven | — |

## The two non-vacuous exceptions

- **`allocationHealth`** is `0` — not vacuous — when `allocation_id === null`. Vacuous `100` only applies when an allocation genuinely exists but has zero candidate lines (an unusual but legitimate state). The same "surface the one finding this score exists to catch" precedent `AllocationScoreEngine.computeCapabilityFitScore` set for a zero-candidate allocation.
- **`dependencyHealth`**'s step-dependency half inherits Operational Planning's own `0`-on-cycle exception directly, since it's `computeOperationalHealthScores(...).dependencyHealthScore` reused as-is.

## Reuse discipline

`operationalHealth`/`evidenceCoverage`/`checklistCoverage`/half of `dependencyHealth` all come from one call to `computeOperationalHealthScores` — never four separate, duplicate formulas for the same underlying plan data. `bundleHealth` reuses `BundleEngine.evaluateBundleCompleteness`/`computeBundleCompletenessScore` wholesale — the same functions Resource Allocation's own bundle completeness check uses.

## Consumers

- `executionPackageActions.ts` — every evaluation/comparison/dashboard action calls this.
- `ReadinessEngine` — `incomplete` fires when `overallPackageHealth` falls below its own threshold with no other blocker.
- `PackageComparisonEngine` — `healthA`/`healthB` in a version comparison.
- `executionPackageRiskEngine.ts` — the `operational_risk`/`planning_risk` findings threshold directly against `operationalHealth`/`planningHealth`.
