/**
 * Finance F1 (extended in F1.5) — detection-only reconciliation between the
 * two independent financial calculation paths documented in
 * docs/finance-canonical-semantics.md: the operational summaries
 * (financialSummary.ts, re-summing raw Invoice/Payment/Expense rows) and
 * the real double-entry ledger (journal_entries/journal_lines, read via the
 * `finance_profit_and_loss_report` RPC). Nothing checks today that these
 * two agree — they happen to, in the common case, only because both trace
 * to the same underlying rows.
 *
 * This module is deliberately narrow: a pure comparison function, no I/O,
 * no mutation, no automatic correction. The caller is responsible for
 * fetching both sides (an operational summary for a period, and a real
 * ProfitAndLossReport for the same period) and handing them here — this
 * function only decides whether they agree and, if not, by how much.
 *
 * F1.5 — a metric may genuinely not be comparable under the current
 * BloomOS posting model, not merely "different because of timing." Tracing
 * every posting RPC (`post_purchase_receipt`, `post_payment_settlement`,
 * `post_expense_transition`) confirms none of them ever credits a
 * Revenue-type Chart of Accounts entry — `post_payment_settlement` debits
 * Cash and credits Accounts Receivable (or Customer Deposits), never a
 * revenue account. The ledger therefore has no systematic Revenue
 * recognition today, so comparing Operational Invoiced Revenue against the
 * ledger's Revenue section would not surface a real discrepancy — it would
 * report the same structural gap on every single call, forever, which is
 * not useful diagnostic information. Net Income is derived from Revenue on
 * the ledger side, so it inherits the same non-comparability. Pass `null`
 * for `revenueMinor`/`netProfitMinor`/`netIncomeMinor` on either side to
 * mark that metric as not comparable this period — `reconcileFinancialTotals`
 * skips the comparison and records it in `notComparable` instead of
 * silently treating `null` as zero (which would fabricate a discrepancy).
 * Expense IS genuinely comparable: `post_expense_transition`'s 'due'/'paid'
 * transitions post real amounts to real operating-expense accounts.
 */

export interface ReconciliationOperationalInputs {
  /** Invoiced Revenue for the period (accrual). Pass `null` if there's no meaningful ledger-side revenue figure to compare against this period — see the module doc comment. */
  revenueMinor: number | null;
  /** Accrual Expenses for the same period — genuinely comparable to the ledger's posted expense accounts today. */
  expenseMinor: number;
  /** Net Profit for the same period. Pass `null` for the same reason as `revenueMinor` — Net Income is derived from Revenue on the ledger side. */
  netProfitMinor: number | null;
}

export interface ReconciliationLedgerInputs {
  /** The real ledger's `ProfitAndLossReport.sections` revenue-kind total for the same period, or `null` when not meaningfully comparable this period. */
  revenueMinor: number | null;
  /** The real ledger's operating_expense (+ cost_of_goods_sold, if the caller includes it) section total for the same period. */
  expenseMinor: number;
  /** `ProfitAndLossReport.netIncomeMinor` for the same period, or `null` when not meaningfully comparable this period. */
  netIncomeMinor: number | null;
}

export type ReconciliationMetric = "revenue" | "expense" | "net_income";

export interface ReconciliationDiscrepancy {
  metric: ReconciliationMetric;
  operationalMinor: number;
  ledgerMinor: number;
  /** operationalMinor - ledgerMinor. Positive means the operational figure is higher than the ledger's. */
  differenceMinor: number;
}

export interface ReconciliationResult {
  isReconciled: boolean;
  discrepancies: ReconciliationDiscrepancy[];
  /** Metrics deliberately not compared this call, because either side passed `null` (not merely because they happened to match). */
  notComparable: ReconciliationMetric[];
}

function compare(
  metric: ReconciliationMetric,
  operationalMinor: number | null,
  ledgerMinor: number | null,
): { discrepancy: ReconciliationDiscrepancy | null; comparable: boolean } {
  if (operationalMinor === null || ledgerMinor === null) {
    return { discrepancy: null, comparable: false };
  }
  if (operationalMinor === ledgerMinor) return { discrepancy: null, comparable: true };
  return { discrepancy: { metric, operationalMinor, ledgerMinor, differenceMinor: operationalMinor - ledgerMinor }, comparable: true };
}

/**
 * Pure — no I/O, no mutation. Compares the operational and ledger sides of
 * the same period for every metric where both sides supplied a real number,
 * and returns any mismatch found. Exact integer-minor-unit equality is the
 * bar — both sides are already integer cents, so there's no rounding
 * tolerance to account for; any nonzero difference is real and worth
 * surfacing, even if its cause turns out to be an ordinary timing
 * difference (e.g. an Invoice issued but its settlement not yet posted)
 * rather than an actual error. This function does not attempt to explain
 * *why* a discrepancy exists — only that one does, so a human can look. A
 * metric where either side is `null` is recorded in `notComparable`
 * instead of being silently treated as a zero-vs-real mismatch.
 */
export function reconcileFinancialTotals(
  operational: ReconciliationOperationalInputs,
  ledger: ReconciliationLedgerInputs,
): ReconciliationResult {
  const checks: [ReconciliationMetric, number | null, number | null][] = [
    ["revenue", operational.revenueMinor, ledger.revenueMinor],
    ["expense", operational.expenseMinor, ledger.expenseMinor],
    ["net_income", operational.netProfitMinor, ledger.netIncomeMinor],
  ];

  const discrepancies: ReconciliationDiscrepancy[] = [];
  const notComparable: ReconciliationMetric[] = [];

  for (const [metric, operationalMinor, ledgerMinor] of checks) {
    const { discrepancy, comparable } = compare(metric, operationalMinor, ledgerMinor);
    if (!comparable) {
      notComparable.push(metric);
    } else if (discrepancy) {
      discrepancies.push(discrepancy);
    }
  }

  return { isReconciled: discrepancies.length === 0, discrepancies, notComparable };
}
