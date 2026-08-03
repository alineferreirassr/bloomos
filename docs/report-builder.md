# Report Builder

`modules/reporting/reportingActions.ts` is the module-actions layer every Reporting Center route calls through — no route talks to `core/reporting/*` or `lib/data/core/reporting/*` directly.

## Discovery actions (power the Builder UI)

| Action | Returns |
|---|---|
| `listReportMetricsAction(category?)` | Every metric visible to the requesting member (3-gate filtered), optionally scoped to a `ReportCategory` |
| `listReportDimensionsAction()` | The 25 `ReportDimensionKey` values |
| `listReportFiltersAction()` | The 14 `ReportFilterKey` values |
| `listReportTemplatesAction()` / `getReportTemplateAction(id)` | The 16 templates |

`ReportBuilderView` groups the metric list by category into a checkbox picker, offers period/comparison-mode/category selects, and calls `previewReportAction(definition)` on every change for a live, un-persisted preview via the real Computation Engine — no separate "preview logic," it's the same engine a saved report uses.

## CRUD actions

`listReportsAction`, `getReportAction`, `createReportAction`, `updateReportAction`, `archiveReportAction`, `restoreReportAction` — each gated on the appropriate `reports.*` permission (see `reporting-permissions.md`) and each records a Timeline event (`report_created`, `report_updated`, `report_archived`, `report_restored`).

## Computation actions

- `previewReportAction(definition)` — in-memory only, no persistence, no Timeline event. Used by the Builder's live preview.
- `computeReportAction(id)` — loads a saved report, computes it, records `report_viewed` on the Timeline, and returns `ComputedSavedReport` (the `SavedReport` plus its `ComputedReport`).

Both call `recordReportComputationDuration()` so every computation — preview or saved — feeds the same real performance-measurement ring buffer behind the Reporting Health Engine's `performance` category.

## Generic Favorites/Recent Items reuse

`reportingActions.ts` deliberately does **not** duplicate favorite/pin/recent-item actions. `"report"` was added to the shared `EntityType` (Checkpoint 38's Smart Workspace `EntityType` union), so a saved report is favorited/pinned/recently-viewed through the exact same generic actions every other entity type uses (`modules/workspace/workspaceActions.ts`) — one Favorites system, not a Reporting-specific one.
