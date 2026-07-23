import type { AccountType } from "@/core/enums/accountType";
import type { NormalBalance } from "@/core/enums/normalBalance";
import type {
  ProfitAndLossRow,
  ProfitAndLossSection,
  BalanceSheetRow,
  BalanceSheetSection,
} from "@/types/financeReport";

/**
 * Pure, dependency-free report math shared by both the mock and Supabase
 * Finance repositories, so the two can never compute a report differently.
 * Nothing here talks to Postgres or a mock store — callers pass in
 * already-fetched (or already-aggregated) rows. See docs/finance-reports.md
 * for the reporting principles these functions encode.
 */

/**
 * A signed balance in the account's own normal-balance direction:
 * debit-normal accounts increase with debits (debit - credit), credit-normal
 * accounts increase with credits (credit - debit). The account's own
 * committed normal_balance is always the authority — never hardcoded by
 * account type.
 */
export function calculateNormalBalance(normalBalance: NormalBalance, debitMinor: number, creditMinor: number): number {
  return normalBalance === "debit" ? debitMinor - creditMinor : creditMinor - debitMinor;
}

/**
 * Running balance for one account's ordered movements, expressed in the
 * account's own normal-balance direction, seeded by its opening balance.
 * Returns one running balance per input movement, in the same order.
 */
export function calculateRunningBalance(
  normalBalance: NormalBalance,
  openingBalanceMinor: number,
  movements: Array<{ debitMinor: number; creditMinor: number }>,
): number[] {
  let running = openingBalanceMinor;
  return movements.map((movement) => {
    running += calculateNormalBalance(normalBalance, movement.debitMinor, movement.creditMinor);
    return running;
  });
}

/**
 * A Trial Balance places each account on exactly one side: whichever side
 * matches the *actual* net direction of its activity (total debits minus
 * total credits, uniformly — not the account's "normal" side), so a
 * contra-account or an account pushed abnormal by a real transaction still
 * reports correctly. Net > 0 sits on the debit side, net < 0 on the credit
 * side, net === 0 on neither.
 */
export function splitEndingBalance(totalDebitMinor: number, totalCreditMinor: number): { endingDebitMinor: number; endingCreditMinor: number } {
  const net = totalDebitMinor - totalCreditMinor;
  return net >= 0 ? { endingDebitMinor: net, endingCreditMinor: 0 } : { endingDebitMinor: 0, endingCreditMinor: -net };
}

/**
 * The Trial Balance's own accounting identity: total ending debits must
 * equal total ending credits. This is guaranteed by the ledger's own
 * balanced-entry invariant (every Journal Entry balances by construction —
 * see finance_check_journal_entry_balanced), so a false result here means a
 * genuine data problem, never something to silently correct or plug.
 */
export function validateTrialBalance(rows: Array<{ endingDebitMinor: number; endingCreditMinor: number }>): {
  isBalanced: boolean;
  totalEndingDebitMinor: number;
  totalEndingCreditMinor: number;
} {
  const totalEndingDebitMinor = rows.reduce((sum, row) => sum + row.endingDebitMinor, 0);
  const totalEndingCreditMinor = rows.reduce((sum, row) => sum + row.endingCreditMinor, 0);
  return { isBalanced: totalEndingDebitMinor === totalEndingCreditMinor, totalEndingDebitMinor, totalEndingCreditMinor };
}

/** The Balance Sheet's own accounting identity: Assets = Liabilities + Equity. A false result signals a genuine data problem — never silently adjusted to force balance. */
export function validateAccountingEquation(totalAssetsMinor: number, totalLiabilitiesMinor: number, totalEquityMinor: number): boolean {
  return totalAssetsMinor === totalLiabilitiesMinor + totalEquityMinor;
}

/** Groups any account-bearing row by its account_type, preserving input order within each group. */
export function groupAccountsByType<T extends { accountType: AccountType }>(rows: T[]): Map<AccountType, T[]> {
  const groups = new Map<AccountType, T[]>();
  for (const row of rows) {
    const group = groups.get(row.accountType);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.accountType, [row]);
    }
  }
  return groups;
}

/** null comparison means "no comparison period was requested" — distinct from a comparison value of zero, so a caller can tell the two apart. */
export function calculateVariance(currentMinor: number, comparisonMinor: number | null): number | null {
  return comparisonMinor === null ? null : currentMinor - comparisonMinor;
}

export interface ProfitAndLossAccountMovement {
  accountId: string;
  accountNumber: number;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  currentDebitMinor: number;
  currentCreditMinor: number;
  comparisonDebitMinor: number;
  comparisonCreditMinor: number;
}

