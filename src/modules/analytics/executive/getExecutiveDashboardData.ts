"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getContracts, getInvoices, getPayments, getExpenses, getEvents, getLeads, listInventoryItems } from "@/lib/data";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import { computeWorkspaceFinancialSummary, computeAllTimeFinancialTotals, type WorkspaceFinancialSummary } from "@/modules/finance/financialSummary";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { majorToMinor, sumMinor } from "@/lib/money";
import { clockNow } from "@/core/time/clock";
import { resolveTrendWindow, filterInWindow, sumBy, groupByMonth } from "@/core/analytics/engine";
import { resolveBenchmarkWindow } from "@/core/analytics/benchmarkEngine";
import { forecastLinearRegression } from "@/core/analytics/forecastEngine";
import { computeBusinessHealthScore, type BusinessHealthContext } from "@/core/analytics/businessHealthEngine";
import { columnPipelineValue } from "@/modules/pipeline/logic";
import type { ForecastResult } from "@/types/businessIntelligence";
import type { BusinessHealthResult } from "@/types/businessIntelligence";
import type { Payment } from "@/types/payment";

const GENERIC_ACCESS_ERROR = "The Executive Dashboard isn't available. You may not have access to it.";
const FORECAST_MONTHS_LOOKBACK = 6;
const FORECAST_MONTHS_AHEAD = 3;
const OPEN_LEAD_STATUSES = new Set(["new", "contacted", "welcome_guide_sent", "consultation_scheduled", "qualified", "proposal_sent", "waiting_decision"]);

export interface ExecutiveDashboardData {
  currency: string;
  /**
   * Money-bearing fields are `number | null` rather than `number` — the
   * action redacts them server-side based on the caller's own
   * `finance.amounts.view`/`finance.executive.view` permissions (matching
   * `getFinanceDashboardDataAction`'s established pattern), so a caller
   * without the permission never receives the real figure on the wire.
   * `null` means "hidden from you", not "zero" — the UI must render "—",
   * never `$0.00`, for a `null` value here.
   */
  todaysRevenueMinor: number | null;
  monthlyRevenueMinor: number | null;
  revenueGrowthPercent: number | null;
  /** Gated on `finance.executive.view` specifically — company-wide Profit, per the Phase 06B policy. */
  profitMinor: number | null;
  expensesMinor: number | null;
  /** Operating cash flow for the month (cash collected − cash expenses) — the same cash-basis figure `financialSummary.ts` calls `net_profit_minor`. Not a full statement of cash flows (no financing/investing sections) — see `docs/finance-reports.md`'s own deferred-reports list. Gated on `finance.executive.view` — it is literally the Profit figure under another label. */
  cashFlowMinor: number | null;
  pipelineValueMinor: number;
  upcomingEventsCount: number;
  eventsThisMonthCount: number;
  conversionRatePercent: number;
  averageTicketMinor: number | null;
  averageDepositMinor: number | null;
  outstandingPaymentsMinor: number | null;
  /** Estimated, not tracked: total collected to date divided by the number of distinct clients who have ever paid. Labeled "estimated" throughout the UI. */
  estimatedCustomerLifetimeValueMinor: number | null;
  forecast: ForecastResult | null;
  businessHealth: BusinessHealthResult;
}

export type GetExecutiveDashboardDataResult = { success: true; data: ExecutiveDashboardData } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

/**
 * v2 Checkpoint 23, Step 1 — Executive Dashboard 2.0's single aggregate.
 * Fetches every raw array exactly once, then derives all 16 spec KPIs from
 * it — reusing `computeWorkspaceFinancialSummary` (Finance),
 * `getOperationsDashboardData` (Operations, which itself already computes
 * per-event health scores without an extra fan-out — see that file's own
 * doc comment), `ForecastEngine`, and `BusinessHealthEngine` rather than
 * re-deriving any of their arithmetic here.
 */
