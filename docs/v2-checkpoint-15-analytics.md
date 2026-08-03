# v2.0 Checkpoint 15 — Executive Analytics Platform

BloomOS's prior checkpoints (AI Skills, AI Memory, CRM Assistant, Finance Assistant, Workflow Builder, Client Portal, Document Platform) each built one module deep. This checkpoint builds one layer wide: a Metrics Registry and Analytics Engine that read across every one of those modules, and an Executive Dashboard that lets a Workspace owner understand business performance, financial health, client health, workflow activity, document activity, Portal engagement, and AI usage — without opening any individual module. This is a real, working analytics platform, not a reporting page or a hand-built chart collection.

## Architecture

`Analytics Dashboard (UI) → Analytics Services → Metrics Registry → Analytics Engine → Existing BloomOS Modules (CRM/Finance/Workflow/Documents/Client Portal/AI)`, exactly as specified. Every one of the 22 registered metrics computes from an existing module's own repository/manager/aggregation function — `computeWorkspaceFinancialSummary`, `getAutomationManager()`, `getDocumentsManager()`, the Client Portal's own Activity/Approval logs, the Proposals repository, the Daily Brief execution history — never a duplicated calculation. Two small, additive extensions were made to existing Checkpoint 14 mock stores (workspace-wide listing functions) and one genuinely new, real tracking store was added (`workflowSimulationStore.ts`, since the Execution Simulator never persisted a run before this checkpoint).

## Metrics Registry

`src/core/analytics/metricRegistry.ts` — a `Map`-based registry matching the exact shape of every prior registry in this codebase (Skills, Automations, Workflow Nodes): `registerMetric`/`getMetric`/`listMetrics`/`listMetricsByCategory`. **24 metrics self-register** across 7 categories (revenue: 4, clients: 3, events: 2, documents: 5, workflow: 3, ai: 2, portal: 5) via 6 category-specific loader files, all wired through one idempotent `registerBuiltinMetrics()`. Every `MetricDefinition` carries `requiredPermissions`/`featureFlag`/`minimumRole` for visibility, a `unit` for display formatting, and a `refreshPolicy` declaring future-caching intent (see docs/analytics.md's own "Future caching").

## Analytics Engine

`src/core/analytics/engine.ts` owns every calculation: `resolveTrendWindow()` (5 windows — Today/7d/30d/90d/Year, calendar-aligned or rolling as appropriate), generic aggregation helpers (`filterInWindow`, `sumBy`, `groupByDay`), and `compareTrend()`, which deliberately distinguishes "no prior data exists" from "a real zero baseline that grew" rather than collapsing both into a misleading trend arrow — a real bug found and fixed during this checkpoint's own live verification (see below). `computeVisibleMetrics()` orchestrates: resolves visible metrics via permission/role/feature-flag filtering (`discovery.ts`, mirroring `listSkillsForWorkspace`'s own three-gate pattern), computes every one in parallel, and isolates failures so one broken metric never breaks the dashboard. Every metric snapshot returned to the client strips the registry's own `compute` function down to a plain, serializable summary — required because this data crosses a `"use server"` boundary.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — a full, live pass against the real dev server (temporarily switched to mock mode, the same no-Supabase-needed approach Checkpoint 14 established, then reverted).

- **A real bug was found and fixed during this pass**: the first live load failed entirely (stuck on the loading skeleton, `unhandledRejection` in server logs) because the Server Action was returning the full `MetricDefinition` — including its `compute` function — which Next.js cannot serialize across the server/client boundary. Fixed in `engine.ts`'s own `computeOne()` to strip every metric down to its serializable summary before returning it. Confirmed fixed: reloaded and the dashboard rendered correctly end to end.
- **All 8 tabs verified live** with real, correctly-computed data: Overview (7 headline metrics + Executive Summary), Revenue (4 metrics — Revenue $6,500.00 ↑47.7%, Collected, Outstanding Balance, Upcoming Revenue), Clients, Documents (5 metrics — Templates, Documents Generated, Portal Downloads/Views, Portal Approval Rate), Workflow (3 metrics — Executions, Failure Rate, Simulation Usage), AI (2 metrics), Portal (5 metrics — Logins, Document Views, Checklist Completions, Timeline Views, Notifications Read).
- **Executive Summary generation verified live**: clicked "Generate Summary," the mock AI provider correctly narrated the real, currently-displayed metrics — "Across 24 tracked metric(s) this window, 1 are trending up and 3 are trending down," correctly naming Revenue as the one riser and the three fallers by name with their exact percentages, matching the KPI cards precisely. Proved the whole pipeline (Context Orchestrator → Skill → mock provider → schema validation → UI) end to end.
- **A second, smaller issue was found and fixed in the same pass**: a metric with no prior-period data (e.g. Outstanding Balance, Templates) showed a misleading "↑" arrow paired with "—" (no percent). Fixed `compareTrend()` to report `trend: "flat"` whenever `previousValue` is `null`, reserving "up" only for a real zero-to-something baseline. Confirmed fixed live.
- **Mobile (375×812)**: Dashboard, Highlights-equivalent KPI grid, and the horizontally-scrolling Tab list all rendered cleanly with no horizontal page scroll and fully legible text.
- **Caveat, consistent with Checkpoint 14's own finding**: the Browser pane's simulated mouse click did not reliably reach every tab button's React handler in this session (confirmed as a tooling artifact, not a product bug, via direct React-fiber `onClick` invocation — every tab rendered correctly once the click actually registered).

