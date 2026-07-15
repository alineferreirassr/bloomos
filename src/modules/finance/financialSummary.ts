import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { subtractMinor, sumMinor, calculatePercentage, majorToMinor } from "@/lib/money";

/**
 * Contracts that no longer represent real, currently-owed commercial value —
 * mirrors modules/contracts/contractStats.ts's INACTIVE_STATUSES exactly, so
 * "contracted value" here and "Contract Value" on the Dashboard never
 * disagree about which Contracts count.
 */
const INACTIVE_CONTRACT_STATUSES: Contract["status"][] = ["cancelled", "declined", "expired", "archived"];

/**
 * Contract.total_value/deposit_amount are stored as plain major-unit
 * numbers (dollars) — the Contract model predates this phase's minor-unit
 * money model and is out of scope to change here. Every Finance summary
 * that folds a Contract value into a *_minor total converts it through this
 * helper rather than assuming it's already in minor units.
 */
function contractMoneyToMinor(amount: number | null): number {
  return amount === null ? 0 : majorToMinor(amount);
}

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status);
}

export interface EventFinancialSummary {
  contracted_value_minor: number;
  invoiced_total_minor: number;
  collected_minor: number;
  refunded_minor: number;
  outstanding_minor: number;
  expense_total_minor: number;
  gross_profit_minor: number;
  net_profit_minor: number;
  deposit_required_minor: number;
  deposit_paid_minor: number;
  deposit_balance_minor: number;
  payment_completion_percentage: number;
  expense_percentage_of_revenue: number;
}

/**
 * Pure — no I/O. Takes the full workspace-scoped arrays (the data layer's
 * getEventFinancialSummary fetches them, this function does the arithmetic)
 * and derives every figure for one Event.
 *
 * Definitions worth being explicit about:
 * - `invoiced_total_minor` is accrual revenue (what's been billed, voided
 *   Invoices excluded); `collected_minor` is cash actually received, net of
 *   refunds. `gross_profit_minor` is revenue-basis (invoiced - expenses);
 *   `net_profit_minor` is cash-basis (collected - expenses) — the two
 *   diverge exactly when there's an outstanding balance, which is the point:
 *   gross profit is what the Event is expected to net once fully collected,
 *   net profit is what it has actually netted so far.
 * - `outstanding_minor` sums each non-voided Invoice's own `balance_minor`
 *   rather than recomputing `invoiced_total_minor - collected_minor`, since
 *   a standalone Payment (no invoice_id) that isn't tied to any Invoice
 *   would otherwise be double-counted as "collected but not invoiced".
 */
export function computeEventFinancialSummary(
  eventId: string,
  contracts: Contract[],
  invoices: Invoice[],
  payments: Payment[],
  expenses: Expense[],
): EventFinancialSummary {
  const eventContracts = contracts.filter(
    (c) => c.event_id === eventId && !INACTIVE_CONTRACT_STATUSES.includes(c.status),
  );
  const eventInvoices = invoices.filter((i) => i.event_id === eventId && i.status !== "voided");
  const eventPayments = payments.filter((p) => p.event_id === eventId);
  const eventExpenses = expenses.filter((e) => e.event_id === eventId && e.status !== "cancelled");

  const contracted_value_minor = sumMinor(eventContracts.map((c) => contractMoneyToMinor(c.total_value)));
  const invoiced_total_minor = sumMinor(eventInvoices.map((i) => i.total_minor));
  const outstanding_minor = sumMinor(eventInvoices.map((i) => i.balance_minor));

  const grossCollected = sumMinor(
    eventPayments.filter((p) => paymentCounts(p) && p.payment_type !== "refund").map((p) => p.amount_minor),
  );
  const refunded_minor = sumMinor(
    eventPayments.filter((p) => paymentCounts(p) && p.payment_type === "refund").map((p) => p.amount_minor),
  );
  const collected_minor = Math.max(0, subtractMinor(grossCollected, refunded_minor));

  const expense_total_minor = sumMinor(eventExpenses.map((e) => e.amount_minor));

  const gross_profit_minor = subtractMinor(invoiced_total_minor, expense_total_minor);
  const net_profit_minor = subtractMinor(collected_minor, expense_total_minor);

  const depositRequiringContracts = eventContracts.filter((c) => c.deposit_required);
  const deposit_required_minor = sumMinor(
    depositRequiringContracts.map((c) => contractMoneyToMinor(c.deposit_amount)),
  );
  // Deposit-specific refunds aren't separately distinguishable from any other refund on this
  // Event (Payment has no structured link back to "the deposit it refunds") — deposit_paid_minor
  // is deliberately gross (uncorrected for refunds) rather than guessing which refund applies.
  // A full refund of a deposit-only Event still shows up correctly in refunded_minor/collected_minor above.
  const deposit_paid_minor = sumMinor(
    eventPayments.filter((p) => paymentCounts(p) && p.payment_type === "deposit").map((p) => p.amount_minor),
  );
  const deposit_balance_minor = Math.max(0, subtractMinor(deposit_required_minor, deposit_paid_minor));

  const payment_completion_percentage = calculatePercentage(collected_minor, invoiced_total_minor);
  const expense_percentage_of_revenue = calculatePercentage(expense_total_minor, invoiced_total_minor);

  return {
    contracted_value_minor,
    invoiced_total_minor,
    collected_minor,
    refunded_minor,
    outstanding_minor,
    expense_total_minor,
    gross_profit_minor,
    net_profit_minor,
    deposit_required_minor,
    deposit_paid_minor,
    deposit_balance_minor,
    payment_completion_percentage,
    expense_percentage_of_revenue,
  };
}

