# Report Templates

`core/reporting/templateRegistry.ts` — the same self-registering `Map<string, ReportTemplate>` shape as the Metric Registry. `registerBuiltinReportTemplates()` (`modules/reporting/registerBuiltinReportTemplates.ts`) registers 16 entries: 15 named templates plus `custom`.

## The 15 built-in templates

| id | Category | Metrics used |
|---|---|---|
| `executive_overview` | executive | Executive score, both Business Health composites, proposal count, invoice outstanding balance |
| `business_health` | executive | Both Business Health composites side by side |
| `revenue_profit` | finance | Revenue total, revenue collected |
| `accounts_receivable` | finance | Outstanding balance, average invoice value |
| `sales_pipeline` | commercial | New leads, conversion rate, proposal acceptance, journey conversion |
| `proposal_performance` | commercial | Proposal count, acceptance rate, average value |
| `contract_readiness` | commercial | Contract count, completion rate |
| `invoice_billing` | commercial | Invoice count, outstanding balance, average value |
| `client_journey` | commercial | Journey conversion rate, deposit completion rate |
| `workforce_utilization` | workforce | Worker/team counts, active assignments, equipment utilization |
| `asset_library` | assets | Total assets, storage consumed, unused assets, asset health |
| `workflow_automation` | automation | Workflow executions, failure rate |
| `search_performance` | search | Search volume, success rate, Search Health |
| `notification_engagement` | communication | Notifications created, engagement rate, unread count, Notification Health |
| `objectives_scorecard` | executive | Objectives operational score |

Plus `custom` — an empty `ReportDefinition` for building a report from scratch via the Report Builder.

## Applying a template

`ReportTemplatesView`'s `applyTemplate()` (named to avoid an eslint `react-hooks/rules-of-hooks` false-positive on the `use*` name prefix) copies the template's `definition` into a new unsaved report, opens it in the Builder for adjustment, then `createReportAction` saves it with `source_template_id` set — so the Reporting Analytics Engine can distinguish "reports built from a template" from "reports built from scratch" (`templatesUsed` vs. `reportsSaved`).

## The 6 named templates honestly NOT built this checkpoint

The checkpoint's own spec named 22 total templates. 6 were not built, each for the same reason: **no real metric exists yet for that domain**, and this checkpoint's "adapt or read, never invent" discipline (see `metric-registry.md`) rules out fabricating one just to fill a template slot.

| Not built | Why |
|---|---|
| Client Portal Engagement Report | No portal-session-analytics metric exists; Client Portal has activity data but no aggregated engagement metric registered anywhere |
| Event Performance Report | Event Health Score v2 exists as a per-event score, not an aggregate workspace metric ready to adapt |
| Dispatch Performance Report | Dispatch Health Engine exists but has no metric-registry entry to adapt from |
| Route Efficiency Report | Route Health Engine exists but has no metric-registry entry to adapt from |
| Vendor Performance Report | No vendor-performance metric exists anywhere in the codebase yet |
| Knowledge Health Report | Knowledge Health Engine's score is a Knowledge Graph structural metric, not yet exposed through any metric registry |

Each of these could become a real template in a future checkpoint the moment its domain registers a real metric — the gap is in metric coverage, not in the Reporting Platform's own template mechanism.
