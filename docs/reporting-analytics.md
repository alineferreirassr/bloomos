# Reporting Analytics Engine

`core/reporting/reportingAnalyticsEngine.ts` — `computeReportingAnalytics(input)` measures usage of the Reporting Platform itself: how many reports exist, how they're used, which metrics/filters are popular, and where reports are failing to produce data.

## Metrics computed

- `reportsCreated` — total non-archived saved reports.
- `reportsSaved` vs. `templatesUsed` — split by whether `source_template_id` is `null` (built from scratch) or set (built from a template).
- `reportsFavorited` / `reportsPinned` — read from the generic Favorites store's `entity_type: "report"` entries, not a Reporting-specific favorites table.
- `snapshotsGenerated` — count of all snapshots.
- `reportsViewed` / `mostViewedReports` — derived from Smart Workspace's own `WorkspaceRecentItem` entries where `action === "view"` and `entity_type === "report"` — the exact same Recent Items data every other entity type's "most viewed" ranking uses.
- `mostUsedMetrics` / `mostUsedFilters` — tallied by walking every report's own `sections[].metricIds` and `filters[]`.
- `noDataReports` / `failedReportSources` — computed from each report's **latest** snapshot only (a report that failed last month but succeeds today isn't flagged) by counting `diagnostics` entries with `status !== "ok"`.
- `averageGenerationTimeMs` — the mean of real `recentDurationsMs` samples, or `null` when no computations have happened yet (never a fabricated 0).

## Why this composes rather than duplicates

Every input to `computeReportingAnalytics()` is data the platform already owns for other purposes — Favorites, Recent Items, Snapshots, the performance ring buffer. The engine's only original logic is the tallying/ranking itself; it introduces no new persistence and no new "usage tracking" system running in parallel to Smart Workspace's existing one.

## Where it's surfaced

`evaluateReportingAnalyticsAction()` powers the analytics KPI summary on both `/reports` (`ReportsDashboardView`) and `/reports/analytics` (`ReportingAnalyticsView`).
