"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getFinanceDashboardData,
  getChartOfAccounts,
  getAccountingPeriods,
  getJournalEntries,
  getClientFinancialSummary,
  getEventFinancialSummary,
  getContractFinanceSummary,
  getWorkspaceFinancialSummary,
  getProfitAndLossReport,
  type FinanceAlert,
  type ContractDepositStatus,
} from "@/lib/data";
import type { EventFinancialStatus } from "@/modules/finance/eventFinancialStatus";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import type { JournalEntry } from "@/types/journalEntry";
import type { Event } from "@/types/event";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { ExpenseStatus } from "@/core/enums/expenseStatus";
import { reconcileFinancialTotals, type ReconciliationResult } from "@/modules/finance/reconciliation";
import { clockNow } from "@/core/time/clock";

const GENERIC_ACCESS_ERROR = "You don't have permission to view Finance data.";
const ACCOUNTING_ACCESS_ERROR = "You don't have permission to view the accounting ledger.";
const RECONCILIATION_ACCESS_ERROR = "You don't have permission to view the financial reconciliation diagnostic.";

/**
 * The redacted shapes below exist so a caller without `finance.amounts.view`/
 * `finance.executive.view` never receives the real number in the response
 * payload — not "receives it and the UI declines to render it." Every
 * money-bearing field a Manager/Staff shouldn't see by default is narrowed
 * to `number | null` here (`null` meaning "redacted for this session", not
 * "zero") rather than reusing the full `Invoice`/`Payment`/`Expense`/
 * `FinanceDashboardMetrics` shapes, which model those fields as always-a-
 * number.
 */
export interface FinanceDashboardMetricsView {
  totalInvoicedMinor: number | null;
  totalCollectedMinor: number | null;
  outstandingReceivablesMinor: number | null;
  overdueReceivablesMinor: number | null;
  depositsPendingMinor: number | null;
  expensesThisMonthMinor: number | null;
  grossProfitMinor: number | null;
  netProfitMinor: number | null;
  refundsThisMonthMinor: number | null;
  unpaidExpensesCount: number;
  eventsAwaitingDepositCount: number;
  eventsPaidInFullCount: number;
}

export interface FinanceDashboardInvoiceRow {
  id: string;
  invoice_number: string;
  client_id: string;
  status: InvoiceStatus;
  due_date: string | null;
  currency: string;
  total_minor: number | null;
  balance_minor: number | null;
}

export interface FinanceDashboardPaymentRow {
  id: string;
  client_id: string | null;
  transaction_date: string;
  status: PaymentStatus;
  currency: string;
  amount_minor: number | null;
}

export interface FinanceDashboardExpenseRow {
  id: string;
  description: string;
  due_date: string | null;
  status: ExpenseStatus;
  currency: string;
  amount_minor: number | null;
}

export interface FinanceDashboardEventBalanceRow {
  event: Event;
  outstandingMinor: number | null;
  status: EventFinancialStatus;
}

export interface FinanceDashboardViewData {
  metrics: FinanceDashboardMetricsView;
  recentInvoices: FinanceDashboardInvoiceRow[];
  recentPayments: FinanceDashboardPaymentRow[];
  overdueInvoices: FinanceDashboardInvoiceRow[];
  unpaidExpenses: FinanceDashboardExpenseRow[];
  alerts: FinanceAlert[];
  eventsWithOutstandingBalance: FinanceDashboardEventBalanceRow[];
}

export type FinanceDashboardActionResult =
  | { success: true; data: FinanceDashboardViewData }
  | { success: false; error: string };

/**
 * The Finance Dashboard's server-side read boundary. Reuses the existing
 * canonical `getFinanceDashboardData()` aggregation unchanged (never
 * duplicates the arithmetic) and redacts money-bearing fields in the
 * returned shape based on the caller's own permissions *before* the
 * response leaves this function — a caller lacking `finance.amounts.view`
 * never has the real invoice/payment/expense amounts on the wire, and a
 * caller lacking `finance.executive.view` never has the real Gross/Net
 * Profit figures on the wire, regardless of what the client component does
 * with the response afterward.
 */
