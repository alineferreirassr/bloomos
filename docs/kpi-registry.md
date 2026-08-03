# KPI Registry (v2 Checkpoint 23, Step 16)

The spec's Step 16 names a "KPIRegistry" as one of the checkpoint's reusable services. BloomOS already has one: Checkpoint 15's **Metric Registry** (`src/core/analytics/metricRegistry.ts`) — a private `Map<string, MetricDefinition>` with `registerMetric`/`unregisterMetric`/`getMetric`/`listMetrics`/`listMetricsByCategory`/`resetMetricRegistry`. Checkpoint 23 extends this registry rather than building a second, parallel one — see `docs/analytics.md` for the registry's full original design (self-registering metrics, `MetricDefinition`'s permission/role/feature-flag visibility gates, the `compute`/`refreshPolicy` fields).

## What changed

`METRIC_CATEGORIES` (`src/types/analytics.ts`) gained three categories: **`finance`**, **`operations`**, **`health`** — alongside the original 7 (`revenue`, `clients`, `events`, `documents`, `workflow`, `ai`, `portal`). `AnalyticsDashboardView.tsx`'s `CATEGORY_TABS` gained matching Finance and Operations tabs.

## Why the 16 new Executive Dashboard KPIs are *not* registered as `MetricDefinition`s

This is a deliberate scope decision, not an oversight. The Metric Registry's `MetricDefinition.compute` is a `(context) => Promise<MetricComputeResult>` designed for **one metric computed independently of the others** — the Engine's `computeVisibleMetrics()` runs every visible metric's `compute()` in parallel and isolates failures, which is the right shape for a dashboard of unrelated KPIs (Revenue this week, Documents generated, Portal logins) that don't share intermediate state.

The Executive Dashboard's 16 widgets are the opposite: they're all derived from **one shared fetch** (`getExecutiveDashboardData.ts`'s single `Promise.all` over Contracts/Invoices/Payments/Expenses/Events/Leads/Inventory/Operations data) specifically *because* computing them independently would mean 16 separate metric `compute()` calls each re-fetching largely the same underlying records — a real N+1 regression the spec's own "avoid duplicated calculations" principle warns against. Registering them as 16 individual `MetricDefinition`s would force either (a) 16x redundant fetching, or (b) a shared cache/memoization layer the Metric Registry was never designed to support (`refreshPolicy: "cacheable"` is a declared-but-unimplemented intent, not a working cache — see `docs/analytics.md`'s "Future caching" section).

So: the **category taxonomy** is reused (finance/operations/health are now real registry categories, immediately available to any future Checkpoint that wants to register a single, independent metric under them), but the **16-widget aggregate** is its own purpose-built function, following the same "one aggregate, computed fresh" shape `getAnalyticsDashboardData.ts`, `getBloomAIOverview.ts`, and `getAutomationDashboardData.ts` already established, rather than 16 registry entries.

## What a future metric in these categories would look like

Nothing prevents a future checkpoint from registering a genuinely standalone metric under `finance`/`operations`/`health` the normal way — e.g., a single "Days Sales Outstanding" metric that doesn't need to share a fetch with anything else. It would follow the exact same self-registration pattern as `revenueMetrics.ts`/`clientMetrics.ts`: its own file under `src/modules/analytics/metrics/`, exporting an idempotent `register*Metrics()` loader called from `registerBuiltinMetrics.ts`.

## Registry-adjacent constants this checkpoint added

Not registry entries, but the same "one typed, closed list; the UI iterates it, never hand-enumerates" discipline the registry itself models:

- `EXECUTIVE_DASHBOARD_WIDGET_IDS` / `EXECUTIVE_DASHBOARD_WIDGET_LABELS` (`executiveWidgets.ts`) — the 14 fixed numeric-KPI widget identifiers used by the layout customization feature.
- `REVENUE_BREAKDOWN_DIMENSIONS` / `GOAL_METRICS` / `BENCHMARK_PERIODS` / `EXECUTIVE_INSIGHT_CATEGORIES` / `DRILL_DOWN_KINDS` / `BUSINESS_HEALTH_DIMENSIONS` (`src/types/businessIntelligence.ts`) — every other closed vocabulary this checkpoint introduced, all following the registry's own "a `const` array plus a label map, never a hardcoded switch in a component" convention.