export interface WorkspaceFinancialSummary {
  revenue_this_month_minor: number;
  collected_this_month_minor: number;
  outstanding_receivables_minor: number;
  overdue_receivables_minor: number;
  expenses_this_month_minor: number;
  gross_profit_minor: number;
  net_profit_minor: number;
  deposits_pending_minor: number;
  refunds_this_month_minor: number;
}

export interface AllTimeFinancialTotals {
  total_invoiced_minor: number;
  total_collected_minor: number;
}

/**
 * Pure — no I/O. All-time (not calendar-month-scoped) revenue/collected
 * totals — distinct from computeWorkspaceFinancialSummary's `revenue_this_
 * month_minor`/`collected_this_month_minor` below, which the Dashboard's
 * "Total Invoiced"/"Total Collected" cards deliberately don't use (those
 * cards want the running lifetime total, not the current month).
 */
export function computeAllTimeFinancialTotals(invoices: Invoice[], payments: Payment[]): AllTimeFinancialTotals {
  const total_invoiced_minor = sumMinor(invoices.filter((i) => i.status !== "voided").map((i) => i.total_minor));
  const grossCollected = sumMinor(
    payments.filter((p) => paymentCounts(p) && p.payment_type !== "refund").map((p) => p.amount_minor),
  );
  const refunded = sumMinor(
    payments.filter((p) => paymentCounts(p) && p.payment_type === "refund").map((p) => p.amount_minor),
  );
  const total_collected_minor = Math.max(0, subtractMinor(grossCollected, refunded));

  return { total_invoiced_minor, total_collected_minor };
}

function isInReferenceMonth(isoDate: string | null, reference: Date): boolean {
  if (isoDate === null) return false;
  const d = new Date(isoDate);
  return d.getUTCFullYear() === reference.getUTCFullYear() && d.getUTCMonth() === reference.getUTCMonth();
}

/**
 * Pure — no I/O. Workspace-wide figures, most scoped to the calendar month
 * containing `referenceDate` (defaults to now); `outstanding_receivables`/
 * `overdue_receivables`/`deposits_pending` are point-in-time snapshots, not
 * monthly, since a receivable outstanding since last month is still owed
 * today. Same gross/net distinction as computeEventFinancialSummary:
 * gross = revenue-basis, net = cash-basis.
 */
export function computeWorkspaceFinancialSummary(
  contracts: Contract[],
  invoices: Invoice[],
  payments: Payment[],
  expenses: Expense[],
  referenceDate: Date = new Date(),
): WorkspaceFinancialSummary {
  const activeInvoices = invoices.filter((i) => i.status !== "voided");

  const revenue_this_month_minor = sumMinor(
    activeInvoices.filter((i) => isInReferenceMonth(i.issue_date, referenceDate)).map((i) => i.total_minor),
  );

  const monthPayments = payments.filter((p) => isInReferenceMonth(p.transaction_date, referenceDate));
  const grossCollectedThisMonth = sumMinor(
    monthPayments.filter((p) => paymentCounts(p) && p.payment_type !== "refund").map((p) => p.amount_minor),
  );
  const refunds_this_month_minor = sumMinor(
    monthPayments.filter((p) => paymentCounts(p) && p.payment_type === "refund").map((p) => p.amount_minor),
  );
  const collected_this_month_minor = Math.max(0, subtractMinor(grossCollectedThisMonth, refunds_this_month_minor));

  const outstanding_receivables_minor = sumMinor(
    activeInvoices.filter((i) => i.status !== "archived").map((i) => i.balance_minor),
  );
  const overdue_receivables_minor = sumMinor(
    activeInvoices.filter((i) => i.status === "overdue").map((i) => i.balance_minor),
  );

  const activeExpenses = expenses.filter((e) => e.status !== "cancelled");
  const expenses_this_month_minor = sumMinor(
    activeExpenses.filter((e) => isInReferenceMonth(e.transaction_date, referenceDate)).map((e) => e.amount_minor),
  );

  const gross_profit_minor = subtractMinor(revenue_this_month_minor, expenses_this_month_minor);
  const net_profit_minor = subtractMinor(collected_this_month_minor, expenses_this_month_minor);

  const depositContracts = contracts.filter(
    (c) => c.deposit_required && !INACTIVE_CONTRACT_STATUSES.includes(c.status),
  );
  const deposits_pending_minor = sumMinor(
    depositContracts.map((c) => {
      const requiredMinor = contractMoneyToMinor(c.deposit_amount);
      const paidMinor = sumMinor(
        payments
          .filter(
            (p) =>
              paymentCounts(p) &&
              p.payment_type === "deposit" &&
              ((p.contract_id !== null && p.contract_id === c.id) ||
                (p.contract_id === null && p.event_id !== null && p.event_id === c.event_id)),
          )
          .map((p) => p.amount_minor),
      );
      return Math.max(0, subtractMinor(requiredMinor, paidMinor));
    }),
  );

  return {
    revenue_this_month_minor,
    collected_this_month_minor,
    outstanding_receivables_minor,
    overdue_receivables_minor,
    expenses_this_month_minor,
    gross_profit_minor,
    net_profit_minor,
    deposits_pending_minor,
    refunds_this_month_minor,
  };
}