export async function getFinanceDashboardDataAction(): Promise<FinanceDashboardActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("finance.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const canViewAmounts = session.permissions.includes("finance.amounts.view");
  const canViewExecutive = session.permissions.includes("finance.executive.view");

  const data = await getFinanceDashboardData();

  return {
    success: true,
    data: {
      metrics: {
        totalInvoicedMinor: canViewAmounts ? data.metrics.totalInvoicedMinor : null,
        totalCollectedMinor: canViewAmounts ? data.metrics.totalCollectedMinor : null,
        outstandingReceivablesMinor: canViewAmounts ? data.metrics.outstandingReceivablesMinor : null,
        overdueReceivablesMinor: canViewAmounts ? data.metrics.overdueReceivablesMinor : null,
        depositsPendingMinor: canViewAmounts ? data.metrics.depositsPendingMinor : null,
        expensesThisMonthMinor: canViewAmounts ? data.metrics.expensesThisMonthMinor : null,
        grossProfitMinor: canViewExecutive ? data.metrics.grossProfitMinor : null,
        netProfitMinor: canViewExecutive ? data.metrics.netProfitMinor : null,
        refundsThisMonthMinor: canViewAmounts ? data.metrics.refundsThisMonthMinor : null,
        unpaidExpensesCount: data.metrics.unpaidExpensesCount,
        eventsAwaitingDepositCount: data.metrics.eventsAwaitingDepositCount,
        eventsPaidInFullCount: data.metrics.eventsPaidInFullCount,
      },
      recentInvoices: data.recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        status: invoice.status,
        due_date: invoice.due_date,
        currency: invoice.currency,
        total_minor: canViewAmounts ? invoice.total_minor : null,
        balance_minor: canViewAmounts ? invoice.balance_minor : null,
      })),
      recentPayments: data.recentPayments.map((payment) => ({
        id: payment.id,
        client_id: payment.client_id,
        transaction_date: payment.transaction_date,
        status: payment.status,
        currency: payment.currency,
        amount_minor: canViewAmounts ? payment.amount_minor : null,
      })),
      overdueInvoices: data.overdueInvoices.map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        status: invoice.status,
        due_date: invoice.due_date,
        currency: invoice.currency,
        total_minor: canViewAmounts ? invoice.total_minor : null,
        balance_minor: canViewAmounts ? invoice.balance_minor : null,
      })),
      unpaidExpenses: data.unpaidExpenses.map((expense) => ({
        id: expense.id,
        description: expense.description,
        due_date: expense.due_date,
        status: expense.status,
        currency: expense.currency,
        amount_minor: canViewAmounts ? expense.amount_minor : null,
      })),
      alerts: data.alerts,
      eventsWithOutstandingBalance: data.eventsWithOutstandingBalance.map((entry) => ({
        event: entry.event,
        outstandingMinor: canViewAmounts ? entry.outstandingMinor : null,
        status: entry.status,
      })),
    },
  };
}

export interface FinanceLedgerSummaryData {
  activeAccountCount: number;
  openPeriod: AccountingPeriod | null;
  periodCounts: { open: number; closed: number; locked: number };
  latestEntries: JournalEntry[];
}

export type FinanceLedgerSummaryActionResult =
  | { success: true; data: FinanceLedgerSummaryData }
  | { success: false; error: string };

/**
 * Chart of Accounts / Accounting Periods / Journal Entries are explicitly
 * named in the Founder-approved policy as executive/accounting surfaces
 * Manager and Staff don't get by default — gated on `finance.accounting.view`
 * here, independent of and in addition to the route-level gate on
 * `/finance/accounts`, `/finance/journal`, and `/finance/periods` themselves
 * (this action also backs the Finance Dashboard's own "General Ledger"
 * summary widget, which lives on `/finance`, not under those routes).
 */
export async function getFinanceLedgerSummaryAction(): Promise<FinanceLedgerSummaryActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("finance.accounting.view")) {
    return { success: false, error: ACCOUNTING_ACCESS_ERROR };
  }

  const [accounts, periods, latestEntries] = await Promise.all([
    getChartOfAccounts(),
    getAccountingPeriods(),
    getJournalEntries({ limit: 5 }),
  ]);

  return {
    success: true,
    data: {
      activeAccountCount: accounts.length,
      openPeriod: periods.find((period) => period.status === "open") ?? null,
      periodCounts: {
        open: periods.filter((period) => period.status === "open").length,
        closed: periods.filter((period) => period.status === "closed").length,
        locked: periods.filter((period) => period.status === "locked").length,
      },
      latestEntries,
    },
  };
}

/**
 * The redacted shape `ClientFinancialSummaryCard`/`EventFinancialSummaryCard`
 * now render — every field but `payment_completion_percentage` narrows to
 * `number | null` the same way the Dashboard's own redaction does, so a
 * caller who reaches these cards only via `clients.view`/`events.view` (not
 * `finance.view`) can no longer receive a real financial figure through
 * them — closing the leak the audit found where these two cards bypassed
 * Finance authorization entirely.
 */
export interface FinancialSummaryView {
  contracted_value_minor: number | null;
  invoiced_total_minor: number | null;
  collected_minor: number | null;
  refunded_minor: number | null;
  outstanding_minor: number | null;
  expense_total_minor: number | null;
  planned_expense_total_minor: number | null;
  committed_expense_total_minor: number | null;
  paid_expense_total_minor: number | null;
  gross_profit_minor: number | null;
  net_profit_minor: number | null;
  cash_profit_minor: number | null;
  gross_margin_percent: number | null;
  deposit_required_minor: number | null;
  deposit_paid_minor: number | null;
  deposit_balance_minor: number | null;
  payment_completion_percentage: number | null;
}

