# Dimensions + Filters

## Dimensions (`ReportDimensionKey`, `types/reporting.ts`)

25 registered dimension keys a report can group or break down by: `time`, `day`, `week`, `month`, `quarter`, `year`, `client`, `lead`, `event`, `service`, `proposal`, `contract`, `invoice`, `payment_status`, `owner`, `team_member`, `worker`, `vendor`, `asset_type`, `workflow`, `notification_category`, `journey_stage`, `health_band`, `status`, `workspace`. `listReportDimensionsAction()` surfaces the full list to the Report Builder UI; dimensions are descriptive vocabulary consumed by `resultGrouping.ts`'s `groupReportValues()`, not a second query language.

## Filters (`ReportFilterKey`, `types/reporting.ts`)

14 filter keys: `date_range`, `status`, `owner`, `team`, `category`, `client`, `service`, `event`, `priority`, `health`, `readiness`, `archived`, `tags`, `amount_range`. A `ReportFilterValue` is a `string | string[] | boolean | {min,max} | {start,end}` — no free-form query string, no SQL.

## `core/reporting/filterEngine.ts`

```ts
validateReportFilters(filters: ReportFilter[], metric: Pick<ReportMetricDefinition, "supportedFilters">): ValidatedReportFilters
```

Splits a report's requested filters into `applicable` (the metric declares support for that key) and `unsupported` (silently dropped, surfaced as a `ReportSourceDiagnostic` with `status: "partial"` rather than silently ignored or thrown). **Filters carry no query semantics of their own** — the engine never builds a WHERE clause. A metric's own `compute()` decides how (or whether) to honor a filter, using the exact same permission-checked repository access it always used. This is a deliberate boundary: the Reporting Platform cannot be used to bypass a module's own access rules, because it never queries a module's data directly — it only asks the module's own metric function to compute, optionally filtered.

## Sorting + grouping (`core/reporting/resultGrouping.ts`)

```ts
sortReportValues(values: ReportMetricValue[], sort: ReportSort | null): ReportMetricValue[]
groupReportValues(values: ReportMetricValue[], grouping: ReportGrouping | null): ReportValueGroup[]
```

Pure, in-memory operations over an already-computed `ReportMetricValue[]` — sorting by value/label/trend, optional grouping by a `ReportDimensionKey`. Neither function re-queries anything; both operate purely on the Computation Engine's output.
