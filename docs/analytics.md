# Executive Analytics Platform

The Analytics Platform is BloomOS's own executive dashboard for Workspace owners — a single, cross-module view of business performance, financial health, client health, workflow activity, document activity, and Portal engagement. It is not a reporting page and not a collection of hand-built charts: every number on it comes from a self-registering **Metric**, computed by a generic **Analytics Engine**, over data every other module already owns. No business logic is duplicated anywhere in this checkpoint.

```
Analytics Dashboard (UI)
       ↓
Analytics Services (getAnalyticsDashboardData.ts, generateAnalyticsExecutiveSummary.ts)
       ↓
Metrics Registry + Analytics Engine (core/analytics/)
       ↓
Existing BloomOS Modules — CRM · Finance · Workflow · Documents · Client Portal · AI
```

## Step 1 — Metrics Registry

`src/core/analytics/metricRegistry.ts` is a private `Map<string, MetricDefinition>` — the exact same shape as every other registry in this codebase (`core/ai/skills/registry.ts`, `core/automation/registry.ts`, `core/workflow/nodeRegistry.ts`): `registerMetric`/`unregisterMetric`/`getMetric`/`listMetrics`/`listMetricsByCategory`/`resetMetricRegistry`, never a class, never exported directly.

A `MetricDefinition` (`src/types/analytics.ts`) carries:

| Field | Purpose |
|---|---|
| `id` / `name` / `description` | identity and display copy |
| `category` | one of the 7 closed categories — `revenue`, `clients`, `events`, `documents`, `workflow`, `ai`, `portal` — each its own dashboard tab |
| `unit` | `currency` \| `count` \| `percent` \| `duration_ms` — tells the UI how to format `value`, the Engine never formats |
| `icon` | a plain string name resolved by `modules/analytics/components/metricIcons.ts`, never a component reference — keeps the registry importable server-side, same discipline as `modules/workflow/canvas/nodeIcons.ts` |
| `requiredPermissions` / `featureFlag` / `minimumRole` | **visibility** — Step 10's own "metrics visibility aware" |
| `refreshPolicy` | `realtime` \| `cacheable` — Step 1's own "future caching," a declared intent this checkpoint doesn't yet act on (see "Future caching" below) |
| `compute` | `(context) => Promise<MetricComputeResult>` — always reads through an existing module's own data/aggregation functions, never re-derives their business logic |

Metrics **self-register**: each category has its own file under `src/modules/analytics/metrics/` (`revenueMetrics.ts`, `clientMetrics.ts`, `documentMetrics.ts`, `workflowMetrics.ts`, `portalMetrics.ts`, `aiMetrics.ts`), each exporting its own idempotent `register*Metrics()` loader, all called once from `src/modules/analytics/registerBuiltinMetrics.ts` — the same `let registered = false` guard every other loader in this codebase already uses.

## Step 2 — Analytics Engine

`src/core/analytics/engine.ts` is the one place calculation logic lives — the UI never computes anything itself.