function redactFinancialSummary(
  summary: {
    contracted_value_minor: number;
    invoiced_total_minor: number;
    collected_minor: number;
    refunded_minor: number;
    outstanding_minor: number;
    expense_total_minor: number;
    planned_expense_total_minor: number;
    committed_expense_total_minor: number;
    paid_expense_total_minor: number;
    gross_profit_minor: number;
    net_profit_minor: number;
    cash_profit_minor: number;
    gross_margin_percent: number;
    deposit_required_minor: number;
    deposit_paid_minor: number;
    deposit_balance_minor: number;
    payment_completion_percentage: number;
  },
  canViewAmounts: boolean,
  canViewExecutive: boolean,
): FinancialSummaryView {
  return {
    contracted_value_minor: canViewAmounts ? summary.contracted_value_minor : null,
    invoiced_total_minor: canViewAmounts ? summary.invoiced_total_minor : null,
    collected_minor: canViewAmounts ? summary.collected_minor : null,
    refunded_minor: canViewAmounts ? summary.refunded_minor : null,
    outstanding_minor: canViewAmounts ? summary.outstanding_minor : null,
    expense_total_minor: canViewAmounts ? summary.expense_total_minor : null,
    planned_expense_total_minor: canViewAmounts ? summary.planned_expense_total_minor : null,
    committed_expense_total_minor: canViewAmounts ? summary.committed_expense_total_minor : null,
    paid_expense_total_minor: canViewAmounts ? summary.paid_expense_total_minor : null,
    gross_profit_minor: canViewExecutive ? summary.gross_profit_minor : null,
    net_profit_minor: canViewExecutive ? summary.net_profit_minor : null,
    cash_profit_minor: canViewExecutive ? summary.cash_profit_minor : null,
    gross_margin_percent: canViewExecutive ? summary.gross_margin_percent : null,
    deposit_required_minor: canViewAmounts ? summary.deposit_required_minor : null,
    deposit_paid_minor: canViewAmounts ? summary.deposit_paid_minor : null,
    deposit_balance_minor: canViewAmounts ? summary.deposit_balance_minor : null,
    payment_completion_percentage: canViewAmounts ? summary.payment_completion_percentage : null,
  };
}

export type ClientFinancialSummaryActionResult = { success: true; data: FinancialSummaryView | null };

/**
 * `data: null` means "omit the Finance card entirely" (the caller holds
 * neither `finance.view` nor any narrower finance permission) — distinct
 * from every field being `null` inside a present summary (the caller holds
 * `finance.view` but not `finance.amounts.view`/`finance.executive.view`).
 * Always resolves successfully (never a `{success:false}` branch) since a
 * missing summary is a normal, expected state for this card, not an error.
 */
export async function getClientFinancialSummaryAction(clientId: string): Promise<ClientFinancialSummaryActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("finance.view")) {
    return { success: true, data: null };
  }
  const summary = await getClientFinancialSummary(clientId);
  return {
    success: true,
    data: redactFinancialSummary(
      summary,
      session.permissions.includes("finance.amounts.view"),
      session.permissions.includes("finance.executive.view"),
    ),
  };
}

export type EventFinancialSummaryActionResult = { success: true; data: FinancialSummaryView | null };

export async function getEventFinancialSummaryAction(eventId: string): Promise<EventFinancialSummaryActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("finance.view")) {
    return { success: true, data: null };
  }
  const summary = await getEventFinancialSummary(eventId);
  return {
    success: true,
    data: redactFinancialSummary(
      summary,
      session.permissions.includes("finance.amounts.view"),
      session.permissions.includes("finance.executive.view"),
    ),
  };
}

/**
 * Phase 06C — `ContractFinanceSummaryCard` was the third card in the same
 * leak class as Client/Event (reachable via `contracts.view`, bypassing
 * Finance authorization), closed here the same way. It has no profit/margin
 * fields today (confirmed against `ContractFinanceSummary`'s shape), so
 * `finance.executive.view` is never checked or required — only
 * `finance.amounts.view` gates the monetary fields, per the Founder's
 * explicit "don't require executive permission for data that isn't
 * present" instruction. `invoices` keeps every linked invoice's id/number/
 * status/currency visible (operational, allowed under `finance.view` alone)
 * and redacts only `total_minor`.
 */
export interface ContractFinancialSummaryInvoiceRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  total_minor: number | null;
}

