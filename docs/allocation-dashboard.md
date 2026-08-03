# Allocation Dashboard, Request Detail & Bundle Management

`src/modules/allocation/components/{AllocationDashboardView,AllocationRequestDetailView,BundleManagementView}.tsx` — v2.0 Checkpoint 27.1, Steps 19–21. Routes: `/allocations`, `/allocations/requests/[id]`, `/allocations/bundles`.

## Same read-only precedent every prior platform dashboard in this codebase established

`generateAllocationProposalAction`/`approveAllocationAction`/`archiveAllocationAction`/`createResourceBundleAction` all exist, are fully tested in `allocationActions.test.ts`, and are ready for a future form — but no button in this UI calls them, matching the exact precedent `CalendarDashboardView.tsx` and `CapabilityDashboardView.tsx` already set (neither wires `createCalendarAction`/`createCapabilityRequirementAction` either). Entities are created through the module action layer, exercised directly in tests; the dashboards cover every read/evaluate surface the spec asked for.

The two exceptions — re-deriving scores and comparing proposals — are read operations even though they're Server Action calls: `reEvaluateAllocationAction` and `compareAllocationProposalsAction` re-derive already-computed data from a stable `candidates` array, never re-selecting resources, so they're wired directly into the Detail view exactly as `evaluateWorkspaceSchedulingAction` is called from Calendar's read-only views.

## Allocation Dashboard (`/allocations`)

Reads `listAllocationRequestsAction`, `listResourceBundlesAction`, and `evaluateResourceAllocationHealthAction` on mount and on an explicit Refresh click. KPIs: Allocation Requests, Active Allocations, Findings, Available Resources. High/other findings sections (severity conveyed by a text-labeled `Badge`, never color alone). The request list links through to the Detail page; a Resource Pool card shows available/reserved/busy/unavailable counts plus shared/critical-resource summary; a Resource Bundles card previews the first six bundles and links to Bundle Management.

## Allocation Request Detail (`/allocations/requests/[id]`)

Shows the request's requirement lines (resource type, quantity, notes, whether a capability requirement is attached) and every `Allocation` (proposal) generated for it. Each proposal card lists its selected candidates and has an "Evaluate" button — clicking it calls `reEvaluateAllocationAction`, then renders the fresh `AllocationScores` grid, the explanation summary, and any validation errors/warnings inline. When more than one proposal shares a `group_id`, a "Compare Proposals" section appears with a button that calls `compareAllocationProposalsAction` and renders each proposal's `overallAllocationScore` plus the comparison engine's named differences.

## Bundle Management (`/allocations/bundles`)

Lists every `ResourceBundle` (active by default, with a toggle to include archived), showing its required/optional resource lines and status. Read-only, same disclosed scope as above.

## Accessibility & performance

Real `<button>`/`<a>` elements throughout, `role="list"`/`listitem` for every list, an `aria-live` region for the Dashboard's refresh announcement. Score/finding severity always pairs a text label with the `Badge` color. Data loading is `useEffect`-driven on mount only (plus an explicit user action for refresh/evaluate/compare) — never re-fetched on every render; groupings (`highFindings`, `sortedRequests`, `comparableGroupId`) are `useMemo`-derived.

## Navigation & permissions

`allocations.view`/`allocations.manage` follow the exact `scheduling.view`/`scheduling.manage` narrower-manage/broader-view precedent — `allocations.manage` granted to owner/manager, `allocations.view` additionally to staff. `routeAccess.ts` gates the `/allocations` prefix (covering all three routes via prefix matching) on `allocations.view`; the sidebar's "Resource Allocation" entry (next to Calendar) derives its visibility from the same check, never a second permission field.
