# Package Comparison Engine

`src/core/executionPackage/packageComparisonEngine.ts` — v2.0 Checkpoint 27.3, Step 10.

## What it answers

Compares two already-scored immutable versions of the same package — Version A, Version B, Changes, Risk, Health, Dependencies, Instructions, Resources. Pure, deterministic; every risk level and change is a disclosed threshold or plain set-diff over already-computed data, never a judgment call.

## `resolvePackageRiskLevel`

```ts
resolvePackageRiskLevel(health: PackageHealthScores, validationErrorCount: number): PackageRiskLevel
```

Any blocking validation error makes a version `"high"` risk outright, regardless of its health score — an unexecutable package is never `"medium"` risk. Otherwise thresholds at `overallPackageHealth` ≥ 80 (`"low"`) / ≥ 50 (`"medium"`). The same precedent `operationalComparisonEngine.resolveRiskLevel` established.

## `compareExecutionVersions`

```ts
compareExecutionVersions(versionA, versionB, healthA, healthB, validationErrorCountA, validationErrorCountB): ExecutionVersionComparisonResult
```

| Field | How it's computed |
|---|---|
| `changes` | Plain equality checks on `allocation_id`/`appointment_id`/`operational_plan_id`/`bundle_id` between the two snapshots |
| `resourceChanges` | Set-diff of each version's selected `allocation_candidates` resource ids |
| `dependencyChanges` | Set-diff of each version's satisfied `dependency_checks` rule ids |
| `instructionChanges` | Set-diff of each version's `instructions.sections` text |
| `healthA`/`healthB` | Passed straight through from the caller — never recomputed here |
| `riskA`/`riskB` | `resolvePackageRiskLevel` applied to each side |

Every diff is a plain set comparison (added/removed), never a semantic diff of what changed *within* an unchanged reference — "did the allocation change at all" is all Package Comparison needs to answer.

## Consumers

- `executionPackageActions.ts`'s `compareExecutionPackageVersionsAction` — looks up two versions by `version_number`, computes fresh validation/health for each, and calls this.
- A future Dispatch checkpoint — comparing the approved version against a newer draft before deciding whether to re-approve.
