# Reporting Health Engine

`core/reporting/reportingHealthEngine.ts` — `computeReportingHealth(input)` measures the operational health of the Reporting Platform itself. It is **not** a 21st business-health composite; it answers "is the Reporting Platform working correctly," not "is the business healthy."

## 7 categories

| Category | What it checks |
|---|---|
| `metric_coverage` | Are registered metrics spread across enough categories, or is coverage thin in some domains? |
| `source_availability` | Across recent computations, how often do metric sources return `ok` vs. `unavailable`? |
| `source_freshness` | Are `sourceTimestamps` recent, or is a source silently stale? |
| `permission_configuration` | Do finance/executive metrics specifically declare a non-empty `requiredPermissions`? (A financial metric with no permission gate is a real misconfiguration this category catches.) |
| `template_coverage` | Are templates registered across enough of the platform's categories? |
| `snapshot_integrity` | Are there orphaned snapshots (pointing at a `report_id` that no longer resolves to a report)? |
| `performance` | Scored from real, measured `recentDurationsMs` — see below |

## Performance scoring is measured, not guessed

```
≤300ms  → 100
≤800ms  → 80
≤2000ms → 55
≤5000ms → 30
else    → 10
```

`recentDurationsMs` comes from `lib/data/core/reporting/performanceSamplesStore.ts` — a per-workspace ring buffer (`MAX_SAMPLES_PER_WORKSPACE = 20`) populated by every real `computeReport()` call via `recordReportComputationDuration()`. If a workspace has never computed a report, the `performance` category has no samples to score and says so honestly rather than defaulting to a fabricated 100.

## Where it's surfaced

`evaluateReportingHealthAction()` powers the health section of `/reports/analytics` (`ReportingAnalyticsView`). It follows the same category/score/status shape every other health engine in BloomOS uses (Business Health, Search Health, Notification Health, Workflow Health) — same conventions, new domain.