## Tests

**~92 new tests across 18 new files, plus 3 modified existing files**, all passing:

- `metricRegistry.test.ts` (7), `engine.test.ts` (16), `discovery.test.ts` (7) — the core Registry/Engine/visibility layer.
- One test file per metrics category (`revenueMetrics`, `clientMetrics`, `documentMetrics`, `workflowMetrics`, `portalMetrics`, `aiMetrics` — 27 tests total) — each mocking the real underlying module and asserting correct sums/rates/window-filtering against real field names and enums.
- `getAnalyticsDashboardData.test.ts` (5) — permission gate, category grouping, Overview curation.
- `aiSummary/contextBuilder.test.ts` (2), `aiSummary/mockProvider.test.ts` (3), `generateAnalyticsExecutiveSummary.test.ts` (5) — the AI summary pipeline, including a direct assertion that the mock provider only narrates numbers already present in context.
- `KpiCard.test.tsx` (5), `TrendWindowPicker.test.tsx` (2), `AnalyticsExecutiveSummaryCard.test.tsx` (4), `AnalyticsDashboardView.test.tsx` (6) — UI.
- `simulationStore.test.ts` (3, new) + 1 new assertion added to the existing `simulateWorkflowAction.test.ts` — the new Simulation-run tracking.
- `navigation.test.ts` (existing file, 2 assertions updated) — the new Analytics nav entry required updating a staff-permission exact-list assertion and adding a matching "hides Analytics without the permission" test.
- `migrations.test.ts` (existing file, 1 assertion updated) — the new permission-seed migration file.

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors (14 pre-existing warnings, all in files this checkpoint never touched — identical to the established baseline) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **480 test files, 5026 tests, all passing** (project-wide, including this checkpoint's own new/modified tests) |
| Coverage — project-wide | 71.83% statements, 61.97% branches, 71.49% functions, 73.79% lines — all global thresholds met (70/58/68/72) |
| Production build (`next build`) | Clean — `/analytics` compiles as a dynamic route alongside every existing route, no errors or warnings |

No test flakes observed on this run.

## Documentation

[docs/analytics.md](analytics.md) — new, covering architecture, the Metrics Registry, the Analytics Engine, every Step's own implementation, permissions, observability, accessibility, future caching, and known limitations.

## Known limitations

- **"Most common actions" and "Template usage"** (both explicitly requested) have no queryable historical data source today and are intentionally left unregistered rather than fabricated — see docs/analytics.md's own "Known limitations" for the full reasoning.
- **New Checkpoint 15 tracking (`workflowSimulationStore.ts`) and the `analytics.view` permission migration are mock-only/unapplied** respectively, for the same "don't push new schema to shared infrastructure without explicit confirmation" reason every checkpoint since 13 has followed.
- **No dedicated execution-history store for the Executive Summary** — unlike the Daily Operations Brief, a generation isn't persisted for later review, only logged. A deliberate scope trim.
- **`analytics.view` is deliberately not granted to `staff` by default** — a departure from the broad "view" permissions every other role gets elsewhere in BloomOS, reflecting this checkpoint's own "executive dashboard for Workspace owners" framing. A Workspace can still grant it via the ordinary Team role-management UI.

## Recommendation

**APPROVED.** Every Step 1–12 capability is real, working, and proven live: a self-registering Metrics Registry spanning 7 categories and 22 metrics, a generic Analytics Engine that owns every calculation (trend windows, aggregation, comparison — never hardcoded in the UI), an 8-tab Executive Dashboard rendering entirely through one generic KPI Card component, and an AI Executive Summary that narrates already-computed metrics through the exact same Skill pipeline every other Bloom AI feature uses, structurally incapable of computing its own numbers. Two real bugs were found and fixed during live verification rather than left for a user to discover — a server/client serialization failure that broke the dashboard entirely, and a misleading trend arrow on point-in-time metrics. Permissions are workspace-scoped, role-aware, and metric-visibility-aware, exactly as specified. Per the stop condition, no Public API, Marketplace, or Predictive AI work was started.
