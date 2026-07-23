import { describe, expect, it } from "vitest";
import {
  calculateNormalBalance,
  calculateRunningBalance,
  splitEndingBalance,
  validateTrialBalance,
  validateAccountingEquation,
  groupAccountsByType,
  calculateVariance,
  buildProfitAndLossSections,
  buildBalanceSheetSections,
  type ProfitAndLossAccountMovement,
  type BalanceSheetAccountBalance,
} from "@/lib/data/finance/reportCalculations";

describe("calculateNormalBalance", () => {
  it("computes debit-normal balance as debit minus credit", () => {
    expect(calculateNormalBalance("debit", 10000, 3000)).toBe(7000);
  });

  it("computes credit-normal balance as credit minus debit", () => {
    expect(calculateNormalBalance("credit", 3000, 10000)).toBe(7000);
  });

  it("returns zero for equal debit and credit activity", () => {
    expect(calculateNormalBalance("debit", 5000, 5000)).toBe(0);
    expect(calculateNormalBalance("credit", 5000, 5000)).toBe(0);
  });

  it("returns a negative value when an account goes abnormal (e.g. a credit against a debit-normal account)", () => {
    expect(calculateNormalBalance("debit", 0, 5000)).toBe(-5000);
  });

  it("reflects a reversal's swapped debit/credit as fully offsetting the original", () => {
    const original = calculateNormalBalance("debit", 10000, 0);
    const reversal = calculateNormalBalance("debit", 0, 10000);
    expect(original + reversal).toBe(0);
  });
});

describe("calculateRunningBalance", () => {
  it("seeds from the opening balance and accumulates in order", () => {
    const result = calculateRunningBalance("debit", 1000, [
      { debitMinor: 500, creditMinor: 0 },
      { debitMinor: 0, creditMinor: 200 },
      { debitMinor: 100, creditMinor: 0 },
    ]);
    expect(result).toEqual([1500, 1300, 1400]);
  });

  it("returns an empty array for no movements", () => {
    expect(calculateRunningBalance("credit", 500, [])).toEqual([]);
  });
});

describe("splitEndingBalance", () => {
  it("places a positive net on the debit side", () => {
    expect(splitEndingBalance(10000, 4000)).toEqual({ endingDebitMinor: 6000, endingCreditMinor: 0 });
  });

  it("places a negative net on the credit side", () => {
    expect(splitEndingBalance(4000, 10000)).toEqual({ endingDebitMinor: 0, endingCreditMinor: 6000 });
  });

  it("places a zero net on neither side", () => {
    expect(splitEndingBalance(5000, 5000)).toEqual({ endingDebitMinor: 0, endingCreditMinor: 0 });
  });
});

describe("validateTrialBalance", () => {
  it("reports balanced when total ending debits equal total ending credits", () => {
    const result = validateTrialBalance([
      { endingDebitMinor: 10000, endingCreditMinor: 0 },
      { endingDebitMinor: 0, endingCreditMinor: 10000 },
    ]);
    expect(result).toEqual({ isBalanced: true, totalEndingDebitMinor: 10000, totalEndingCreditMinor: 10000 });
  });

  it("detects an unbalanced result without silently correcting it", () => {
    const result = validateTrialBalance([
      { endingDebitMinor: 10000, endingCreditMinor: 0 },
      { endingDebitMinor: 0, endingCreditMinor: 9000 },
    ]);
    expect(result.isBalanced).toBe(false);
    expect(result.totalEndingDebitMinor).toBe(10000);
    expect(result.totalEndingCreditMinor).toBe(9000);
  });
});

describe("validateAccountingEquation", () => {
  it("returns true when assets equal liabilities plus equity", () => {
    expect(validateAccountingEquation(10000, 4000, 6000)).toBe(true);
  });

  it("returns false when the equation does not hold, without adjusting anything", () => {
    expect(validateAccountingEquation(10000, 4000, 5000)).toBe(false);
  });
});

describe("groupAccountsByType", () => {
  it("groups rows by accountType, preserving order within each group", () => {
    const rows = [
      { accountType: "asset" as const, name: "Cash" },
      { accountType: "liability" as const, name: "AP" },
      { accountType: "asset" as const, name: "AR" },
    ];
    const groups = groupAccountsByType(rows);
    expect(groups.get("asset")?.map((r) => r.name)).toEqual(["Cash", "AR"]);
    expect(groups.get("liability")?.map((r) => r.name)).toEqual(["AP"]);
  });
});

describe("calculateVariance", () => {
  it("returns null when no comparison was requested", () => {
    expect(calculateVariance(1000, null)).toBeNull();
  });

  it("returns the signed difference when a comparison exists, including a zero comparison", () => {
    expect(calculateVariance(1000, 400)).toBe(600);
    expect(calculateVariance(1000, 0)).toBe(1000);
  });
});

function movement(overrides: Partial<ProfitAndLossAccountMovement>): ProfitAndLossAccountMovement {
  return {
    accountId: "account_test",
    accountNumber: 4000,
    accountName: "Test Account",
    accountType: "revenue",
    normalBalance: "credit",
    currentDebitMinor: 0,
    currentCreditMinor: 0,
    comparisonDebitMinor: 0,
    comparisonCreditMinor: 0,
    ...overrides,
  };
}

