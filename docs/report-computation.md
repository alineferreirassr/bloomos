# Report Computation Engine

`core/reporting/computationEngine.ts` — the one deterministic engine every report, preview, snapshot, and template runs through. `computeReport(report, workspaceId, permissions)` → `ComputedReport`.

```ts
export interface ComputedReport {
  widgets: ReportWidget[];
  comparison: ReportComparisonResult;
  diagnostics: ReportSourceDiagnostic[];
  sourceTimestamps: Record<string, string>;
  totalDurationMs: number;
}
```

## Never let one bad source blank the whole report

For every metric in every section, the engine:

1. Looks up the `ReportMetricDefinition` in the registry.
2. Checks the 3-gate visibility contract (permission → role → feature flag, identical to `core/analytics/discovery.ts`) — if the requesting member can't see this metric, it's silently omitted from the widget and never appears in `diagnostics` as an error (it's not a failure, it's a visibility boundary).
3. Wraps the metric's own `compute(workspaceId, period)` call in a `try/catch`.
4. On success: a `ReportMetricValue` (value, previous value, `changePercent`, trend, optional series/breakdown).
5. On thrown error, `notApplicableReason`, or a filter the metric doesn't support: a `ReportSourceDiagnostic` with `status: "unavailable" | "stale" | "partial"` and a human `message` — never a blank UI, never a silent zero.

This is the same discipline every prior BloomOS engine uses for cross-source composition (Business Health, Executive Reports) — a report with 8 metrics and 1 broken source still renders the other 7, with the 8th's diagnostic visible.

## `totalDurationMs` — real, measured, never fabricated

The whole `computeReport()` body is wrapped in `Date.now()` measurement. This number is fed into `lib/data/core/reporting/performanceSamplesStore.ts`'s ring buffer by every caller (`previewReportAction`, `computeReportAction`), which in turn feeds the Reporting Health Engine's `performance` category — an honest, self-measuring loop with no hardcoded or guessed timing values anywhere.

## Where filters, sorting, and grouping happen

`computeReport()` calls `validateReportFilters()` (see `report-filters.md`) before invoking each metric's `compute()`, then `sortReportValues()`/`groupReportValues()` (see same doc) on the resulting `ReportMetricValue[]` per section — computation, filtering, and presentation ordering are three separable, independently-testable steps, not one monolithic function.
