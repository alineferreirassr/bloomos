# Execution Package Detail

`src/modules/executionPackage/components/ExecutionPackageDetailView.tsx` — v2.0 Checkpoint 27.3, Step 15, routed at `/execution-packages/[id]`.

## What it displays

Snapshot, Resources, Allocation, Schedule, Operational Plan, Instructions, Deliverables, Evidence, Checklist, Dependencies, Versions — one package's full current-version picture. Calls `getExecutionPackageAction(id)` on mount, displaying:

- **Snapshot references** — the current version's `allocation_id`/`appointment_id`/`operational_plan_id`, each as a badge (green when present, neutral when `null`).
- **Deliverables & Evidence** — combined list from the current snapshot.
- **Instructions** — every generated `ExecutionInstructionLine`, tagged with its section (`preparation`/`arrival`/`execution`/`cleanup`/`completion`).
- **Version History** — every `ExecutionVersion`, its reason, creation timestamp, and which one is current.

## The one wired mutation-adjacent action — `evaluateExecutionPackageAction`

An "Evaluate" button calls `evaluateExecutionPackageAction(id)` and renders the resulting validation errors/warnings, health scores, explanation summary, and readiness state. This is wired directly into an otherwise read-only view — the same deliberate exception `OperationalPlanDetailView.tsx`'s `evaluateOperationalPlanAction` and `AllocationRequestDetailView.tsx`'s `reEvaluateAllocationAction` established: it's a genuine re-derivation of already-computed data, never a mutation, so it doesn't violate the "no create/mutate control wired" scope.

`approveExecutionPackageAction`/`archiveExecutionPackageAction`/`createExecutionPackageVersionAction` stay unwired, matching every prior platform detail view's disclosed scope.

## Testing

`ExecutionPackageDetailView.test.tsx` mocks the action module, exercising the loading/error states, the snapshot/instructions/deliverables rendering, and the Evaluate click-through — the same pattern `OperationalPlanDetailView.test.tsx`/`AllocationRequestDetailView.test.tsx` use. One collision worth noting for future test authors: the package title renders both in the `PageHeader`'s `<h1>` and in its breadcrumb, so asserting on the title text requires `getByRole("heading", { name: ... })` rather than a bare `getByText`, to avoid a "multiple elements" ambiguity error.