describe("buildProfitAndLossSections", () => {
  it("computes net income as revenue minus expenses", () => {
    const { netIncomeMinor } = buildProfitAndLossSections(
      [
        movement({ accountId: "rev", accountType: "revenue", normalBalance: "credit", currentCreditMinor: 10000 }),
        movement({ accountId: "opex", accountType: "operating_expense", normalBalance: "debit", currentDebitMinor: 3000 }),
      ],
      false,
    );
    expect(netIncomeMinor).toBe(7000);
  });

  it("nets contra_revenue against revenue within the Revenue section", () => {
    const { sections } = buildProfitAndLossSections(
      [
        movement({ accountId: "rev", accountType: "revenue", normalBalance: "credit", currentCreditMinor: 10000 }),
        movement({ accountId: "discount", accountType: "contra_revenue", normalBalance: "debit", currentDebitMinor: 1500 }),
      ],
      false,
    );
    const revenueSection = sections.find((s) => s.kind === "revenue")!;
    expect(revenueSection.totalCurrentPeriodMinor).toBe(8500);
    // Each row still shows its own natural positive magnitude, not the netted total.
    expect(revenueSection.rows.find((r) => r.accountId === "discount")?.currentPeriodMinor).toBe(1500);
  });

  it("computes Gross Profit, Operating Income, and Net Income rollups in the standard order", () => {
    const { sections } = buildProfitAndLossSections(
      [
        movement({ accountId: "rev", accountType: "revenue", normalBalance: "credit", currentCreditMinor: 20000 }),
        movement({ accountId: "cogs", accountType: "cost_of_goods_sold", normalBalance: "debit", currentDebitMinor: 5000 }),
        movement({ accountId: "opex", accountType: "operating_expense", normalBalance: "debit", currentDebitMinor: 3000 }),
        movement({ accountId: "oi", accountType: "other_income", normalBalance: "credit", currentCreditMinor: 1000 }),
        movement({ accountId: "oe", accountType: "other_expense", normalBalance: "debit", currentDebitMinor: 500 }),
      ],
      false,
    );
    const totalsByKind = Object.fromEntries(sections.map((s) => [s.kind, s.totalCurrentPeriodMinor]));
    expect(totalsByKind.gross_profit).toBe(15000); // 20000 - 5000
    expect(totalsByKind.operating_income).toBe(12000); // 15000 - 3000
    expect(totalsByKind.net_income).toBe(12500); // 12000 + 1000 - 500
  });

  it("excludes any asset/liability/equity account type from every section", () => {
    const { sections } = buildProfitAndLossSections(
      [movement({ accountId: "rev", accountType: "revenue", normalBalance: "credit", currentCreditMinor: 1000 })],
      false,
    );
    for (const section of sections) {
      for (const row of section.rows) {
        expect(["revenue", "contra_revenue", "cost_of_goods_sold", "operating_expense", "other_income", "other_expense"]).toContain(
          row.accountType,
        );
      }
    }
  });

  it("computes a comparison period and variance when requested", () => {
    const { sections, netIncomeMinor, comparisonNetIncomeMinor } = buildProfitAndLossSections(
      [
        movement({
          accountId: "rev",
          accountType: "revenue",
          normalBalance: "credit",
          currentCreditMinor: 10000,
          comparisonCreditMinor: 8000,
        }),
      ],
      true,
    );
    const revenueSection = sections.find((s) => s.kind === "revenue")!;
    expect(revenueSection.totalComparisonPeriodMinor).toBe(8000);
    expect(revenueSection.totalVarianceMinor).toBe(2000);
    expect(netIncomeMinor).toBe(10000);
    expect(comparisonNetIncomeMinor).toBe(8000);
  });

  it("reflects a fully reversed entry as zero net movement", () => {
    const { netIncomeMinor } = buildProfitAndLossSections(
      [movement({ accountId: "rev", accountType: "revenue", normalBalance: "credit", currentCreditMinor: 5000, currentDebitMinor: 5000 })],
      false,
    );
    expect(netIncomeMinor).toBe(0);
  });
});

function balance(overrides: Partial<BalanceSheetAccountBalance>): BalanceSheetAccountBalance {
  return {
    accountId: "account_test",
    accountNumber: 1000,
    accountName: "Test Account",
    accountType: "asset",
    parentAccountId: null,
    closingBalanceMinor: 0,
    ...overrides,
  };
}

describe("buildBalanceSheetSections", () => {
  it("groups rows into Assets, Liabilities, and Equity sections", () => {
    const { sections } = buildBalanceSheetSections(
      [
        balance({ accountId: "cash", accountType: "asset", closingBalanceMinor: 10000 }),
        balance({ accountId: "ap", accountType: "liability", closingBalanceMinor: 4000 }),
        balance({ accountId: "equity", accountType: "equity", closingBalanceMinor: 1000 }),
      ],
      0,
    );
    expect(sections.find((s) => s.kind === "asset")?.totalMinor).toBe(10000);
    expect(sections.find((s) => s.kind === "liability")?.totalMinor).toBe(4000);
  });

  it("includes current-period earnings as a labeled synthetic line within Equity, keeping the equation balanced", () => {
    const { sections, totalAssetsMinor, totalLiabilitiesMinor, totalEquityMinor } = buildBalanceSheetSections(
      [
        balance({ accountId: "cash", accountType: "asset", closingBalanceMinor: 10000 }),
        balance({ accountId: "ap", accountType: "liability", closingBalanceMinor: 3000 }),
      ],
      7000,
    );
    const equitySection = sections.find((s) => s.kind === "equity")!;
    expect(equitySection.rows.find((r) => r.accountName.includes("Current Period Earnings"))?.closingBalanceMinor).toBe(7000);
    expect(totalEquityMinor).toBe(7000);
    expect(validateAccountingEquation(totalAssetsMinor, totalLiabilitiesMinor, totalEquityMinor)).toBe(true);
  });

  it("adds current-period earnings on top of any already-posted equity account activity", () => {
    const { totalEquityMinor } = buildBalanceSheetSections(
      [balance({ accountId: "owner-equity", accountType: "equity", closingBalanceMinor: 2000 })],
      500,
    );
    expect(totalEquityMinor).toBe(2500);
  });
});
