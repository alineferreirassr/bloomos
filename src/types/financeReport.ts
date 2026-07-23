import type { AccountType } from "@/core/enums/accountType";
import type { NormalBalance } from "@/core/enums/normalBalance";

/**
 * Every Finance Report derives exclusively from journal_entries/
 * journal_lines/chart_of_accounts/accounting_periods — never from
 * invoices/payments/expenses/purchases/inventory_movements directly (see
 * docs/finance-reports.md's Reporting Principles). Only posted, financially
 * valid Journal Entries participate; a reversal is represented naturally
 * through its own reversing lines, never by hiding or rewriting the
 * original entry.
 *
 * All money fields are integer minor units — never floating point, never a
 * display-formatted string. Formatting belongs to the future Reports UI.
 */

export interface ReportDateRange {
  startDate: string;
  endDate: string;
}

export interface ReportAccountFilter {
  accountId?: string;
  accountType?: AccountType;
}

/** An optional second date range a report can be computed against for a side-by-side variance — see ReportTotals.varianceMinor. */
export interface ReportComparisonPeriod {
  startDate: string;
  endDate: string;
}

export interface ReportTotals {
  currentPeriodMinor: number;
  comparisonPeriodMinor: number | null;
  varianceMinor: number | null;
}

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

/** One posted Journal Line shown in the General Ledger, carrying its own running balance (computed per-account, in deterministic order — see docs/finance-reports.md). */
export interface GeneralLedgerTransaction {
  journalEntryId: string;
  entryDate: string;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  postingStatus: string;
  journalLineId: string;
  lineMemo: string | null;
  debitMinor: number;
  creditMinor: number;
  runningBalanceMinor: number;
}

/** One account's slice of the General Ledger report: its opening balance before startDate, every in-range transaction, and the closing balance after the last one. */
export interface GeneralLedgerAccount {
  accountId: string;
  accountNumber: number;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  openingBalanceMinor: number;
  transactions: GeneralLedgerTransaction[];
  closingBalanceMinor: number;
}

export interface GeneralLedgerReport {
  workspaceId: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  accounts: GeneralLedgerAccount[];
}

// ---------------------------------------------------------------------------
// Trial Balance
// ---------------------------------------------------------------------------

/** Every account appears on exactly one ending-balance side — see calculateNormalBalance/validateTrialBalance in reportCalculations.ts. */
export interface TrialBalanceRow {
  accountId: string;
  accountNumber: number;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  isArchived: boolean;
  debitMinor: number;
  creditMinor: number;
  endingDebitMinor: number;
  endingCreditMinor: number;
}

export interface TrialBalanceReport {
  workspaceId: string;
  generatedAt: string;
  asOfDate: string;
  rows: TrialBalanceRow[];
  totalEndingDebitMinor: number;
  totalEndingCreditMinor: number;
  /** True only when totalEndingDebitMinor === totalEndingCreditMinor — surfaced explicitly rather than silently assumed. See the Report Accuracy Gate in docs/finance-reports.md. */
  isBalanced: boolean;
}

// ---------------------------------------------------------------------------
// Profit and Loss
// ---------------------------------------------------------------------------

export type ProfitAndLossSectionKind =
  | "revenue"
  | "cost_of_goods_sold"
  | "gross_profit"
  | "operating_expense"
  | "operating_income"
  | "other_income"
  | "other_expense"
  | "net_income";

export interface ProfitAndLossRow {
  accountId: string;
  accountNumber: number;
  accountName: string;
  accountType: AccountType;
  currentPeriodMinor: number;
  comparisonPeriodMinor: number | null;
  varianceMinor: number | null;
}

export interface ProfitAndLossSection {
  kind: ProfitAndLossSectionKind;
  label: string;
  rows: ProfitAndLossRow[];
  totalCurrentPeriodMinor: number;
  totalComparisonPeriodMinor: number | null;
  totalVarianceMinor: number | null;
}

