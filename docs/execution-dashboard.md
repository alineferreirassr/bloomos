# Field Operations Dashboard

`src/modules/fieldOperations/components/FieldOperationsDashboardView.tsx`, route `/field-operations` — v2.0 Checkpoint 29, Step 12.

## What it shows

- **KPIs**: Active Sessions (`started`/`resumed`), Paused Sessions (`paused`), Completed Sessions (`outcome === "completed"`), Average Operational Health.
- **Blocked Operations**: every operation whose live-evaluated `validation.valid` is `false`, with its first validation error's detail and a link through to Detail.
- **Lifecycle Distribution**: a count of current sessions in every non-zero lifecycle state, rendered as one badge per state.
- **High-Severity Findings** / **Other Findings**: `FieldOperationFinding[]` from `evaluateFieldOperationsPlatformHealthAction`, split by severity — the same two-section split `DispatchDashboardView`/`ExecutionPackageDashboardView` already use.
- **Field Operations list**: every operation in the workspace, sorted newest-first, each row showing priority, session count, current lifecycle state, health, and shell status, linking to `/field-operations/[id]`.

## Read-only, one shared data source

Every figure comes straight from `evaluateFieldOperationsPlatformHealthAction`'s already-computed `{ results, findings }` — no live execution, no GPS, no route optimization happens inside the Dashboard itself. A "Refresh" button re-runs the same action; there is no create/mutate control wired (see [`field-operations.md`](field-operations.md)'s disclosed gap).

## Blocked vs. Findings — two different lenses on the same data

"Blocked Operations" and the `execution_blocked` finding describe the identical condition (`validation.valid === false`) but are surfaced as two separate sections because they answer two different questions the spec asks for: "which operations are blocked, and why" (a direct, actionable list) vs. "what needs executive attention across every finding type" (the full findings feed, including `execution_healthy`/`execution_completed` — informational, not just problems). Neither section re-derives validation; both read the same `evaluateFieldOperationsPlatformHealthAction` result.
