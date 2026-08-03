# Package Validation Engine

`src/core/executionPackage/packageValidationEngine.ts` — v2.0 Checkpoint 27.3, Step 4.

## What it answers

"No missing requirements" (the spec's own Step 4 line) across Capability, Schedule, Allocation, Operational Plan, Dependencies, Evidence Requirements, Approvals, Deliverables, Checklist Completeness, Milestones. Every field it checks lives directly on the frozen `ExecutionSnapshot` — this engine never re-fetches or re-derives anything.

## `validatePackage`

```ts
validatePackage(input: { snapshot: ExecutionSnapshot }): PackageValidationResult
```

| Check | Rule | Severity | Source |
|---|---|---|---|
| Operational Plan / Dependencies / Evidence / Deliverables / Milestones / Approvals | `broken_dependencies`, `missing_milestones`, `missing_deliverables`, `missing_evidence`, `invalid_phase_order`, `required_approvals`, `missing_resources`, `missing_capability` | error/warning per rule | `OperationalConstraintsEngine.validateOperationalConstraints` — reused wholesale, never re-implemented |
| Checklist Completeness | `incomplete_checklist` | warning | `ChecklistEngine.findIncompleteChecklists` |
| Allocation | `missing_allocation` | error | `snapshot.allocation_id`/`allocation_candidates` |
| Schedule | `missing_schedule` | error | `snapshot.appointment_id` |
| Capability | `capability_gap` | warning | `snapshot.dependency_checks` — an unsatisfied entry |

## Reuse discipline

Operational Plan/Dependencies/Evidence Requirements/Approvals/Deliverables/Milestones are validated by calling `validateOperationalConstraints` wholesale — the exact same function Operational Planning's own package validation uses, never a second, duplicate implementation of those 6 checks.

## Capability — the one honest simplification

"Capability" is validated through the snapshot's own `dependency_checks` (Allocation's resource-to-resource dependency results, e.g. "Drone requires a certified operator") — an unsatisfied entry is the one signal this pure engine has for a capability gap. A full re-evaluation against Checkpoint 26.1's live `CapabilityRequirement` data would be a genuine cross-module read, out of scope for a pure validator; disclosed here rather than silently approximated.

## Consumers

- `executionPackageActions.ts` — `evaluateExecutionPackageAction`/`validateExecutionPackageAction`/`compareExecutionPackageVersionsAction`/`evaluateExecutionPackagePlatformHealthAction` all call this as the first step of their composition.
- `ReadinessEngine` — every `waiting_*`/`blocked` state maps directly onto one or more of this engine's own rules.
- `PackageExplanationEngine` — surfaces every error/warning as readable prose.
- `executionPackageRiskEngine.ts` — the `package_invalid`/`missing_requirement` findings.