export async function getExecutiveDashboardData(context?: ServerRepositoryContext): Promise<GetExecutiveDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const canViewAmounts = session.permissions.includes("finance.amounts.view");
  const canViewExecutive = session.permissions.includes("finance.executive.view");

  const now = clockNow();
  const [contracts, invoices, payments, expenses, events, leads, inventoryItems, operationsData] = await Promise.all([
    getContracts({ includeArchived: true }, context),
    getInvoices({ includeArchived: true }, context),
    getPayments(undefined, context),
    getExpenses({ includeArchived: true }, context),
    getEvents({ includeArchived: false }, context),
    getLeads({ includeArchived: false }, context),
    listInventoryItems().catch(() => []),
    getOperationsDashboardData(context),
  ]);

  const currency = payments[0]?.currency ?? invoices[0]?.currency ?? "usd";
  const financialSummary: WorkspaceFinancialSummary = computeWorkspaceFinancialSummary(contracts, invoices, payments, expenses, now);
  const allTimeTotals = computeAllTimeFinancialTotals(invoices, payments);

  // Today's Revenue
  const { window: todayWindow } = resolveTrendWindow("today", now);
  const todaysRevenueMinor = sumBy(filterInWindow(payments.filter(paymentCounts), (p) => p.transaction_date, todayWindow), (p) => p.amount_minor);

  // Revenue Growth — this month vs. last month, reusing the Benchmark Engine's own window resolution.
  const thisMonthWindow = resolveBenchmarkWindow("thisMonth", now);
  const lastMonthWindow = resolveBenchmarkWindow("lastMonth", now);
  const revenueThisMonth = sumBy(filterInWindow(payments.filter(paymentCounts), (p) => p.transaction_date, thisMonthWindow), (p) => p.amount_minor);
  const revenueLastMonth = sumBy(filterInWindow(payments.filter(paymentCounts), (p) => p.transaction_date, lastMonthWindow), (p) => p.amount_minor);
  const revenueGrowthPercent = revenueLastMonth === 0 ? (revenueThisMonth > 0 ? null : 0) : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;

  // Pipeline Value + Conversion Rate
  const openLeads = leads.filter((lead) => OPEN_LEAD_STATUSES.has(lead.status));
  const pipelineValueMinor = majorToMinor(columnPipelineValue(openLeads));
  const conversionRatePercent = leads.length === 0 ? 0 : (leads.filter((lead) => lead.converted_client_id !== null).length / leads.length) * 100;

  // Events This Month
  const eventsThisMonthCount = events.filter((event) => event.event_date !== null && event.event_date >= thisMonthWindow.start.slice(0, 10) && event.event_date < thisMonthWindow.end.slice(0, 10)).length;

  // Average Ticket / Average Deposit
  const billableInvoices = invoices.filter((invoice) => invoice.status !== "voided" && invoice.status !== "draft");
  const averageTicketMinor = billableInvoices.length === 0 ? 0 : Math.round(sumMinor(billableInvoices.map((i) => i.total_minor)) / billableInvoices.length);
  const depositContracts = contracts.filter((c) => c.deposit_required && c.deposit_amount !== null);
  const averageDepositMinor = depositContracts.length === 0 ? 0 : Math.round(sumMinor(depositContracts.map((c) => majorToMinor(c.deposit_amount ?? 0))) / depositContracts.length);

  // Estimated Customer Lifetime Value
  const distinctPayingClientIds = new Set(payments.filter(paymentCounts).map((p) => p.client_id).filter((id): id is string => id !== null));
  const estimatedCustomerLifetimeValueMinor = distinctPayingClientIds.size === 0 ? 0 : Math.round(allTimeTotals.total_collected_minor / distinctPayingClientIds.size);

  // Forecast — trailing months of collected revenue, projected forward.
  const forecastWindow = { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - FORECAST_MONTHS_LOOKBACK, 1)).toISOString(), end: now.toISOString() };
  const monthlyRevenueSeries = groupByMonth(payments.filter(paymentCounts), (p) => p.transaction_date, (p) => p.amount_minor, forecastWindow);
  const forecast = forecastLinearRegression(monthlyRevenueSeries, FORECAST_MONTHS_AHEAD);

  // Business Health Score inputs — reusing operationsData's already-computed per-event health scores rather than re-running HealthScoreEngine here (same "avoid an expensive fan-out" precedent operationsDashboardData.ts itself documents).
  const eventScores = operationsData.eventHealthScores.map((e) => e.score);
  const averageEventHealthScore = eventScores.length === 0 ? null : Math.round(eventScores.reduce((sum, s) => sum + s, 0) / eventScores.length);
  const overdueInvoiceCount = invoices.filter((i) => i.status === "overdue").length;
  const recentLeads = leads.filter((lead) => lead.created_at >= lastMonthWindow.start);
  const priorLeads = leads.filter((lead) => lead.created_at >= new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)).toISOString() && lead.created_at < lastMonthWindow.start);
  const rateFor = (cohort: typeof leads) => (cohort.length === 0 ? 0 : (cohort.filter((l) => l.converted_client_id !== null).length / cohort.length) * 100);

  const businessHealthContext: BusinessHealthContext = {
    finance: {
      overdueReceivablesRatio: financialSummary.outstanding_receivables_minor === 0 ? 0 : financialSummary.overdue_receivables_minor / financialSummary.outstanding_receivables_minor,
      hasRevenueThisPeriod: financialSummary.revenue_this_month_minor > 0,
      netProfitMarginPercent: financialSummary.revenue_this_month_minor === 0 ? 0 : (financialSummary.net_profit_minor / financialSummary.revenue_this_month_minor) * 100,
      cashFlowNegative: financialSummary.net_profit_minor < 0,
    },
    crm: { conversionRatePercent, conversionTrendDown: rateFor(recentLeads) < rateFor(priorLeads), leadCount: leads.length },
    operations: { averageEventHealthScore, lateTaskCount: operationsData.lateTaskCount },
    inventory: { lowStockItemCount: operationsData.lowStockItems.length, totalItemCount: inventoryItems.length },
    team: { overdueTaskCount: operationsData.lateTaskCount, totalTaskCount: operationsData.totalChecklistItemCount },
    events: { atRiskEventCount: operationsData.eventHealthScores.filter((e) => e.score < 70).length, totalActiveEventCount: operationsData.eventHealthScores.length },
    payments: { failedPaymentCount: payments.filter((p) => p.status === "failed").length, overduePaymentCount: overdueInvoiceCount },
    risk: {
      openCriticalRiskCount: operationsData.eventHealthScores.filter((e) => e.score < 45).length,
      openWarningRiskCount: operationsData.eventHealthScores.filter((e) => e.score >= 45 && e.score < 70).length,
    },
  };
  const rawBusinessHealth = computeBusinessHealthScore(businessHealthContext, now);
  // The "finance" dimension's explanation/factors narrate Profit/Margin directly (e.g. "operating at a net loss") —
  // the same concept `finance.executive.view` gates everywhere else, so it's redacted here too, not just the raw numbers above.
  const businessHealth: BusinessHealthResult = canViewExecutive
    ? rawBusinessHealth
    : {
        ...rawBusinessHealth,
        dimensions: rawBusinessHealth.dimensions.map((dimension) =>
          dimension.dimension === "finance"
            ? { ...dimension, score: null, explanation: "Restricted — ask an Owner or Admin for financial health detail.", factors: [] }
            : dimension,
        ),
      };

  return {
    success: true,
    data: {
      currency,
      todaysRevenueMinor: canViewAmounts ? todaysRevenueMinor : null,
      monthlyRevenueMinor: canViewAmounts ? financialSummary.revenue_this_month_minor : null,
      revenueGrowthPercent: canViewAmounts ? revenueGrowthPercent : null,
      profitMinor: canViewExecutive ? financialSummary.net_profit_minor : null,
      expensesMinor: canViewAmounts ? financialSummary.expenses_this_month_minor : null,
      cashFlowMinor: canViewExecutive ? financialSummary.net_profit_minor : null,
      pipelineValueMinor,
      upcomingEventsCount: operationsData.upcomingEvents.length,
      eventsThisMonthCount,
      conversionRatePercent,
      averageTicketMinor: canViewAmounts ? averageTicketMinor : null,
      averageDepositMinor: canViewAmounts ? averageDepositMinor : null,
      outstandingPaymentsMinor: canViewAmounts ? financialSummary.outstanding_receivables_minor : null,
      estimatedCustomerLifetimeValueMinor: canViewAmounts ? estimatedCustomerLifetimeValueMinor : null,
      forecast: canViewAmounts ? forecast : null,
      businessHealth,
    },
  };
}
