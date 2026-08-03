import type { MetricSeriesPoint } from "@/types/analytics";
import type { ForecastConfidence, ForecastResult } from "@/types/businessIntelligence";

/**
 * v2 Checkpoint 23, Step 8 — Financial Forecast. Deterministic only (spec:
 * "No external AI") — a plain linear-regression fit over the trailing
 * historical buckets `groupByMonth`/`groupByWeek`/`groupByDay` already
 * produce, extrapolated forward. This is intentionally simple and
 * explainable rather than a black box: every projected point is `slope *
 * periodIndex + intercept`, and the `note` field always states the method
 * and how many historical points it was fit from, so nothing here is
 * presented as more certain than it is.
 */

function labelForNextPeriod(lastLabel: string, offset: number): string {
  // "YYYY-MM" (month) vs "YYYY-MM-DD" (day/week) — both sort/parse correctly via Date.
  if (/^\d{4}-\d{2}$/.test(lastLabel)) {
    const [year, month] = lastLabel.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    return next.toISOString().slice(0, 7);
  }
  const next = new Date(lastLabel);
  next.setUTCDate(next.getUTCDate() + offset * 7);
  return next.toISOString().slice(0, 10);
}

function confidenceFor(pointCount: number): ForecastConfidence {
  if (pointCount >= 6) return "high";
  if (pointCount >= 3) return "medium";
  return "low";
}

/**
 * Fits `y = slope*x + intercept` over `historical` (x = 0..n-1, oldest
 * first) via ordinary least squares, then projects `periodsAhead` further
 * points. Never projects below `0` — a negative forecast for a money/count
 * series would be nonsensical, so it's floored, same "never fabricate an
 * impossible value" discipline `compareTrend` already applies to percentages.
 */
export function forecastLinearRegression(historical: MetricSeriesPoint[], periodsAhead: number): ForecastResult {
  const n = historical.length;
  if (n === 0) {
    return { method: "linear_regression", historical, projected: [], confidence: "low", note: "No historical data available to forecast from." };
  }
  if (n === 1) {
    const flat = Array.from({ length: periodsAhead }, (_, i) => ({ label: labelForNextPeriod(historical[0].label, i + 1), value: historical[0].value }));
    return { method: "linear_regression", historical, projected: flat, confidence: "low", note: "Only one historical period available — projection holds that value flat rather than fabricating a trend." };
  }

  const xs = historical.map((_, i) => i);
  const ys = historical.map((point) => point.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const numerator = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  const lastLabel = historical[n - 1].label;
  const projected = Array.from({ length: periodsAhead }, (_, i) => {
    const x = n + i;
    const value = Math.max(0, Math.round(slope * x + intercept));
    return { label: labelForNextPeriod(lastLabel, i + 1), value };
  });

  return {
    method: "linear_regression",
    historical,
    projected,
    confidence: confidenceFor(n),
    note: `Linear trend fit over ${n} historical period${n === 1 ? "" : "s"}; treat as directional, not a guarantee.`,
  };
}

/** Simpler alternative fit — the trailing average of the last `windowSize` periods held flat forward. Used where a trend line would overreact to one volatile period (e.g. `busyMonths`/`inventoryNeeds` seasonality forecasts). */
export function forecastMovingAverage(historical: MetricSeriesPoint[], periodsAhead: number, windowSize = 3): ForecastResult {
  const n = historical.length;
  if (n === 0) {
    return { method: "moving_average", historical, projected: [], confidence: "low", note: "No historical data available to forecast from." };
  }
  const trailing = historical.slice(-windowSize);
  const average = Math.round(trailing.reduce((sum, point) => sum + point.value, 0) / trailing.length);
  const lastLabel = historical[n - 1].label;
  const projected = Array.from({ length: periodsAhead }, (_, i) => ({ label: labelForNextPeriod(lastLabel, i + 1), value: average }));

  return {
    method: "moving_average",
    historical,
    projected,
    confidence: confidenceFor(n),
    note: `${trailing.length}-period moving average (${average.toLocaleString()}) held flat forward.`,
  };
}
