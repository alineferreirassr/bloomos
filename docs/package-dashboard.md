# Execution Package Dashboard

`src/modules/executionPackage/components/ExecutionPackageDashboardView.tsx` — v2.0 Checkpoint 27.3, Step 14, routed at `/execution-packages`.

## What it displays

Packages, Health, Versions, Readiness, Validation, Approvals, Risk — every figure comes straight from `evaluateExecutionPackagePlatformHealthAction`'s already-computed result. Calls `listExecutionPackagesAction()` and `evaluateExecutionPackagePlatformHealthAction()` on mount (the exact `useEffect` inline-fetch pattern `OperationalDashboardView.tsx`/`AllocationDashboardView.tsx` established, avoiding the `react-hooks/set-state-in-effect` ESLint error hit earlier in this codebase).

- **KPI cards** — Execution Packages, Ready for Execution (from `readinessByPackageId`), Findings, Average Package Health.
- **High-severity findings** — a dedicated section, separate from a collapsed "other findings" section (capped at 10).
- **Packages list** — newest first, capped at 25, each row showing its status, health score, and readiness state, linking to its Detail page.

## Scope, disclosed — no create/mutate UI wired

No structural-mutation action is wired into a button on this view. `buildExecutionPackageAction`/`createExecutionPackageVersionAction`/`approveExecutionPackageAction`/`archiveExecutionPackageAction` all exist and are fully exercised by `executionPackageActions.test.ts` — the same "entities are created through the module action layer, exercised directly in tests" precedent `OperationalDashboardView.tsx`/`AllocationDashboardView.tsx`/`CalendarDashboardView.tsx` established before it.

## Testing

`ExecutionPackageDashboardView.test.tsx` mocks the action module (`vi.mock("@/modules/executionPackage/executionPackageActions", ...)`) and exercises the loading/error/empty states plus the high-severity-findings section — the same mocking pattern every prior platform dashboard test in this codebase uses.
