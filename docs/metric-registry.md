# Metric Registry

`core/reporting/metricRegistry.ts` — the self-registering `Map<string, ReportMetricDefinition>` every report's sections reference by `metricIds`. Same registry shape as every other registry in this codebase (Template Registry, Node Registry, Widget Registry).

```ts
export function registerReportMetric(metric: ReportMetricDefinition): void;
export function getReportMetric(id: string): ReportMetricDefinition | undefined;
export function listReportMetrics(): ReportMetricDefinition[];
export function resetReportMetricRegistry(): void; // test-only
```

## `ReportMetricDefinition`

Additive to (not a replacement for) `core/analytics/metricRegistry.ts`'s `MetricDefinition` — carries an `id`, `label`, `category` (`ReportCategory`), `unit`, an async `compute(workspaceId, period)` returning a value (or `null` with a `notApplicableReason`), and `requiredPermissions: Permission[]` used by the 3-gate visibility contract in `discovery.ts`.

## Two sources, one registry: the superset-adapter pattern

`registerBuiltinReportMetrics()` (`modules/reporting/registerBuiltinReportMetrics.ts`) populates the registry from two places:

1. **Adapted analytics metrics** — `core/reporting/metricAdapters.ts`'s `adaptRegisteredAnalyticsMetrics()` walks every metric already registered in `core/analytics/metricRegistry.ts` (Checkpoint 15's Analytics Platform) and wraps each one in a `ReportMetricDefinition` via `adaptMetricDefinition()`, prefixed `analytics.*` (e.g. `analytics.revenue.total`, `analytics.workflow.failureRate`, `analytics.clients.conversionRate`). The adapter calls the original metric's own `compute()` — it never recomputes anything.

2. **New reporting-native metrics** — 28 metrics across 6 domain files in `modules/reporting/metrics/`, for domains that had real repository data but no metric registered anywhere yet:

| File | Metrics |
|---|---|
| `assetMetrics.ts` (4) | `assets.total`, `assets.total_storage`, `assets.unused_count`, `assets.health_score` |
| `commercialMetrics.ts` (10) | `commercial.proposal_count`, `.proposal_acceptance_rate`, `.proposal_average_value`, `.contract_count`, `.contract_completion_rate`, `.invoice_count`, `.invoice_outstanding_balance`, `.invoice_average_value`, `.journey_conversion_rate`, `.journey_deposit_completion_rate` |
| `communicationMetrics.ts` (4) | `communication.notifications_created`, `.notification_engagement_rate`, `.notifications_unread`, `.health_score` |
| `executiveMetrics.ts` (4) | `executive.overall_score`, `.objectives_operational_score`, `.business_health_knowledge_graph`, `.business_health_finance_crm` |
| `searchMetrics.ts` (3) | `search.total_searches`, `.success_rate`, `.health_score` |
| `workforceMetrics.ts` (4) | `workforce.worker_count`, `.team_count`, `.active_assignment_count`, `.equipment_utilization_rate` |

Every one of these reads from an existing `lib/data` accessor or an existing engine's already-computed report (e.g. `executive.business_health_knowledge_graph` reads the real `computeBusinessHealth()` composite from Checkpoint 25/25.6, `search.health_score` reads Checkpoint 40's `computeSearchHealth()`) — none introduces new derivation logic.

## Why no new metrics for some named domains

The checkpoint's own template list named domains this checkpoint did **not** add metrics for — Client Portal Engagement, Event Performance, Dispatch Performance, Route Efficiency, Vendor Performance, Knowledge Health. Each would require either fabricating a metric with no real backing data or building genuinely new aggregation logic outside this checkpoint's own "adapt or read, never invent" discipline. See `report-templates.md` for the full list of templates honestly not built as a result.