- **Time windows** — `resolveTrendWindow(key, now)` turns a Trend Window key into a real `{start, end}` pair plus the immediately-preceding, equal-length window for comparison. `today`/`year` are calendar-aligned (midnight, January 1st); `7d`/`30d`/`90d` are rolling windows.
- **Aggregation helpers** — `filterInWindow`, `sumBy`, `groupByDay` (buckets by UTC calendar day, filling every day in the window with `0` so a chart never silently skips a gap), all generic over any array with a date-selector and value-selector.
- **Trend comparison** — `compareTrend(current, previous)` distinguishes three cases deliberately: a real percentage change; a real zero-to-something baseline (`trend: "up"`, but `changePercent: null` — no fabricated `Infinity`); and no prior data at all (`trend: "flat"`, `changePercent: null` — a point-in-time snapshot metric like Outstanding Balance never claims a comparison that doesn't exist).
- **Orchestration** — `computeVisibleMetrics(params)` resolves visible metrics (via `discovery.ts`'s `listVisibleMetrics`, filtering by permission/role/feature-flag — the same three-gate pattern `listSkillsForWorkspace`/`listWorkflowNodesForWorkspace` already use), computes each in parallel, and isolates failures: **one broken metric's `compute()` throwing never breaks the rest of the dashboard** — it's logged and returned as a safe zero-valued result instead.
- **Never leaks the registry** — a computed snapshot only ever carries `Pick<MetricDefinition, "id"|"name"|"description"|"category"|"unit"|"icon">`, never the `compute` function itself, since this data crosses a `"use server"` boundary to the browser and functions can't serialize.

## Step 3/4 — Executive Dashboard and KPI Cards

`/analytics` (`src/app/(app)/analytics/`) renders `AnalyticsDashboardView.tsx` — one shared `Tabs` component (the same accessible, keyboard-native `Tabs`/`TabList`/`Tab`/`TabPanel` primitive used elsewhere in the app) with 8 panels: **Overview** plus one per Metrics category. Every panel renders the exact same generic `KpiCard.tsx` grid, driven entirely by a computed `AnalyticsMetricSnapshot` — there is no per-metric hand-built component anywhere. The Overview tab's own KPI grid is a curated subset (`getAnalyticsDashboardData`'s own `overview` field): one headline metric per category that has any visible metrics at all.

`getAnalyticsDashboardData(windowKey)` (`src/modules/analytics/getAnalyticsDashboardData.ts`, `"use server"`) is the one aggregate every Analytics surface reads from — session/permission check, one call to `computeVisibleMetrics`, then grouped by category. Mirrors `getBloomAIOverview.ts`/`getAutomationDashboardData.ts`'s own "one aggregate, computed fresh" shape.

## Step 5 — Trend Analysis

The `TrendWindowPicker` offers exactly Today / 7 Days / 30 Days / 90 Days / Year (`TrendWindowKey`, `src/types/analytics.ts`). Every KPI Card shows its own current value, a trend badge (↑/↓/→ plus a percent), and a screen-reader-only full-sentence description of the comparison. "Comparison" isn't a separate window — every window already carries a period-over-period comparison against the immediately preceding, equal-length prior window.

## Step 6 — AI Analytics (Executive Summary)

`src/modules/analytics/aiSummary/` builds the Executive Summary the same way the Daily Operations Brief already works: **the model never computes a metric, only narrates already-computed ones.**

- `contextBuilder.ts` flattens computed snapshots into a narrow, narrative-only fact list (id/name/category/unit/value/changePercent/trend) — no raw records, ever.
- `schema.ts`'s `analyticsExecutiveSummaryModelOutputSchema` (zod) allows only four string/string-array fields (`executiveSummary`, `operationalRisks`, `performanceHighlights`, `recommendations`) — **no numeric field exists anywhere in the schema**, so the model is structurally incapable of emitting a metric value.
- `promptBuilder.ts`'s system prompt explicitly instructs the model that `BLOOM_ANALYTICS_CONTEXT` is untrusted data, never instructions, and that it is "a narrator, never a calculator."
- Registered as a real Bloom AI Skill (`registerAnalyticsExecutiveSummarySkill.ts`) through the exact same `runSkillCompletion()` pipeline every other Skill uses — no special execution path.
- A new Context Orchestrator section, `analyticsSummaryContext` (`analyticsSummaryContextBuilder.ts`), computes metrics scoped to exactly what the *requesting member* can see — the same Step 10 visibility guarantee the dashboard itself has, not a wider view.
- The `AnalyticsExecutiveSummaryCard` never auto-generates on page load — an explicit "Generate Summary" click, the same human-in-the-loop posture every other Bloom AI Brief/Assistant already uses.

## Steps 7–9 — Workflow, Document, and Portal Analytics

Every metric in these three categories reads through an existing module's own repository/manager, never a duplicated tracking mechanism:

- **Workflow** (`workflowMetrics.ts`) — Executions and Failure Rate read `AutomationExecution` records from `getAutomationManager()` (the same real records `getAutomationDashboardData.ts` already computes stats from — that file's own comment calls a "real analytics rollup" a future checkpoint's job; this is that checkpoint). Simulation Usage reads a new, genuinely persisted `workflowSimulationStore.ts` (mock-only) that `simulateWorkflowAction.ts` now writes to on every real "Run Simulation" click — the Simulator itself (Checkpoint 13) never persisted a run before this.
- **Documents** (`documentMetrics.ts`) — Templates and Documents Generated read `getDocumentsManager()` directly (the real Document Platform, Checkpoint 12). Portal Downloads/Views and Portal Approval Rate read the Client Portal's own Activity/Approval logs (Checkpoint 14) — the only place a real, per-event download/view/decision is persisted today.
- **Portal** (`portalMetrics.ts`) — Logins, Document Views, Checklist Completions, Timeline Views, and Notifications Read all read one shared source: the Client Portal's own Activity log, filtered by `ClientPortalActivityKind`. `portal.documentViews` and `documents.views` deliberately read the same underlying log — the checkpoint's own spec lists "Document views" under both Document Analytics and Portal Analytics, the same real event framed for two dashboards, never a duplicated store.

Two workspace-wide read functions were added to existing Checkpoint 14 mock stores (additive, non-breaking): `listClientPortalActivityForWorkspace()` and `listClientDocumentApprovalsForWorkspace()` — the per-client-account listing functions those stores already had were never meant to answer a cross-client aggregate question.

## Step 10 — Permissions

- **Route-scoped**: a new `analytics.view` permission gates `/analytics` (`core/permissions/routeAccess.ts`), added to `owner`/`admin` (automatic, every permission) and `manager` (`lib/team/permissionMatrix.ts`) — deliberately **not** granted to `staff` by default, reflecting the checkpoint's own framing ("the executive dashboard for Workspace owners"), a departure from the broad "view" permissions every role otherwise gets. A migration (`supabase/migrations/20260808100000_analytics_permission_seed.sql`) seeds this for Supabase mode; written but not applied this session (see Known limitations).
- **Metric-scoped**: each `MetricDefinition` carries its own `requiredPermissions`/`minimumRole` — a Revenue KPI Card never renders for a member without `finance.view`, independent of whether they can see `/analytics` at all.
- **Workspace-scoped**: every compute function reads through `context.workspaceId`, resolved once from the caller's own session, never a client-supplied value.

## Step 11 — Observability

Every metric computation and every dashboard fetch logs through `getLogger()` (`core/observability/logger.ts`), the same structured-JSON convention every other checkpoint's engine uses: `"Metric computed"` (info, per metric, with `durationMs`), `"Metric computation failed"` (error, with the caught error's message, never crashing the caller), `"Analytics dashboard computed"` (info, once per request, with `metricCount`/`windowKey`/`durationMs`). AI summary generation logs `"Analytics Executive Summary generated"`/`"...generation failed"` the same way.