export interface ProfitAndLossReport {
  workspaceId: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  comparisonStartDate: string | null;
  comparisonEndDate: string | null;
  sections: ProfitAndLossSection[];
  netIncomeMinor: number;
  comparisonNetIncomeMinor: number | null;
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

export type BalanceSheetSectionKind = "asset" | "liability" | "equity";

export interface BalanceSheetRow {
  accountId: string;
  accountNumber: number;
  accountName: string;
  accountType: AccountType;
  parentAccountId: string | null;
  closingBalanceMinor: number;
}

export interface BalanceSheetSection {
  kind: BalanceSheetSectionKind;
  label: string;
  rows: BalanceSheetRow[];
  totalMinor: number;
}

export interface BalanceSheetReport {
  workspaceId: string;
  generatedAt: string;
  asOfDate: string;
  sections: BalanceSheetSection[];
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  totalEquityMinor: number;
  /**
   * No closing-entry mechanism exists yet in this ledger (nothing ever
   * posts to 3900 Retained Earnings — see docs/finance-reports.md's
   * "Current-Period Earnings Treatment"). This is the cumulative net
   * income of every income-statement account from the ledger's inception
   * through asOfDate, included in Equity as a synthetic, clearly labeled
   * line rather than silently omitted (which would break the accounting
   * equation) or silently folded into 3900 (which would misrepresent an
   * account nothing actually posted to).
   */
  currentPeriodEarningsMinor: number;
  /** True only when totalAssetsMinor === totalLiabilitiesMinor + totalEquityMinor. See validateAccountingEquation in reportCalculations.ts. */
  isBalanced: boolean;
}

// ---------------------------------------------------------------------------
// Deferred reports — domain types only, reserved for a future phase.
//
// No Repository method, RPC, or mock implementation returns any of these
// yet. See docs/finance-reports.md's "Deferred Reports" section for the
// exact, individually documented schema gap behind each one:
//   - Cash Flow: chart_of_accounts carries no operating/investing/financing
//     classification, and the indirect method's working-capital
//     adjustments would depend on the same unreliable AR/AP balances below.
//   - AR Aging: no RPC ever posts an 'invoice_issued' entry, so Accounts
//     Receivable (1100) is only ever credited (by an invoice-linked
//     Payment Settlement), never debited when an Invoice is issued — there
//     is no ledger-side receivable to age.
//   - AP Aging: Purchase Receipts credit Accounts Payable (2000) with no
//     corresponding settlement/payment RPC to reduce it (vendor_payment is
//     a reserved, unused source_type) — only the Expense accrual subset
//     (expense_due/expense_paid) has a complete due-date/settlement model,
//     which is too partial a slice of account 2000 to report as "Accounts
//     Payable" on its own without misrepresenting the total.
// ---------------------------------------------------------------------------

export type CashFlowSectionKind = "operating" | "investing" | "financing";

export interface CashFlowRow {
  accountId: string;
  accountNumber: number;
  accountName: string;
  movementMinor: number;
}

export interface CashFlowSection {
  kind: CashFlowSectionKind;
  label: string;
  rows: CashFlowRow[];
  totalMinor: number;
}

export interface CashFlowReport {
  workspaceId: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  sections: CashFlowSection[];
  netChangeInCashMinor: number;
  beginningCashMinor: number;
  endingCashMinor: number;
}

export interface AccountsReceivableAgingBucket {
  label: "current" | "1-30" | "31-60" | "61-90" | "90+";
  totalMinor: number;
}

export interface AccountsReceivableAgingReport {
  workspaceId: string;
  generatedAt: string;
  asOfDate: string;
  buckets: AccountsReceivableAgingBucket[];
  totalOutstandingMinor: number;
}

export interface AccountsPayableAgingBucket {
  label: "current" | "1-30" | "31-60" | "61-90" | "90+";
  totalMinor: number;
}

export interface AccountsPayableAgingReport {
  workspaceId: string;
  generatedAt: string;
  asOfDate: string;
  buckets: AccountsPayableAgingBucket[];
  totalOutstandingMinor: number;
}
