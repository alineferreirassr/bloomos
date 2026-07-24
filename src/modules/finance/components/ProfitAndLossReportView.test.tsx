import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfitAndLossReportView } from "@/modules/finance/components/ProfitAndLossReportView";
import type { ProfitAndLossReport, ProfitAndLossSection } from "@/types/financeReport";

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/reports/profit-and-loss",
}));

vi.mock("@/lib/data", () => ({
  getProfitAndLossReport: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function section(overrides: Partial<ProfitAndLossSection>): ProfitAndLossSection {
  return {
    kind: "revenue",
    label: "Revenue",
    rows: [],
    totalCurrentPeriodMinor: 0,
    totalComparisonPeriodMinor: null,
    totalVarianceMinor: null,
    ...overrides,
  };
}

function makeReport(overrides: Partial<ProfitAndLossReport> = {}): ProfitAndLossReport {
  return {
    workspaceId: "ws1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    startDate: "2026-07-01",
    endDate: "2026-07-23",
    comparisonStartDate: null,
    comparisonEndDate: null,
    sections: [
      section({ kind: "revenue", label: "Revenue" }),
      section({ kind: "cost_of_goods_sold", label: "Cost of Goods Sold" }),
      section({ kind: "gross_profit", label: "Gross Profit" }),
      section({ kind: "operating_expense", label: "Operating Expenses" }),
      section({ kind: "operating_income", label: "Operating Income" }),
      section({ kind: "other_income", label: "Other Income" }),
      section({ kind: "other_expense", label: "Other Expense" }),
      section({ kind: "net_income", label: "Net Income" }),
    ],
    netIncomeMinor: 0,
    comparisonNetIncomeMinor: null,
    ...overrides,
  };
}

describe("ProfitAndLossReportView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the current month with comparison omitted", async () => {
    vi.mocked(dataLayer.getProfitAndLossReport).mockResolvedValue(makeReport());
    render(<ProfitAndLossReportView />);

    await waitFor(() => expect(dataLayer.getProfitAndLossReport).toHaveBeenCalledTimes(1));
    const [args] = vi.mocked(dataLayer.getProfitAndLossReport).mock.calls[0];
    expect(args.startDate.slice(8, 10)).toBe("01");
    expect(args.comparison).toBeUndefined();
  });

  it("omits comparison arguments when the toggle is off, and includes them when on", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getProfitAndLossReport).mockResolvedValue(makeReport());
    render(<ProfitAndLossReportView />);
    await waitFor(() => expect(dataLayer.getProfitAndLossReport).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("checkbox", { name: /compare to another period/i }));
    await user.type(screen.getByLabelText("Comparison start date"), "2026-06-01");
    await user.type(screen.getByLabelText("Comparison end date"), "2026-06-30");
    await user.click(screen.getByRole("button", { name: "Run Report" }));

    await waitFor(() => expect(dataLayer.getProfitAndLossReport).toHaveBeenCalledTimes(2));
    const [args] = vi.mocked(dataLayer.getProfitAndLossReport).mock.calls[1];
    expect(args.comparison).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30" });
  });

  it("rejects an inverted comparison range client-side without calling the Repository", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getProfitAndLossReport).mockResolvedValue(makeReport());
    render(<ProfitAndLossReportView />);
    await waitFor(() => expect(dataLayer.getProfitAndLossReport).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("checkbox", { name: /compare to another period/i }));
    await user.type(screen.getByLabelText("Comparison start date"), "2026-06-30");
    await user.type(screen.getByLabelText("Comparison end date"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "Run Report" }));

    expect(
      await screen.findByText(/comparison end date must not be before comparison start date/i),
    ).toBeInTheDocument();
    expect(dataLayer.getProfitAndLossReport).toHaveBeenCalledTimes(1);
  });

  it("renders sections in the committed accounting order and shows Net Income prominently", async () => {
    vi.mocked(dataLayer.getProfitAndLossReport).mockResolvedValue(
      makeReport({
        sections: [
          section({
            kind: "revenue",
            label: "Revenue",
            rows: [
              { accountId: "r1", accountNumber: 4000, accountName: "Service Revenue", accountType: "revenue", currentPeriodMinor: 100000, comparisonPeriodMinor: null, varianceMinor: null },
            ],
            totalCurrentPeriodMinor: 100000,
          }),
          section({ kind: "cost_of_goods_sold", label: "Cost of Goods Sold" }),
          section({ kind: "gross_profit", label: "Gross Profit", totalCurrentPeriodMinor: 100000 }),
          section({ kind: "operating_expense", label: "Operating Expenses" }),
          section({ kind: "operating_income", label: "Operating Income", totalCurrentPeriodMinor: 100000 }),
          section({ kind: "other_income", label: "Other Income" }),
          section({ kind: "other_expense", label: "Other Expense" }),
          section({ kind: "net_income", label: "Net Income", totalCurrentPeriodMinor: 100000 }),
        ],
        netIncomeMinor: 100000,
      }),
    );

    render(<ProfitAndLossReportView />);

    const headings = await screen.findAllByRole("heading", { level: 4 });
    // Only sections with rows (Revenue) plus the three always-shown rollups render as headings;
    // empty non-rollup sections (COGS, OpEx, Other Income, Other Expense) are not rendered at all.
    expect(headings.map((h) => h.textContent)).toEqual(["Revenue"]);
    expect(screen.getByText("Gross Profit")).toBeInTheDocument();
    expect(screen.getByText("Operating Income")).toBeInTheDocument();
    expect(screen.getByText("Net Income")).toBeInTheDocument();
    expect(screen.getAllByText("$1,000.00").length).toBeGreaterThan(0); // returned total, not recomputed
  });

  it("shows a report-specific empty state when no income-statement account has activity", async () => {
    vi.mocked(dataLayer.getProfitAndLossReport).mockResolvedValue(makeReport());
    render(<ProfitAndLossReportView />);

    expect(await screen.findByText(/no income-statement activity for this period/i)).toBeInTheDocument();
  });

  it("shows a user-facing error message on failure", async () => {
    vi.mocked(dataLayer.getProfitAndLossReport).mockRejectedValue(new Error("Could not load Profit and Loss."));
    render(<ProfitAndLossReportView />);

    expect(await screen.findByText("Could not load Profit and Loss.")).toBeInTheDocument();
  });
});
