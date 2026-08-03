import type { ReportGrouping, ReportMetricValue, ReportSort } from "@/types/reporting";

/**
 * v2.0 Checkpoint 42, Step 3/4 — Grouping and sorting over an
 * already-computed `ReportMetricValue[]` (the Report Computation Engine's
 * own output), never over raw records — each metric's own `compute()`
 * already resolved its data through its real source module; this file
 * only orders and buckets what came back. Pure.
 */

export function sortReportValues(values: ReportMetricValue[], sort: ReportSort | null): ReportMetricValue[] {
  if (!sort) return values;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...values].sort((a, b) => {
    if (sort.field === "value") return ((a.value ?? -Infinity) - (b.value ?? -Infinity)) * direction;
    if (sort.field === "changePercent") return ((a.changePercent ?? -Infinity) - (b.changePercent ?? -Infinity)) * direction;
    return a.label.localeCompare(b.label) * direction;
  });
}

export interface ReportValueGroup {
  key: string;
  values: ReportMetricValue[];
}

/**
 * Buckets by `value.breakdown`'s own keys when the requested dimension
 * matches something a metric already broke itself down by (e.g.
 * `groupBy.dimension === "client"` against a metric whose `breakdown` is
 * per-client); a metric with no matching breakdown contributes its own
 * single un-grouped bucket labeled by its own `label` — never fabricates
 * a dimension a metric didn't actually compute.
 */
export function groupReportValues(values: ReportMetricValue[], grouping: ReportGrouping | null): ReportValueGroup[] {
  if (!grouping) return [{ key: "all", values }];
  const groups = new Map<string, ReportMetricValue[]>();
  for (const value of values) {
    if (value.breakdown.length === 0) {
      const bucket = groups.get(value.label) ?? [];
      bucket.push(value);
      groups.set(value.label, bucket);
      continue;
    }
    for (const entry of value.breakdown) {
      const bucket = groups.get(entry.label) ?? [];
      bucket.push({ ...value, value: entry.value, label: `${value.label} — ${entry.label}` });
      groups.set(entry.label, bucket);
    }
  }
  return [...groups.entries()].map(([key, groupedValues]) => ({ key, values: groupedValues }));
}
