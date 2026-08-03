# Reporting Center UI

6 routes under `/reports`, each a thin `src/app/(app)/reports/...` wrapper around a component in `modules/reporting/components/`.

| Route | Component | Purpose |
|---|---|---|
| `/reports` | `ReportsDashboardView` | Saved report library + analytics KPI summary + links to Builder/Templates |
| `/reports/[id]` | `ReportDetailView` | Renders a `ComputedSavedReport`'s widgets, comparison banner, source diagnostics, export/snapshot/archive actions; for `category: "executive"` reports, an additional executive-insights section |
| `/reports/builder` | `ReportBuilderView` | Metric picker grouped by category, period/comparison/category selects, live preview via `previewReportAction`, save via `createReportAction` |
| `/reports/templates` | `ReportTemplatesView` | Gallery of the 16 built-in templates; `applyTemplate()` opens a template pre-filled in the Builder |
| `/reports/snapshots` | `ReportSnapshotsView` | Cross-report snapshot list via `listAllReportSnapshotsAction` |
| `/reports/analytics` | `ReportingAnalyticsView` | Composes `evaluateReportingAnalyticsAction` + `evaluateReportingHealthAction` |

## Navigation + permissions

A `Reports` entry (`ReportsIcon`) was added to `config/navigation.ts`, visible to any member with `reports.view`. `config/navigation.test.ts`'s hardcoded `staffPermissions` fixture was extended with `"reports.view"` to keep the staff-role navigation-visibility test accurate (the same fixture-drift fix pattern hit in Checkpoint 41's `notifications.view` addition).

## Smart Workspace extension

A new `"reports_overview"` widget type was added to `WORKSPACE_WIDGET_TYPES` (`types/smartWorkspace.ts`) rather than overloading the existing `analytics_overview` widget (which is typed to a different `ExecutiveDashboardData` shape). `WorkspaceSummary` gained a `reportsSummary: WorkspaceReportsSummary` field, populated in `workspaceActions.ts`'s existing `Promise.all` fetch. `ReportsOverviewWidget.tsx` renders it; `WorkspaceHomeView`'s widget-render switch gained the matching `case`.

## Executive Dashboard link

`ExecutiveDashboardView` (Checkpoint 25.7) gained a "View as Report" button linking to `/reports/templates` — a pointer into the Reporting Platform, not a duplicated view of the same data.

## Client-Safe Reporting (separate surface)

`/client-access/report` — a Client Portal route, session-gated by `ClientAccountContext` rather than staff permissions, rendering `ClientSafeReportView` via `getClientSafeReportAction()`. See `docs/reporting-platform.md`'s reuse map for why this is a strict field-projection composition, not the internal Reporting Engine exposed to clients.
