# Period Comparison Engine

`core/reporting/periodEngine.ts` — resolves a report's time window and, if requested, its comparison window.

```ts
resolveReportWindow(periodKey: ReportPeriodKey, customWindow: TimeWindow | null, now?: Date): TimeWindow
resolveReportPeriod(periodKey: ReportPeriodKey, customWindow: TimeWindow | null, now?: Date): ReportPeriod
buildReportComparison(currentWindow: TimeWindow, mode: ReportComparisonMode, customComparisonWindow?: TimeWindow | null): ReportComparisonResult
```

`ReportPeriodKey` covers the standard rolling/calendar windows (`7d`, `30d`, `90d`, `mtd`, `qtd`, `ytd`, `custom`, etc. — see `types/reporting.ts`). `ReportComparisonMode` is `"none" | "previous_period" | "previous_year" | "custom"`.

## Honest about incomparable periods

```ts
export interface ReportComparisonResult {
  mode: ReportComparisonMode;
  currentWindow: TimeWindow;
  comparisonWindow: TimeWindow | null;
  comparable: boolean;
  missingPeriodReason: string | null;
}
```

`buildReportComparison()` sets `comparable: false` and a real `missingPeriodReason` (e.g. "previous_year comparison requires at least 12 months of history") rather than silently computing a comparison window that predates the workspace's own creation, or fabricating a `changePercent` against a period with no real data. `ReportDetailView` renders this as an explicit "comparison unavailable" banner instead of hiding the comparison controls or showing a misleading 0% change.

## Where it's used

`computeReport()` calls `resolveReportPeriod()`/`buildReportComparison()` once per report evaluation; every metric's `changePercent`/`trend`/`previousValue` in the resulting `ComputedReport` derives from the same single comparison window — comparisons are computed once, centrally, never re-derived per metric with potentially inconsistent windows.
