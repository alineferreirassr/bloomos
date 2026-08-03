import type { ReportFilter } from "@/types/reporting";
import type { ReportMetricDefinition } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42, Step 3 — Filters. Pure — never touches a data
 * source. A filter can never silently do nothing: `validateReportFilters`
 * splits the caller's requested filters into `applied` (the metric itself
 * declared support for this filter key, via `supportedFilters`) and
 * `ignored` (it didn't) — the Computation Engine surfaces `ignored` as a
 * real `ReportSourceDiagnostic`, never a filter that looks honored but
 * wasn't. "Filters must never bypass module permissions" (this
 * checkpoint's own instruction) holds trivially here: a filter is only
 * ever handed to a metric's own already-permission-scoped `compute()` —
 * this engine has no query language and touches no repository, so there
 * is nothing for a filter expression to bypass.
 */

export interface ValidatedReportFilters {
  applied: ReportFilter[];
  ignored: ReportFilter[];
}

export function validateReportFilters(filters: ReportFilter[], metric: Pick<ReportMetricDefinition, "supportedFilters">): ValidatedReportFilters {
  const applied: ReportFilter[] = [];
  const ignored: ReportFilter[] = [];
  for (const filter of filters) {
    if (metric.supportedFilters.includes(filter.key)) applied.push(filter);
    else ignored.push(filter);
  }
  return { applied, ignored };
}
