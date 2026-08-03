# Analytics Engine Extension (v2 Checkpoint 23, Step 16)

`src/core/analytics/engine.ts` — built in Checkpoint 15 as the one place calculation logic lives — is also the spec's own named "AnalyticsEngine." Checkpoint 23 extends it rather than standing up a second, parallel engine: every new time-series/dimension aggregation the Business Intelligence Platform needs was added here, alongside the original `resolveTrendWindow`/`filterInWindow`/`sumBy`/`groupByDay`/`compareTrend`/`computeVisibleMetrics`.

## What was added

- **`groupByWeek(records, dateSelector, valueSelector, window)`** — buckets by ISO week (Monday-start), zero-filling every week that falls inside `window` even if no record lands in it, the same "a chart never silently skips a gap" guarantee `groupByDay` already gives.
- **`groupByMonth(records, dateSelector, valueSelector, window)`** — buckets by calendar month (`YYYY-MM` labels), zero-filled the same way. This is what feeds the Financial Forecast's trailing-months history (`getExecutiveDashboardData.ts`) and every "by month" Revenue Analytics breakdown.
- **`DimensionBreakdownRow`** (`{ key, label, value }`) and **`groupByKey(records, keySelector, labelSelector, valueSelector)`** — the generic non-time grouping helper. Unlike the time bucketers, a dimension breakdown (by client, by event, by lead source, by team member) has no fixed universe of keys to zero-fill against, so `groupByKey` instead sorts its output descending by `value` — the "show what matters most first" convention every dimension table in Revenue Analytics, Profitability Center, and Client Intelligence relies on.

All three follow the exact accumulation pattern `groupByDay` established: build a zero-valued bucket map first (for the two time bucketers), then add each record's value into its bucket, then serialize to a sorted array. No new aggregation *style* was introduced.

## Why extension, not a new engine

The spec's Step 16 explicitly asks for "reusable services... avoid duplicated calculations." A second `BusinessIntelligenceEngine` with its own grouping logic would have meant two independent implementations of "bucket records into time windows" that could silently drift — different rounding, different week-start conventions, different empty-bucket handling. Every BI panel that needs a time series or a ranked breakdown calls the same three functions the Executive Dashboard, Revenue Analytics, and Operations Analytics all share.

## Who calls it

| Function | Callers |
|---|---|
| `groupByMonth` | `getExecutiveDashboardData.ts` (forecast history), `getRevenueBreakdown.ts` ("by month" dimension), `getFinancialForecastData.ts` |
| `groupByWeek` | `getRevenueBreakdown.ts` ("by week" dimension) |
| `groupByKey` | `getRevenueBreakdown.ts` (event/client/source/team dimensions, via the `toRevenueRows` helper), `getProfitabilityData.ts` (service ranking, via `allocateAcrossEventServices`) |

## Testing

`engine.test.ts` gained new `describe` blocks for all three functions, covering: zero-fill across an empty window, correct bucket-boundary assignment (a record landing exactly on a week/month boundary), and `groupByKey`'s descending sort with a tie-breaking case.
