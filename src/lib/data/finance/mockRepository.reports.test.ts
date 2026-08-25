import { afterEach, describe, expect, it } from "vitest";
import { mockFinanceRepository } from "@/lib/data/finance/mockRepository";
import { resetChartOfAccountsStore } from "@/lib/data/mock/chartOfAccountsStore";
import {
  resetJournalEntriesStore,
  readJournalEntries,
  writeJournalEntries,
} from "@/lib/data/mock/journalEntriesStore";
import { resetJournalLinesStore, readJournalLines, writeJournalLines } from "@/lib/data/mock/journalLinesStore";
import { resetAccountingPeriodsStore } from "@/lib/data/mock/accountingPeriodsStore";
import { resetAuditLogStore } from "@/lib/data/core/audit/mockRepository";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { ManualAdjustmentInput } from "@/modules/finance/schema";

afterEach(() => {
  resetChartOfAccountsStore();
  resetJournalEntriesStore();
  resetJournalLinesStore();
  resetAccountingPeriodsStore();
  resetAuditLogStore();
});

async function postAdjustment(input: ManualAdjustmentInput) {
  const result = await mockFinanceRepository.recordManualAdjustment(input, crypto.randomUUID());
  if (!result.success) throw new Error(`Seed adjustment failed: ${result.error}`);
  return result.data;
}

/** Directly injects a non-posted (pending) entry the write methods can never produce, to prove reports exclude it. */
function injectPendingEntry(entryDate: string) {
  const entry = {
    id: "entry_pending_test",
    workspace_id: CURRENT_WORKSPACE_ID,
    entry_date: entryDate,
    accounting_period_id: "accounting_period_1",
    source_type: "manual_adjustment",
    source_id: null,
    posting_key: null,
    memo: "Should never appear in a report",
    currency: "USD",
    reversed_by_entry_id: null,
    reverses_entry_id: null,
    posting_status: "pending" as const,
    failure_reason: null,
    posted_by: "test",
    created_at: "2026-07-01T00:00:00.000Z",
  };
  writeJournalEntries([...readJournalEntries(), entry]);
  writeJournalLines([
    ...readJournalLines(),
    {
      id: "line_pending_test",
      journal_entry_id: entry.id,
      workspace_id: CURRENT_WORKSPACE_ID,
      account_id: "account_1000",
      debit_minor: 999999,
      credit_minor: 0,
      currency: "USD",
      amount_in_base_currency_minor: 999999,
      line_memo: null,
      line_order: 0,
      created_at: "2026-07-01T00:00:00.000Z",
    },
  ]);
}

/** Directly injects an entry belonging to a different workspace, to prove reports never cross workspace boundaries. */
function injectOtherWorkspaceEntry(entryDate: string) {
  const entry = {
    id: "entry_other_workspace",
    workspace_id: "ws_other",
    entry_date: entryDate,
    accounting_period_id: "accounting_period_other",
    source_type: "manual_adjustment",
    source_id: null,
    posting_key: null,
    memo: "Different workspace",
    currency: "USD",
    reversed_by_entry_id: null,
    reverses_entry_id: null,
    posting_status: "posted" as const,
    failure_reason: null,
    posted_by: "test",
    created_at: "2026-07-01T00:00:00.000Z",
  };
  writeJournalEntries([...readJournalEntries(), entry]);
  writeJournalLines([
    ...readJournalLines(),
    {
      id: "line_other_workspace",
      journal_entry_id: entry.id,
      workspace_id: "ws_other",
      account_id: "account_1000",
      debit_minor: 888888,
      credit_minor: 0,
      currency: "USD",
      amount_in_base_currency_minor: 888888,
      line_memo: null,
      line_order: 0,
      created_at: "2026-07-01T00:00:00.000Z",
    },
  ]);
}

