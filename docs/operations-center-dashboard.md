# Operations Center Dashboard, Alert Detail, Incident Detail

`modules/operationsCenter/components/{OperationsCenterDashboardView,AlertDetailView,IncidentDetailView}.tsx`, routed at `/operations-center`, `/operations-center/alerts/[id]`, `/operations-center/incidents/[id]`.

## Dashboard — one adaptive view, not three

Steps 17-19 name separate Owner/Team/Mobile views; `OperationsCenterDashboardView` serves all three as one responsive component — the same figures at every breakpoint, laid out in a responsive grid — consistent with every other checkpoint's own "one dashboard, responsive" precedent rather than three parallel components with duplicated data-fetching. It reads `evaluateOperationsCenterAction()` once and renders: the overall status badge, 8 KPI cards, the deterministic Brief, the Priority Queue (top 10), Open Alerts (with wired Acknowledge/Resolve buttons), Open Incidents, Resource Overview, and the Location Summary (explicitly labeled as a list-based, provider-ready placeholder).

## Alert Detail

`AlertDetailView` shows the alert's title/description/category/rule/severity/status, its exact `source_record_id`, its own lifecycle timestamps (opened/acknowledged/escalated/dismissed/resolved), and wires all 4 lifecycle actions (`Acknowledge`/`Resolve`/`Dismiss`/`Escalate`) directly — genuine mutations, not a read-only shell. Comments render through the existing generic `CommentsPanel` (`ownerType="operational_alert"`), since `operational_alert` is a real `EntityType`.

## Incident Detail

`IncidentDetailView` shows the incident's summary, its own lifecycle actions (`Acknowledge`/`Resolve`), every related resource id grouped by type (dispatch orders/field operations/route plans/workers/vehicles/equipment), and its full list of linked source alerts (each one a deep link to its own Alert Detail page). Comments render through the same `CommentsPanel` (`ownerType="operational_incident"`).

## Accessibility

Every list uses `role="list"`/`role="listitem"`; severity/status are always paired with a text label next to the color (`Badge` component), never color alone; the Dashboard's refresh announces via `aria-live="polite"`; every action is a real `<button>` reachable by keyboard, with disabled states while a mutation is in flight.

## Known gap

No live authenticated browser verification — the dev environment requires a real sign-in this session has no credentials for. Verified instead through 14 component tests exercising the actual rendered UI (loading/error/empty states, KPI rendering, alert/incident lifecycle actions and their effect on re-rendered state) against mocked module actions, plus a successful `next build` of all three routes.
