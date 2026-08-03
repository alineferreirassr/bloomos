# Reporting & Business Intelligence Platform

The single, unified, permission-aware internal Reporting & BI Platform every module composes over — a Report Builder, a Metric Registry, a deterministic Report Computation Engine, Period Comparison, immutable Snapshots, 16 report templates, a 6-route Reporting Center, Client-Safe Reporting, and internal Health/Analytics engines for the Reporting domain itself. Built entirely as a superset over the ~20 existing analytics/health/scorecard engines already in BloomOS — it composes them, never duplicates them.

## Why this exists

By Checkpoint 42, BloomOS had accumulated roughly 20 separately-named analytics/health/scorecard systems (Executive Analytics, both Business Health composites, Operational Intelligence, Executive Decisions, Workspace Analytics, and per-domain Analytics/Health engines for Finance, Workflow, Notification, Search, DAM, Client Journey, Proposal, Contract, Invoice, plus Objectives scorecards for Workforce/Scheduling/Dispatch/Field Operations/Route Optimization/Knowledge) — each with its own shape, its own dashboard, no shared vocabulary for "build me a report" across them. This checkpoint's job was explicitly **not** to build engine #21. It was to build the one layer above all of them: a place to pick metrics from any domain, filter/group/compare them over a period, save the result, snapshot it, and view it consistently — without re-deriving a single number any existing engine already computes.

## Architectural rule: extend, don't duplicate

Every file in `core/reporting/` either:
1. **Adapts** an existing engine's already-computed output (`metricAdapters.ts` wraps every `core/analytics/metricRegistry.ts` `MetricDefinition` as a `ReportMetricDefinition`, prefixed `analytics.*`), or
2. **Re-labels** an existing report's own fields (`getExecutiveReportInsightsAction()` maps `ExecutiveReport.criticalIssues/businessRisks/operationalRisks/topImprovements` into `ReportInsight[]` — it does not invent new categories), or
3. **Composes** several existing accessors into one client-safe projection (`clientSafeReportActions.ts`), or
4. Is new metric definitions in six real domains (Assets, Commercial, Communication, Executive, Search, Workforce) that **read from existing repositories** — never new derived business logic that duplicates a health/analytics engine elsewhere.

No new health score, no new analytics engine, and no new business-rule evaluator was built for any domain this checkpoint touches. `reportingHealthEngine.ts` and `reportingAnalyticsEngine.ts` are about the Reporting Platform's *own* operational health (are metrics registered, are sources fresh, is performance acceptable) — not a 21st copy of Business Health.

## Documentation map

| Doc | Covers |
|---|---|
| `report-builder.md` | Builder discovery flow, module actions, `previewReportAction`/`createReportAction` |
| `metric-registry.md` | `ReportMetricDefinition`, the superset-adapter pattern, the 28 new + adapted `analytics.*` metrics |
| `report-computation.md` | The Report Computation Engine, per-metric isolation, `ComputedReport` |
| `report-filters.md` | Dimensions, filters, sorting, grouping |
| `report-comparisons.md` | Period Comparison Engine |
| `report-snapshots.md` | Immutable Snapshots |
| `report-templates.md` | The 16 built-in templates, and the 6 named templates honestly not built |
| `reporting-health.md` | Reporting Health Engine (7 categories) |
| `reporting-analytics.md` | Reporting Analytics Engine |
| `reporting-permissions.md` | The 7 `reports.*` permissions |
| `reporting-ui.md` | The 6 Reporting Center routes |
| `v2-checkpoint-42.md` | Final certification report |

## Stop Conditions honored

No Stripe/Square/PayPal/ACH, no Google Calendar/Gmail/Outlook, no Twilio/SMS/WhatsApp/push providers, no Google Drive/Dropbox, no QuickBooks/Xero, no external BI tools, no scheduled email, no background workers/cron, no AI-generated facts or natural-language report generation, no fabricated data, no unrestricted SQL. Every number in a `ComputedReport` traces to a real repository read through a real, pre-existing engine or a new metric's own `lib/data` accessor.
