# Operational Planning Dashboard, Plan Detail & Plan Template Library

v2.0 Checkpoint 27.2, Steps 19-21. Three read-only React views under `src/modules/operationalPlanning/components/`, routed at `/operational-planning`, `/operational-planning/plans/[id]`, and `/operational-planning/templates`.

## `OperationalDashboardView` — `/operational-planning`

Calls `listOperationalPlansAction()`, `listPlanTemplatesAction()`, and `evaluateOperationalPlanningHealthAction()` on mount (the exact `useEffect` inline-fetch pattern `AllocationDashboardView.tsx` established, avoiding the `react-hooks/set-state-in-effect` ESLint error hit earlier in `CalendarDashboardView.tsx`). Shows:

- KPI cards: Operational Plans, Plan Templates, Findings, **Average Operational Health** — computed client-side from `EvaluateOperationalPlanningHealthResult.healthByPlanId` (added specifically for this KPI, mirroring how `CalendarDashboardView.tsx` consumes `scoresByCalendarId`).
- High-severity findings section, separate from a collapsed "other findings" section (capped at 10).
- A plans list (newest first, capped at 25), each row linking to its Plan Detail page and showing its per-plan health score inline.
- A "Plan Templates" header action linking to the Template Library.

## `OperationalPlanDetailView` — `/operational-planning/plans/[id]`

Calls `getOperationalPlanAction(id)` on mount, displaying the full plan structure: phases (sorted, each with its steps and dependency counts), milestones, deliverables, evidence requirements, approvals, and checklists (with completion counts). An "Evaluate" button calls `evaluateOperationalPlanAction(id)` on click and renders the resulting health scores, validation errors/warnings, explanation summary, and critical-path summary.

`evaluateOperationalPlanAction` is wired directly into this read-only view — the one deliberate exception, matching `AllocationRequestDetailView.tsx`'s `reEvaluateAllocationAction`/`compareAllocationProposalsAction` precedent: it's a genuine **re-derivation** of already-computed data (validation/health/explanation/critical path), never a mutation, so it doesn't violate the "no create/mutate control wired" scope below.

## `PlanTemplateLibraryView` — `/operational-planning/templates`

Calls `listPlanTemplatesAction(includeArchived)`, listing every template with its category, version, and phase/step/milestone/deliverable/evidence/approval counts — mirroring `BundleManagementView.tsx`'s exact shape, including the "show archived" toggle.

## Scope, disclosed — no create/mutate UI wired

None of the three views wires a structural-mutation action into a button. `addPhaseAction`/`addStepToPhaseAction`/`addMilestoneAction`/`completeMilestoneAction`/`addDeliverableAction`/`addEvidenceRequirementAction`/`addApprovalRequirementAction`/`decideApprovalAction`/`attachChecklistFromTemplateAction`/`toggleChecklistItemAction`/`approvePlanAction`/`archivePlanAction`/`createOperationalPlanAction`/`createPlanTemplateAction`/`createChecklistTemplateAction` all exist and are fully exercised by `operationalPlanningActions.test.ts` — the same "entities are created through the module action layer, exercised directly in tests" precedent `CalendarDashboardView.tsx`/`AllocationDashboardView.tsx` established (verified by direct inspection: neither wires its own `create*Action` into any UI control either).

## Testing

`OperationalDashboardView.test.tsx`, `OperationalPlanDetailView.test.tsx`, `PlanTemplateLibraryView.test.tsx` — mock the action module (`vi.mock("@/modules/operationalPlanning/operationalPlanningActions", ...)`), exercise the loading/error/empty states, and (for the Detail view) the Evaluate click-through — the same mocking pattern `AllocationDashboardView.test.tsx`/`AllocationRequestDetailView.test.tsx`/`BundleManagementView.test.tsx` use.
