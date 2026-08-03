# Financial Forecast Engine (v2 Checkpoint 23, Step 8)

`src/core/analytics/forecastEngine.ts` provides the Financial Forecast panel and the Executive Dashboard's revenue projection. Spec requirement: **"No external AI"** — every value here comes from plain arithmetic over already-aggregated historical points (`MetricSeriesPoint[]`, the same shape `groupByMonth`/`groupByWeek`/`groupByDay` produce), never a model call. This is a deliberately different lineage from `generateAnalyticsExecutiveSummary` (Checkpoint 15) or `generateExecutiveBrief` (Checkpoint 20) — those narrate; this one computes, and it computes with a fixed formula a reader could reproduce by hand.

## Two methods

### `forecastLinearRegression(historical, periodsAhead)`

Fits `y = slope·x + intercept` over the historical points via ordinary least squares (`x` = period index, oldest first), then projects `periodsAhead` further points from that line.

- **0 historical points** — returns an empty projection with an explicit note (`"No historical data available to forecast from."`) rather than projecting from nothing.
- **1 historical point** — cannot fit a line through a single point, so the projection holds that one value flat forward, with a note saying exactly that (`"Only one historical period available — projection holds that value flat rather than fabricating a trend."`).
- **2+ points** — a real OLS fit. Every projected value is floored at `0` (`Math.max(0, ...)`) — a negative forecast for a revenue series is nonsensical, the same "never fabricate an impossible value" discipline `compareTrend` already applies to percentage changes elsewhere in the Analytics Engine.

Used for: the Executive Dashboard's revenue forecast (6 trailing months of collected-revenue history, projected 3 months ahead) and the Financial Forecast panel's revenue/expense/profit projections.

### `forecastMovingAverage(historical, periodsAhead, windowSize = 3)`

The trailing average of the last `windowSize` periods, held flat forward. Used where a trend line would overreact to one volatile period rather than smooth over it — the Financial Forecast panel's seasonality-sensitive projections (e.g., busy-month inventory needs) use this instead of linear regression.

## Confidence

`confidenceFor(pointCount)` — `high` at 6+ historical points, `medium` at 3–5, `low` below 3. Every `ForecastResult` carries this alongside a plain-English `note` stating the method and how many points it was fit from, so nothing on screen implies more certainty than the underlying history supports.

## Label continuity across period formats

`labelForNextPeriod(lastLabel, offset)` handles both label formats the Analytics Engine's bucketers produce — `"YYYY-MM"` for month buckets and `"YYYY-MM-DD"` for day/week buckets — detected via a regex on the last historical label, so a caller never has to tell the forecast engine which bucket size it's extending.

## Testing

`forecastEngine.test.ts` covers: empty history, single-point history, a real multi-point OLS fit (verified against a hand-computed slope/intercept), the zero-floor on a declining series, both label formats, and all three confidence tiers.
