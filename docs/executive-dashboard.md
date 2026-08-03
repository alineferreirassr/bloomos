# Executive Dashboard 2.0 (v2 Checkpoint 23, Step 1)

`getExecutiveDashboardData.ts` is the single aggregate the new "Executive" tab (now the default tab in `/analytics`, ahead of the original Checkpoint 15 "Overview" tab) renders from. It fetches every raw record array exactly once — Contracts, Invoices, Payments, Expenses, Events, Leads, Inventory Items, plus one call to `getOperationsDashboardData()` — then derives all 16 KPI widgets from that one fetch, reusing `computeWorkspaceFinancialSummary`/`computeAllTimeFinancialTotals` (Finance, Checkpoint 15), the Forecast Engine, and the Business Health Engine rather than re-deriving any of their arithmetic locally.

## The 16 widgets

| Widget | Source |
|---|---|
| Today's Revenue | Sum of today's counted payments |
| Monthly Revenue | `financialSummary.revenue_this_month_minor` |
| Revenue Growth | This month vs. last month, using the Benchmark Engine's own window resolution |
| Profit | `financialSummary.net_profit_minor` (cash-basis) |
| Expenses | `financialSummary.expenses_this_month_minor` |
| Cash Flow | Same figure as Profit — see "Cash Flow = Net Profit" below |
| Pipeline Value | Open leads' pipeline value, reusing Checkpoint 13's `columnPipelineValue` |
| Upcoming Events | `operationsData.upcomingEvents.length` |
| Events This Month | Events whose `event_date` falls in the current calendar month |
| Conversion Rate | Converted leads ÷ total leads, all-time |
| Average Ticket | Mean `total_minor` across non-voided, non-draft invoices |
| Average Deposit | Mean deposit amount across contracts that require one |
| Outstanding Payments | `financialSummary.outstanding_receivables_minor` |
| Estimated Customer Lifetime Value | All-time collected ÷ distinct paying clients — labeled "estimated" in the UI |
| Revenue Forecast | `ForecastEngine.forecastLinearRegression()` over 6 trailing months, 3 months ahead |
| Business Health | `BusinessHealthEngine.computeBusinessHealthScore()`, all 9 dimensions |

## Cash Flow = Net Profit, honestly

Checkpoint 15's `financialSummary.ts` already distinguishes Gross Profit (accrual: invoiced − cost) from Net Profit (cash: collected − cost). The spec's "Cash Flow" KPI is, today, literally the same cash-basis figure as Net Profit — BloomOS has no separate financing/investing cash-flow tracking, so rather than invent a third, fabricated number, `cashFlowMinor` is documented in the type (`ExecutiveDashboardData.cashFlowMinor`) as exactly what it is: operating cash flow only, not a full statement of cash flows. This is called out again in the Known Limitations section of the checkpoint report below.

## Package = Service, honestly

The spec's Revenue Analytics dimensions include both "by Service" and (implicitly, via general BI convention) a notion of "Package." BloomOS's data model has no separate Package entity distinct from `EventService` — a Package, in this product, *is* a Service with a bundled price. Rather than fabricate a second, parallel breakdown dimension that would just duplicate the Service one under a different label, `REVENUE_BREAKDOWN_DIMENSIONS` documents Service as covering both, and no separate "Package" tab exists.

## Widget customization (Step 14)

Every widget can be pinned, hidden, and reordered per-member, per-workspace, persisted via `DashboardLayoutStore` (`getDashboardLayoutAction`/`saveDashboardLayoutAction`). Pinned widgets always sort first; unpinned widgets keep their saved order; hidden widgets are excluded from the visible grid but remain toggleable from a "Hidden widgets" list. A fresh workspace/member with no saved layout gets a real default (all 14 numeric-KPI widgets visible, unpinned, in registry order) rather than an empty state — nothing about first-load feels broken or unconfigured.

## Drill-down navigation (Step 13)

Every widget that has a natural destination (Revenue → `/finance/invoices`, Pipeline → `/pipeline/commercial`, Upcoming Events → `/events`, etc.) renders its value as a clickable, keyboard-accessible target (`role="button" tabIndex={0} onKeyDown`) that routes there via `useRouter().push()`. Widgets with no natural single destination (Business Health, Forecast) render as plain text.

## Export Center (Step 15)

The top-of-page `ExportMenu` produces a PDF executive summary with three sections — KPIs, Business Health (with every dimension's explanation and factors), and the Revenue Forecast (historical + projected points, method, and confidence) — via `jspdf`, dynamically imported only when a user actually clicks export. `exceljs` (not `xlsx`/SheetJS — see Known Limitations for why) handles Excel exports elsewhere in the checkpoint (Revenue Analytics, Profitability).

## Performance

The entire dashboard is one `Promise.all` fan-out over 8 already-existing repository calls plus one existing aggregate (`getOperationsDashboardData`, which itself avoids a second per-event fan-out — see that file's own doc comment) — no new N+1 queries were introduced. Revenue Analytics tables cap on-screen rendering at 50 rows (pre-sorted by revenue descending) while exports always receive the full, uncapped dataset.