describe("mockFinanceRepository.getGeneralLedgerReport", () => {
  it("computes an opening balance from activity strictly before the start date", async () => {
    await postAdjustment({
      entry_date: "2026-06-01",
      memo: "Prior activity",
      lines: [
        { account_id: "account_1000", debit_minor: 10000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 10000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const cash = report.accounts.find((a) => a.accountId === "account_1000")!;
    expect(cash.openingBalanceMinor).toBe(10000);
    expect(cash.transactions).toHaveLength(0);
    expect(cash.closingBalanceMinor).toBe(10000);
  });

  it("lists in-range transactions with a correct running balance and closing balance", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "First",
      lines: [
        { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 5000, line_memo: null },
      ],
    });
    await postAdjustment({
      entry_date: "2026-07-20",
      memo: "Second",
      lines: [
        { account_id: "account_1000", debit_minor: 0, credit_minor: 2000, line_memo: null },
        { account_id: "account_6900", debit_minor: 2000, credit_minor: 0, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const cash = report.accounts.find((a) => a.accountId === "account_1000")!;
    expect(cash.openingBalanceMinor).toBe(0);
    expect(cash.transactions.map((t) => t.runningBalanceMinor)).toEqual([5000, 3000]);
    expect(cash.closingBalanceMinor).toBe(3000);
  });

  it("orders transactions deterministically by entry date", async () => {
    await postAdjustment({
      entry_date: "2026-07-20",
      memo: "Later",
      lines: [
        { account_id: "account_1000", debit_minor: 1000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 1000, line_memo: null },
      ],
    });
    await postAdjustment({
      entry_date: "2026-07-05",
      memo: "Earlier",
      lines: [
        { account_id: "account_1000", debit_minor: 500, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 500, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const cash = report.accounts.find((a) => a.accountId === "account_1000")!;
    expect(cash.transactions.map((t) => t.memo)).toEqual(["Earlier", "Later"]);
  });

  it("filters to a single account when accountId is given", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Both accounts move",
      lines: [
        { account_id: "account_1000", debit_minor: 1000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 1000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getGeneralLedgerReport({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      accountId: "account_1000",
    });
    expect(report.accounts).toHaveLength(1);
    expect(report.accounts[0].accountId).toBe("account_1000");
  });

  it("excludes transactions outside the requested date range", async () => {
    await postAdjustment({
      entry_date: "2026-08-15",
      memo: "Outside range",
      lines: [
        { account_id: "account_1000", debit_minor: 1000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 1000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const cash = report.accounts.find((a) => a.accountId === "account_1000")!;
    expect(cash.transactions).toHaveLength(0);
    expect(cash.openingBalanceMinor).toBe(0);
  });

  it("excludes non-posted entries", async () => {
    injectPendingEntry("2026-07-10");
    const report = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const cash = report.accounts.find((a) => a.accountId === "account_1000")!;
    expect(cash.transactions).toHaveLength(0);
  });

  it("never includes another workspace's entries", async () => {
    injectOtherWorkspaceEntry("2026-07-10");
    const report = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const cash = report.accounts.find((a) => a.accountId === "account_1000")!;
    expect(cash.transactions).toHaveLength(0);
    expect(cash.openingBalanceMinor).toBe(0);
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-07-31", endDate: "2026-07-01" }),
    ).rejects.toThrow(/end date/i);
  });
});

describe("mockFinanceRepository.getTrialBalanceReport", () => {
  it("places a net-debit account on the debit side and a net-credit account on the credit side", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Adjustment",
      lines: [
        { account_id: "account_1000", debit_minor: 8000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 8000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31" });
    const cash = report.rows.find((r) => r.accountId === "account_1000")!;
    const revenue = report.rows.find((r) => r.accountId === "account_4000")!;
    expect(cash.endingDebitMinor).toBe(8000);
    expect(cash.endingCreditMinor).toBe(0);
    expect(revenue.endingDebitMinor).toBe(0);
    expect(revenue.endingCreditMinor).toBe(8000);
  });

  it("reports total ending debits equal to total ending credits and isBalanced true", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Adjustment",
      lines: [
        { account_id: "account_1000", debit_minor: 3000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 3000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31" });
    expect(report.totalEndingDebitMinor).toBe(report.totalEndingCreditMinor);
    expect(report.isBalanced).toBe(true);
  });

  it("excludes zero-balance accounts by default and includes them when requested", async () => {
    const withoutZero = await mockFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31" });
    expect(withoutZero.rows).toHaveLength(0);

    const withZero = await mockFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31", includeZeroBalances: true });
    expect(withZero.rows.length).toBeGreaterThan(30);
  });

  it("keeps an archived account with historical activity visible", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Adjustment",
      lines: [
        { account_id: "account_1000", debit_minor: 1000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 1000, line_memo: null },
      ],
    });
    const { readChartOfAccounts, writeChartOfAccounts } = await import("@/lib/data/mock/chartOfAccountsStore");
    writeChartOfAccounts(
      readChartOfAccounts().map((a) => (a.id === "account_4000" ? { ...a, archived_at: "2026-07-15T00:00:00.000Z" } : a)),
    );

    const report = await mockFinanceRepository.getTrialBalanceReport({ asOfDate: "2026-07-31" });
    const revenue = report.rows.find((r) => r.accountId === "account_4000");
    expect(revenue).toBeDefined();
    expect(revenue?.isArchived).toBe(true);
  });

  it("cross-checks: every account's Trial Balance net equals its General Ledger closing balance as of the same date", async () => {
    await postAdjustment({
      entry_date: "2026-06-05",
      memo: "Early activity",
      lines: [
        { account_id: "account_1000", debit_minor: 4000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 4000, line_memo: null },
      ],
    });
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Later activity",
      lines: [
        { account_id: "account_1000", debit_minor: 0, credit_minor: 1500, line_memo: null },
        { account_id: "account_6900", debit_minor: 1500, credit_minor: 0, line_memo: null },
      ],
    });

    const asOfDate = "2026-07-31";
    const trialBalance = await mockFinanceRepository.getTrialBalanceReport({ asOfDate, includeZeroBalances: true });
    const generalLedger = await mockFinanceRepository.getGeneralLedgerReport({ startDate: "2026-01-01", endDate: asOfDate });

    for (const tbRow of trialBalance.rows) {
      const glAccount = generalLedger.accounts.find((a) => a.accountId === tbRow.accountId)!;
      const tbNet = tbRow.endingDebitMinor - tbRow.endingCreditMinor;
      // Subtraction, never unary negation — `0 - 0` is +0 in JS, while `-0`
      // (negating a +0 balance) would be -0, and `Object.is`-based equality
      // (what `.toBe()` uses) treats -0 and +0 as distinct.
      const glNet = tbRow.normalBalance === "debit" ? glAccount.closingBalanceMinor : 0 - glAccount.closingBalanceMinor;
      expect(tbNet).toBe(glNet);
    }
  });
});

describe("mockFinanceRepository.getProfitAndLossReport", () => {
  it("shows revenue and expenses and computes net income", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Revenue",
      lines: [
        { account_id: "account_1000", debit_minor: 10000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 10000, line_memo: null },
      ],
    });
    await postAdjustment({
      entry_date: "2026-07-15",
      memo: "Expense",
      lines: [
        { account_id: "account_6900", debit_minor: 3000, credit_minor: 0, line_memo: null },
        { account_id: "account_1000", debit_minor: 0, credit_minor: 3000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getProfitAndLossReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(report.netIncomeMinor).toBe(7000);
    const revenueSection = report.sections.find((s) => s.kind === "revenue")!;
    expect(revenueSection.totalCurrentPeriodMinor).toBe(10000);
  });

  it("excludes activity outside the requested date range", async () => {
    await postAdjustment({
      entry_date: "2026-08-10",
      memo: "Outside range",
      lines: [
        { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 5000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getProfitAndLossReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(report.netIncomeMinor).toBe(0);
  });

  it("computes a comparison period alongside the current one", async () => {
    await postAdjustment({
      entry_date: "2026-06-10",
      memo: "June revenue",
      lines: [
        { account_id: "account_1000", debit_minor: 4000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 4000, line_memo: null },
      ],
    });
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "July revenue",
      lines: [
        { account_id: "account_1000", debit_minor: 6000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 6000, line_memo: null },
      ],
    });

    const report = await mockFinanceRepository.getProfitAndLossReport({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      comparison: { startDate: "2026-06-01", endDate: "2026-06-30" },
    });
    expect(report.netIncomeMinor).toBe(6000);
    expect(report.comparisonNetIncomeMinor).toBe(4000);
  });

  it("nets a reversed entry to zero movement", async () => {
    const original = await postAdjustment({
      entry_date: "2026-07-10",
      memo: "To be reversed",
      lines: [
        { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 5000, line_memo: null },
      ],
    });
    const reversal = await mockFinanceRepository.reverseJournalEntry(original.id, { reason: "Correction" });
    expect(reversal.success).toBe(true);

    const report = await mockFinanceRepository.getProfitAndLossReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(report.netIncomeMinor).toBe(0);
  });

  it("never includes an asset, liability, or equity account in any section", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Revenue",
      lines: [
        { account_id: "account_1000", debit_minor: 1000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 1000, line_memo: null },
      ],
    });
    const report = await mockFinanceRepository.getProfitAndLossReport({ startDate: "2026-07-01", endDate: "2026-07-31" });
    const allRows = report.sections.flatMap((s) => s.rows);
    expect(allRows.every((r) => r.accountId !== "account_1000")).toBe(true);
  });
});

describe("mockFinanceRepository.getBalanceSheetReport", () => {
  it("groups accounts into Assets, Liabilities, and Equity", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Adjustment",
      lines: [
        { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
        { account_id: "account_2000", debit_minor: 0, credit_minor: 5000, line_memo: null },
      ],
    });
    const report = await mockFinanceRepository.getBalanceSheetReport({ asOfDate: "2026-07-31" });
    expect(report.sections.find((s) => s.kind === "asset")?.totalMinor).toBe(5000);
    expect(report.sections.find((s) => s.kind === "liability")?.totalMinor).toBe(5000);
  });

  it("includes a labeled current-period earnings line and keeps the accounting equation true", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Revenue posted directly to cash",
      lines: [
        { account_id: "account_1000", debit_minor: 8000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 8000, line_memo: null },
      ],
    });
    const report = await mockFinanceRepository.getBalanceSheetReport({ asOfDate: "2026-07-31" });
    expect(report.currentPeriodEarningsMinor).toBe(8000);
    expect(report.isBalanced).toBe(true);
    expect(report.totalAssetsMinor).toBe(report.totalLiabilitiesMinor + report.totalEquityMinor);
  });

  it("excludes activity after the as-of date", async () => {
    await postAdjustment({
      entry_date: "2026-08-15",
      memo: "Future activity",
      lines: [
        { account_id: "account_1000", debit_minor: 1000, credit_minor: 0, line_memo: null },
        { account_id: "account_4000", debit_minor: 0, credit_minor: 1000, line_memo: null },
      ],
    });
    const report = await mockFinanceRepository.getBalanceSheetReport({ asOfDate: "2026-07-31" });
    expect(report.totalAssetsMinor).toBe(0);
    expect(report.currentPeriodEarningsMinor).toBe(0);
  });

  it("represents a net loss as negative current-period earnings while the equation still holds", async () => {
    await postAdjustment({
      entry_date: "2026-07-10",
      memo: "Expense paid directly from cash, no offsetting revenue",
      lines: [
        { account_id: "account_6900", debit_minor: 3000, credit_minor: 0, line_memo: null },
        { account_id: "account_1000", debit_minor: 0, credit_minor: 3000, line_memo: null },
      ],
    });
    const report = await mockFinanceRepository.getBalanceSheetReport({ asOfDate: "2026-07-31" });
    expect(report.currentPeriodEarningsMinor).toBe(-3000);
    expect(report.totalEquityMinor).toBe(-3000);
    expect(report.isBalanced).toBe(true);
    expect(report.totalAssetsMinor).toBe(-3000);
  });
});
