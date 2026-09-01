import { describe, expect, it } from "vitest";
import { reconcileFinancialTotals } from "@/modules/finance/reconciliation";

const AGREEING = {
  operational: { revenueMinor: 500000, expenseMinor: 150000, netProfitMinor: 350000 },
  ledger: { revenueMinor: 500000, expenseMinor: 150000, netIncomeMinor: 350000 },
};

describe("reconcileFinancialTotals", () => {
  it("returns a clean, empty-discrepancy result when operational and ledger totals agree exactly, with nothing marked not-comparable", () => {
    const result = reconcileFinancialTotals(AGREEING.operational, AGREEING.ledger);
    expect(result).toEqual({ isReconciled: true, discrepancies: [], notComparable: [] });
  });

  it("detects a revenue mismatch without flagging expense or net income when only revenue diverges", () => {
    const result = reconcileFinancialTotals(
      { ...AGREEING.operational, revenueMinor: 520000 },
      AGREEING.ledger,
    );
    expect(result.isReconciled).toBe(false);
    expect(result.discrepancies).toEqual([
      { metric: "revenue", operationalMinor: 520000, ledgerMinor: 500000, differenceMinor: 20000 },
    ]);
    expect(result.notComparable).toEqual([]);
  });

  it("detects an expense mismatch, reporting a negative differenceMinor when the operational figure is lower than the ledger's", () => {
    const result = reconcileFinancialTotals(
      { ...AGREEING.operational, expenseMinor: 130000 },
      AGREEING.ledger,
    );
    expect(result.isReconciled).toBe(false);
    expect(result.discrepancies).toEqual([
      { metric: "expense", operationalMinor: 130000, ledgerMinor: 150000, differenceMinor: -20000 },
    ]);
  });

  it("detects a net income mismatch", () => {
    const result = reconcileFinancialTotals(
      { ...AGREEING.operational, netProfitMinor: 300000 },
      AGREEING.ledger,
    );
    expect(result.isReconciled).toBe(false);
    expect(result.discrepancies).toEqual([
      { metric: "net_income", operationalMinor: 300000, ledgerMinor: 350000, differenceMinor: -50000 },
    ]);
  });

  it("reports every metric that diverges simultaneously, not just the first one found", () => {
    const result = reconcileFinancialTotals(
      { revenueMinor: 520000, expenseMinor: 130000, netProfitMinor: 300000 },
      AGREEING.ledger,
    );
    expect(result.isReconciled).toBe(false);
    expect(result.discrepancies.map((d) => d.metric)).toEqual(["revenue", "expense", "net_income"]);
  });

  it("never mutates its inputs and produces no side effects — calling it twice with the same inputs returns equal results", () => {
    const operational = { ...AGREEING.operational };
    const ledger = { ...AGREEING.ledger };
    const first = reconcileFinancialTotals(operational, ledger);
    const second = reconcileFinancialTotals(operational, ledger);
    expect(first).toEqual(second);
    expect(operational).toEqual(AGREEING.operational);
    expect(ledger).toEqual(AGREEING.ledger);
  });

  // F1.5 — semantic non-comparability: BloomOS's current posting engine never
  // credits a Revenue account (post_payment_settlement debits Cash, credits
  // Accounts Receivable — not Revenue), so Revenue and the Net Income derived
  // from it are not meaningfully comparable yet. Passing `null` for either
  // side of a metric must skip that comparison entirely, never fabricate a
  // mismatch by treating null as zero.
  describe("non-comparable metrics (null handling)", () => {
    it("marks revenue not-comparable when the operational side is null, without affecting the expense check", () => {
      const result = reconcileFinancialTotals(
        { revenueMinor: null, expenseMinor: 150000, netProfitMinor: 350000 },
        AGREEING.ledger,
      );
      expect(result.notComparable).toEqual(["revenue"]);
      expect(result.discrepancies).toEqual([]);
      expect(result.isReconciled).toBe(true);
    });

    it("marks revenue not-comparable when the ledger side is null", () => {
      const result = reconcileFinancialTotals(AGREEING.operational, { ...AGREEING.ledger, revenueMinor: null });
      expect(result.notComparable).toEqual(["revenue"]);
    });

    it("marks net_income not-comparable when either side is null, independent of revenue/expense", () => {
      const result = reconcileFinancialTotals(
        { ...AGREEING.operational, netProfitMinor: null },
        AGREEING.ledger,
      );
      expect(result.notComparable).toEqual(["net_income"]);
      expect(result.isReconciled).toBe(true);
    });

    it("marks both revenue and net_income not-comparable simultaneously — the realistic BloomOS F1.5 case — while still genuinely comparing expense", () => {
      const result = reconcileFinancialTotals(
        { revenueMinor: null, expenseMinor: 150000, netProfitMinor: null },
        { revenueMinor: null, expenseMinor: 150000, netIncomeMinor: null },
      );
      expect(result.notComparable).toEqual(["revenue", "net_income"]);
      expect(result.discrepancies).toEqual([]);
      expect(result.isReconciled).toBe(true);
    });

    it("still detects a genuine expense mismatch even when revenue and net_income are both marked not-comparable", () => {
      const result = reconcileFinancialTotals(
        { revenueMinor: null, expenseMinor: 150000, netProfitMinor: null },
        { revenueMinor: null, expenseMinor: 90000, netIncomeMinor: null },
      );
      expect(result.notComparable).toEqual(["revenue", "net_income"]);
      expect(result.discrepancies).toEqual([
        { metric: "expense", operationalMinor: 150000, ledgerMinor: 90000, differenceMinor: 60000 },
      ]);
      expect(result.isReconciled).toBe(false);
    });

    it("never treats null as zero — a real ledger value of 0 compared against a real operational non-zero value IS a discrepancy, not skipped", () => {
      const result = reconcileFinancialTotals(
        { revenueMinor: 500000, expenseMinor: 150000, netProfitMinor: 350000 },
        { revenueMinor: 0, expenseMinor: 150000, netIncomeMinor: 350000 },
      );
      expect(result.notComparable).toEqual([]);
      expect(result.discrepancies).toEqual([
        { metric: "revenue", operationalMinor: 500000, ledgerMinor: 0, differenceMinor: 500000 },
      ]);
    });
  });
});