/**
 * Assembles Profit and Loss sections from flat, already-aggregated
 * per-account movement rows (the shape both finance_profit_and_loss_report
 * and the mock repository's own aggregation produce) — the one place this
 * assembly happens, shared by both repositories so they can never diverge.
 *
 * Every section except Revenue contains accounts of a single
 * normal_balance, so its total is simply the sum of its rows' own
 * calculateNormalBalance value (each row's natural positive magnitude).
 * Revenue is the one exception: it mixes credit-normal revenue accounts
 * with debit-normal contra_revenue accounts (Sales Discounts, Refunds &
 * Returns), which must net against revenue rather than add to it — its
 * section total is computed via the type-agnostic net-income contribution
 * formula (creditMinor - debitMinor, which is negative for a debit-normal
 * contra_revenue account) instead, while each row still displays its own
 * calculateNormalBalance-based positive magnitude for readability.
 *
 * Rollups follow the standard income statement structure exactly:
 *   Gross Profit      = Revenue (net of contra_revenue) - COGS
 *   Operating Income   = Gross Profit - Operating Expenses
 *   Net Income          = Operating Income + Other Income - Other Expense
 */
export function buildProfitAndLossSections(
  movements: ProfitAndLossAccountMovement[],
  hasComparison: boolean,
): { sections: ProfitAndLossSection[]; netIncomeMinor: number; comparisonNetIncomeMinor: number | null } {
  function toRow(m: ProfitAndLossAccountMovement): ProfitAndLossRow {
    const currentPeriodMinor = calculateNormalBalance(m.normalBalance, m.currentDebitMinor, m.currentCreditMinor);
    const comparisonPeriodMinor = hasComparison
      ? calculateNormalBalance(m.normalBalance, m.comparisonDebitMinor, m.comparisonCreditMinor)
      : null;
    return {
      accountId: m.accountId,
      accountNumber: m.accountNumber,
      accountName: m.accountName,
      accountType: m.accountType,
      currentPeriodMinor,
      comparisonPeriodMinor,
      varianceMinor: calculateVariance(currentPeriodMinor, comparisonPeriodMinor),
    };
  }

  function contribution(m: ProfitAndLossAccountMovement, useComparison: boolean): number {
    return useComparison ? m.comparisonCreditMinor - m.comparisonDebitMinor : m.currentCreditMinor - m.currentDebitMinor;
  }

  function singleTypeSection(
    kind: ProfitAndLossSection["kind"],
    label: string,
    accountType: AccountType,
  ): ProfitAndLossSection {
    const rows = movements.filter((m) => m.accountType === accountType).map(toRow);
    const totalCurrentPeriodMinor = rows.reduce((sum, r) => sum + r.currentPeriodMinor, 0);
    const totalComparisonPeriodMinor = hasComparison ? rows.reduce((sum, r) => sum + (r.comparisonPeriodMinor ?? 0), 0) : null;
    return {
      kind,
      label,
      rows,
      totalCurrentPeriodMinor,
      totalComparisonPeriodMinor,
      totalVarianceMinor: calculateVariance(totalCurrentPeriodMinor, totalComparisonPeriodMinor),
    };
  }

  function rollupSection(
    kind: ProfitAndLossSection["kind"],
    label: string,
    totalCurrentPeriodMinor: number,
    totalComparisonPeriodMinor: number | null,
  ): ProfitAndLossSection {
    return {
      kind,
      label,
      rows: [],
      totalCurrentPeriodMinor,
      totalComparisonPeriodMinor,
      totalVarianceMinor: calculateVariance(totalCurrentPeriodMinor, totalComparisonPeriodMinor),
    };
  }

  const revenueRows = movements.filter((m) => m.accountType === "revenue" || m.accountType === "contra_revenue").map(toRow);
  const revenueCurrentTotal = movements
    .filter((m) => m.accountType === "revenue" || m.accountType === "contra_revenue")
    .reduce((sum, m) => sum + contribution(m, false), 0);
  const revenueComparisonTotal = hasComparison
    ? movements
        .filter((m) => m.accountType === "revenue" || m.accountType === "contra_revenue")
        .reduce((sum, m) => sum + contribution(m, true), 0)
    : null;
  const revenueSection: ProfitAndLossSection = {
    kind: "revenue",
    label: "Revenue",
    rows: revenueRows,
    totalCurrentPeriodMinor: revenueCurrentTotal,
    totalComparisonPeriodMinor: revenueComparisonTotal,
    totalVarianceMinor: calculateVariance(revenueCurrentTotal, revenueComparisonTotal),
  };

  const cogsSection = singleTypeSection("cost_of_goods_sold", "Cost of Goods Sold", "cost_of_goods_sold");
  const opexSection = singleTypeSection("operating_expense", "Operating Expenses", "operating_expense");
  const otherIncomeSection = singleTypeSection("other_income", "Other Income", "other_income");
  const otherExpenseSection = singleTypeSection("other_expense", "Other Expense", "other_expense");

  const grossProfitCurrent = revenueSection.totalCurrentPeriodMinor - cogsSection.totalCurrentPeriodMinor;
  const grossProfitComparison = hasComparison
    ? (revenueSection.totalComparisonPeriodMinor ?? 0) - (cogsSection.totalComparisonPeriodMinor ?? 0)
    : null;

  const operatingIncomeCurrent = grossProfitCurrent - opexSection.totalCurrentPeriodMinor;
  const operatingIncomeComparison = hasComparison ? grossProfitComparison! - (opexSection.totalComparisonPeriodMinor ?? 0) : null;

  const netIncomeMinor =
    operatingIncomeCurrent + otherIncomeSection.totalCurrentPeriodMinor - otherExpenseSection.totalCurrentPeriodMinor;
  const comparisonNetIncomeMinor = hasComparison
    ? operatingIncomeComparison! + (otherIncomeSection.totalComparisonPeriodMinor ?? 0) - (otherExpenseSection.totalComparisonPeriodMinor ?? 0)
    : null;

  const sections: ProfitAndLossSection[] = [
    revenueSection,
    cogsSection,
    rollupSection("gross_profit", "Gross Profit", grossProfitCurrent, grossProfitComparison),
    opexSection,
    rollupSection("operating_income", "Operating Income", operatingIncomeCurrent, operatingIncomeComparison),
    otherIncomeSection,
    otherExpenseSection,
    rollupSection("net_income", "Net Income", netIncomeMinor, comparisonNetIncomeMinor),
  ];

  return { sections, netIncomeMinor, comparisonNetIncomeMinor };
}