## Step 12 — Accessibility

- **Tabs**: the shared `Tabs`/`TabList`/`Tab`/`TabPanel` primitive already implements the full WAI-ARIA Tabs pattern (roving tabindex, Left/Right/Home/End keyboard navigation, `role="tab"`/`role="tabpanel"`/`aria-selected`/`aria-controls`).
- **KPI Cards**: every trend badge pairs a color/arrow with a full-sentence, screen-reader-only description (`"up 47.7 percent versus the prior period"`) — never color or an arrow alone.
- **Trend window**: a real, native `<select>` with an associated `<label>` — no custom listbox, no extra ARIA needed.
- **Loading states**: wrapped in `aria-live="polite"`/`aria-busy="true"`, matching the convention already established in Checkpoint 14's own accessibility pass.
- **Responsive**: the KPI grid is 1/2/3 columns depending on viewport (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`); the Tab list scrolls horizontally on narrow viewports rather than wrapping or overflowing the page.

## Future caching

`MetricRefreshPolicy` (`"realtime" | "cacheable"`) is a declared intent, not a working cache — every registered metric computes fresh on every request this checkpoint. A metric marked `"cacheable"` is one a future checkpoint could safely memoize per `workspaceId` + `TrendWindowKey` without staleness risk (an all-time total that rarely needs sub-minute freshness, for instance); today the Engine treats both values identically. This field exists so that introducing a real cache later is additive — every metric definition doesn't need to change shape — rather than a breaking change made under time pressure.

## Non-goals (this checkpoint)

Predictive ML, forecasting, an external BI integration, a public API, and a Marketplace were all explicitly out of scope and none were started.

## Known limitations

- **"Most common actions" and "Template usage"** (both explicitly requested under Workflow/Document Analytics) have no queryable historical data source today — `AutomationActionExecutionResult.actionId` exists per execution but summarizing "the single most common one" is a categorical breakdown that doesn't fit this checkpoint's scalar KPI Card model, and no Workflow record tracks which built-in Template it was created from. Both are intentionally left unregistered rather than fabricated, the same "show `—`, never a fake number" precedent `getDashboardMetrics`'s own placeholder rows already established.
- **New Checkpoint 15 tracking (`workflowSimulationStore.ts`) is mock-only**, regardless of `NEXT_PUBLIC_DATA_MODE` — the same precedent every brand-new domain since Checkpoint 13 has followed, since this session has deliberately not pushed new schema to the shared remote Supabase project without explicit confirmation.
- **The `analytics.view` permission migration is written but not applied** to the linked remote project this session, for the same reason.
- **No dedicated `analytics-summary` execution-history store** — unlike the Daily Operations Brief, an Executive Summary generation isn't persisted for later review; only logged via the observability logger. A deliberate scope trim given this checkpoint's own size.
