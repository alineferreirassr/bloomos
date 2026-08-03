import { getContracts, getExpenses, getInvoices, getPayments } from "@/lib/data";
import { computeWorkspaceFinancialSummary } from "@/modules/finance/financialSummary";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { registerMetric } from "@/core/analytics/metricRegistry";
import { buildMetricResult, filterInWindow, groupByDay, resolveCachedFetch, sumBy } from "@/core/analytics/engine";
import type { MetricComputeContext, MetricComputeResult } from "@/types/analytics";
import type { Invoice } from "@/types/invoice";

/**
 * Checkpoint 15 — Revenue category metrics. Every figure here is a sum
 * over the exact same `Invoice`/`Payment` records `getFinanceDashboardData`/
 * `computeWorkspaceFinancialSummary` already read — never a parallel
 * ledger, never a re-derivation of what "revenue" or "collected" means.
 * `revenue.total`/`revenue.collected` apply the Engine's own generic
 * window filter to those same records (the checkpoint's own Trend Analysis
 * windows — Today/7d/30d/90d/Year — don't map onto
 * `computeWorkspaceFinancialSummary`'s calendar-month scope, so these two
 * metrics filter the raw records directly instead, using the identical
 * sum formula). `revenue.outstandingBalance` is a true point-in-time
 * snapshot (there's no historical invoice-balance ledger to diff against),
 * so it reuses `computeWorkspaceFinancialSummary` directly and reports no
 * period-over-period comparison, honestly, rather than fabricating one.
 */

async function loadInvoicesAndPayments(context: MetricComputeContext) {
  const [invoices, payments] = await Promise.all([
    resolveCachedFetch(context, "invoices", () => getInvoices()),
    resolveCachedFetch(context, "payments", () => getPayments()),
  ]);
  return { invoices, payments };
}

const revenueTotal = {
  id: "revenue.total",
  name: "Revenue",
  description: "Total invoice value issued within the selected window.",
  category: "revenue" as const,
  unit: "currency" as const,
  icon: "DollarSign",
  requiredPermissions: ["finance.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const { invoices } = await loadInvoicesAndPayments(context);
    const active = invoices.filter((invoice) => invoice.status !== "voided" && invoice.issue_date !== null);
    const dateOf = (invoice: Invoice) => invoice.issue_date as string;

    const current = sumBy(filterInWindow(active, dateOf, context.window), (invoice) => invoice.total_minor);
    const previous = sumBy(filterInWindow(active, dateOf, context.previousWindow), (invoice) => invoice.total_minor);
    const series = groupByDay(active, dateOf, (invoice) => invoice.total_minor, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const revenueCollected = {
  id: "revenue.collected",
  name: "Collected",
  description: "Payments received (net of refunds) within the selected window.",
  category: "revenue" as const,
  unit: "currency" as const,
  icon: "Wallet",
  requiredPermissions: ["finance.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const { payments } = await loadInvoicesAndPayments(context);
    const counted = payments.filter((payment) => PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.transaction_date !== null);
    const dateOf = (payment: (typeof counted)[number]) => payment.transaction_date as string;
    const signedAmount = (payment: (typeof counted)[number]) => (payment.payment_type === "refund" ? -payment.amount_minor : payment.amount_minor);

    const current = sumBy(filterInWindow(counted, dateOf, context.window), signedAmount);
    const previous = sumBy(filterInWindow(counted, dateOf, context.previousWindow), signedAmount);
    const series = groupByDay(counted, dateOf, signedAmount, context.window);
    return buildMetricResult(Math.max(0, current), Math.max(0, previous), series);
  },
};

const outstandingBalance = {
  id: "revenue.outstandingBalance",
  name: "Outstanding Balance",
  description: "Total unpaid balance across active invoices right now.",
  category: "revenue" as const,
  unit: "currency" as const,
  icon: "AlertTriangle",
  requiredPermissions: ["finance.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const [contracts, invoices, payments, expenses] = await Promise.all([
      resolveCachedFetch(context, "contracts", () => getContracts()),
      resolveCachedFetch(context, "invoices", () => getInvoices()),
      resolveCachedFetch(context, "payments", () => getPayments()),
      resolveCachedFetch(context, "expenses", () => getExpenses()),
    ]);
    const summary = computeWorkspaceFinancialSummary(contracts, invoices, payments, expenses, new Date(context.window.end));
    // A true point-in-time snapshot — no historical invoice-balance ledger exists to diff against, so this metric honestly reports no trend rather than fabricating one.
    return buildMetricResult(summary.outstanding_receivables_minor, null);
  },
};

const upcomingRevenue = {
  id: "revenue.upcoming",
  name: "Upcoming Revenue",
  description: "Invoice balance due within the selected window's own duration, starting now.",
  category: "revenue" as const,
  unit: "currency" as const,
  icon: "CalendarClock",
  requiredPermissions: ["finance.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const { invoices } = await loadInvoicesAndPayments(context);
    // The selected Trend window is backward-looking (Today/7d/30d/…); "Upcoming Revenue" is inherently forward-looking, so this reuses the window's own duration as a forward horizon from now, rather than the window itself.
    const horizonMs = new Date(context.window.end).getTime() - new Date(context.window.start).getTime();
    const now = new Date(context.window.end);
    const forwardWindow = { start: now.toISOString(), end: new Date(now.getTime() + horizonMs).toISOString() };
    const due = invoices.filter((invoice) => invoice.status !== "voided" && invoice.status !== "paid" && invoice.due_date !== null);
    const current = sumBy(filterInWindow(due, (invoice) => invoice.due_date as string, forwardWindow), (invoice) => invoice.balance_minor);
    return buildMetricResult(current, null);
  },
};

let registered = false;

/** Self-registers this category's metrics — idempotent, the same `let registered = false` guard every other loader in this codebase uses. */
export function registerRevenueMetrics(): void {
  if (registered) return;
  registerMetric(revenueTotal);
  registerMetric(revenueCollected);
  registerMetric(outstandingBalance);
  registerMetric(upcomingRevenue);
  registered = true;
}