export interface BalanceSheetAccountBalance {
  accountId: string;
  accountNumber: number;
  accountName: string;
  accountType: AccountType;
  parentAccountId: string | null;
  closingBalanceMinor: number;
}

/**
 * Assembles Balance Sheet sections from flat, already-aggregated per-account
 * closing balances plus the ledger's cumulative current-period earnings
 * figure (see docs/finance-reports.md's Current-Period Earnings Treatment)
 * — the one place this assembly happens, shared by both repositories.
 */
export function buildBalanceSheetSections(
  balances: BalanceSheetAccountBalance[],
  currentPeriodEarningsMinor: number,
): { sections: BalanceSheetSection[]; totalAssetsMinor: number; totalLiabilitiesMinor: number; totalEquityMinor: number } {
  function toRow(b: BalanceSheetAccountBalance): BalanceSheetRow {
    return {
      accountId: b.accountId,
      accountNumber: b.accountNumber,
      accountName: b.accountName,
      accountType: b.accountType,
      parentAccountId: b.parentAccountId,
      closingBalanceMinor: b.closingBalanceMinor,
    };
  }

  function typeSection(kind: BalanceSheetSection["kind"], label: string, accountType: AccountType): BalanceSheetSection {
    const rows = balances.filter((b) => b.accountType === accountType).map(toRow);
    return { kind, label, rows, totalMinor: rows.reduce((sum, r) => sum + r.closingBalanceMinor, 0) };
  }

  const assetSection = typeSection("asset", "Assets", "asset");
  const liabilitySection = typeSection("liability", "Liabilities", "liability");
  const equitySection = typeSection("equity", "Equity", "equity");

  const totalEquityMinor = equitySection.totalMinor + currentPeriodEarningsMinor;
  const equitySectionWithEarnings: BalanceSheetSection = {
    ...equitySection,
    rows: [
      ...equitySection.rows,
      {
        accountId: "current-period-earnings",
        accountNumber: 0,
        accountName: "Current Period Earnings (Unclosed)",
        accountType: "equity",
        parentAccountId: null,
        closingBalanceMinor: currentPeriodEarningsMinor,
      },
    ],
    totalMinor: totalEquityMinor,
  };

  return {
    sections: [assetSection, liabilitySection, equitySectionWithEarnings],
    totalAssetsMinor: assetSection.totalMinor,
    totalLiabilitiesMinor: liabilitySection.totalMinor,
    totalEquityMinor,
  };
}
