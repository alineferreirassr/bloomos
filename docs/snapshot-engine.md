# Snapshot Engine

`src/core/executionPackage/snapshotEngine.ts` — v2.0 Checkpoint 27.3, Step 3.

## What it answers

Freezes every piece of already-resolved planning data — Allocation, Schedule, Operational Plan, Bundle, Dependencies, Resource Pool — into one `ExecutionSnapshot`. A plain copy by value, never a live reference back to the source records. Once a version exists, its snapshot is never mutated again — "Package becomes immutable" (the spec's own Step 3 line).

## `buildExecutionSnapshot`

```ts
buildExecutionSnapshot(id, capturedAt, input: SnapshotInput): ExecutionSnapshot
```

Pure: it never mints its own `id` or `captured_at` timestamp — the caller (`executionPackageActions.ts`) generates both and passes them in, the same "pure engine takes pre-resolved inputs" boundary `instantiatePlanStructureFromTemplate` established for Operational Planning's own id-minting concerns. Every field resolves to `null`/`[]` when its source wasn't supplied — never fabricated:

| Snapshot section | Source |
|---|---|
| Allocation | `allocation.id`/`strategy`/`candidates` |
| Schedule | `appointment.id`/`starts_at`/`ends_at`/`calendar_id` |
| Operational Plan | `plan.id`/`phases`/`milestones`/`deliverables`/`evidence_requirements`/`checklists`/`approvals` |
| Bundles | `bundle` (the whole `ResourceBundle`, or `null`) |
| Dependencies | `dependencyChecks` (caller-supplied, see [`package-builder.md`](package-builder.md)) |
| Worker Candidates | `allocation.candidates` itself — every candidate considered, selected or not, each with a `rejection_reason` when rejected; never a second, duplicate candidate-pool concept |
| Resource Pool | `resourcePool` (a `ResourcePoolSnapshot`, or `null`) |

## `hasSnapshotDrifted`

```ts
hasSnapshotDrifted(capturedAt, liveUpdatedAt): boolean
```

The one comparison Step 13's "Version Drift" finding needs: has the live source record changed since this snapshot was captured? A plain timestamp comparison — `liveUpdatedAt: null` (the source no longer exists) is never treated as drift; a missing source is a validation concern, not a staleness concern. `executionPackageActions.ts`'s `evaluateExecutionPackagePlatformHealthAction` calls this once per package against both the live Operational Plan's and the live Allocation's own `updated_at`.

## Consumers

- `executionPackageActions.ts` — `buildExecutionPackageAction`/`createExecutionPackageVersionAction` call `buildExecutionSnapshot` to construct each new immutable version; `evaluateExecutionPackagePlatformHealthAction` calls `hasSnapshotDrifted` for the Version Drift finding.
- `PackageValidationEngine`/`PackageHealthEngine`/`ExecutionInstructionsEngine`/`PackageComparisonEngine` all read directly from an already-built `ExecutionSnapshot` — none of them re-derive or re-fetch anything.