export interface ContractFinancialSummaryView {
  totalInvoicedMinor: number | null;
  totalCollectedMinor: number | null;
  outstandingMinor: number | null;
  depositRequiredMinor: number | null;
  depositPaidMinor: number | null;
  depositStatus: ContractDepositStatus;
  invoices: ContractFinancialSummaryInvoiceRow[];
}

export type ContractFinancialSummaryActionResult = { success: true; data: ContractFinancialSummaryView | null };

/**
 * `data: null` means "omit the Finance card entirely" — same convention as
 * `getClientFinancialSummaryAction`/`getEventFinancialSummaryAction`.
 */
export async function getContractFinancialSummaryAction(contractId: string): Promise<ContractFinancialSummaryActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("finance.view")) {
    return { success: true, data: null };
  }
  const canViewAmounts = session.permissions.includes("finance.amounts.view");
  const summary = await getContractFinanceSummary(contractId);
  return {
    success: true,
    data: {
      totalInvoicedMinor: canViewAmounts ? summary.totalInvoicedMinor : null,
      totalCollectedMinor: canViewAmounts ? summary.totalCollectedMinor : null,
      outstandingMinor: canViewAmounts ? summary.outstandingMinor : null,
      depositRequiredMinor: canViewAmounts ? summary.depositRequiredMinor : null,
      depositPaidMinor: canViewAmounts ? summary.depositPaidMinor : null,
      depositStatus: summary.depositStatus,
      invoices: summary.invoices.map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        currency: invoice.currency,
        total_minor: canViewAmounts ? invoice.total_minor : null,
      })),
    },
  };
}

export interface FinancialReconciliationDiagnosticView {
  periodStartDate: string;
  periodEndDate: string;
  isReconciled: boolean;
  discrepancies: ReconciliationResult["discrepancies"];
  notComparableMetrics: ReconciliationResult["notComparable"];
  notComparableReason: string;
  /** The two genuinely-compared expense totals for the period — surfaced separately from `discrepancies` (which only lists mismatches) so the UI can show the comparison even when the two totals agree. */
  operationalExpenseMinor: number;
  ledgerExpenseMinor: number;
}

export type FinancialReconciliationDiagnosticActionResult =
  | { success: true; data: FinancialReconciliationDiagnosticView }
  | { success: false; error: string };

/**
 * Finance F1.5 — Founder-only (`finance.executive.view`, the same
 * aggregate/executive gate `gross_profit_minor`/`net_profit_minor` already
 * use everywhere else in this file: owner/admin only, per
 * permissionMatrix.ts). Read-only diagnostic: fetches the operational
 * workspace summary and the real ledger's Profit & Loss report for the
 * SAME current calendar month, and hands both to the pure
 * `reconcileFinancialTotals()` — never mutates anything, never posts a
 * correcting journal entry, never touches `journal_entries` at all.
 *
 * Revenue and Net Income are passed as `null` on both sides — see
 * `reconciliation.ts`'s own doc comment for exactly why: no posting RPC in
 * this codebase (`post_purchase_receipt`/`post_payment_settlement`/
 * `post_expense_transition`) ever credits a Revenue-type account, so the
 * ledger has no systematic Revenue recognition to compare against yet.
 * Only Expenses are genuinely comparable today — the ledger's
 * `operating_expense` section total for the month against the operational
 * `expenses_this_month_minor` figure both derive from real posted
 * transactions.
 */
export async function getFinancialReconciliationDiagnosticAction(): Promise<FinancialReconciliationDiagnosticActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("finance.executive.view")) {
    return { success: false, error: RECONCILIATION_ACCESS_ERROR };
  }

  const now = clockNow();
  const periodStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const periodEndDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

  const [workspaceSummary, plReport] = await Promise.all([
    getWorkspaceFinancialSummary(),
    getProfitAndLossReport({ startDate: periodStartDate, endDate: periodEndDate }),
  ]);

  const ledgerExpenseMinor = plReport.sections
    .filter((section) => section.kind === "operating_expense")
    .reduce((sum, section) => sum + section.totalCurrentPeriodMinor, 0);

  const result = reconcileFinancialTotals(
    { revenueMinor: null, expenseMinor: workspaceSummary.expenses_this_month_minor, netProfitMinor: null },
    { revenueMinor: null, expenseMinor: ledgerExpenseMinor, netIncomeMinor: null },
  );

  return {
    success: true,
    data: {
      periodStartDate,
      periodEndDate,
      isReconciled: result.isReconciled,
      discrepancies: result.discrepancies,
      notComparableMetrics: result.notComparable,
      notComparableReason:
        "Revenue and Net Income aren't compared: no BloomOS posting path credits a Revenue account in the ledger yet, so there's no ledger-side revenue figure to compare against. See docs/finance-canonical-semantics.md.",
      operationalExpenseMinor: workspaceSummary.expenses_this_month_minor,
      ledgerExpenseMinor,
    },
  };
}
