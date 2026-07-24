import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BalanceSheetReportView } from "@/modules/finance/components/BalanceSheetReportView";
import type { BalanceSheetReport, BalanceSheetSection } from "@/types/financeReport";

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/reports/balance-sheet",
}));

vi.mock("@/lib/data", () => ({
  getBalanceSheetReport: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeReport(overrides: Partial<BalanceSheetReport> = {}): BalanceSheetReport {
  return {
    workspaceId: "ws1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    asOfDate: "2026-07-23",
    sections: [],
    totalAssetsMinor: 0,
    totalLiabilitiesMinor: 0,
    totalEquityMinor: 0,
    currentPeriodEarningsMinor: 0,
    isBalanced: true,
    ...overrides,
  };
}

function equitySectionWithEarnings(earningsMinor: number, plainEquityMinor = 0): BalanceSheetSection {
  return {
    kind: "equity",
    label: "Equity",
    totalMinor: earningsMinor + plainEquityMinor,
    rows: [
      {
        accountId: "eq1",
        accountNumber: 3000,
        accountName: "Owner's Equity",
        accountType: "equity",
        parentAccountId: null,
        closingBalanceMinor: plainEquityMinor,
      },
      {
        accountId: "current-period-earnings",
        accountNumber: 0,
        accountName: "Current Period Earnings (Unclosed)",
        accountType: "equity",
        parentAccountId: null,
        closingBalanceMinor: earningsMinor,
      },
    ],
  };
}

describe("BalanceSheetReportView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults the as-of date to today", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(makeReport());
    render(<BalanceSheetReportView />);

    await waitFor(() => expect(dataLayer.getBalanceSheetReport).toHaveBeenCalledTimes(1));
    const [args] = vi.mocked(dataLayer.getBalanceSheetReport).mock.calls[0];
    expect(args.asOfDate).toBe((screen.getByLabelText("As-of date") as HTMLInputElement).value);
  });

  it("passes the exact as-of date on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(makeReport());
    render(<BalanceSheetReportView />);
    await waitFor(() => expect(dataLayer.getBalanceSheetReport).toHaveBeenCalledTimes(1));

    await user.clear(screen.getByLabelText("As-of date"));
    await user.type(screen.getByLabelText("As-of date"), "2026-05-15");
    await user.click(screen.getByRole("button", { name: "Run Report" }));

    await waitFor(() => expect(dataLayer.getBalanceSheetReport).toHaveBeenCalledTimes(2));
    expect(dataLayer.getBalanceSheetReport).toHaveBeenLastCalledWith({ asOfDate: "2026-05-15" });
  });

  it("labels the synthetic row exactly 'Current Period Earnings (Unclosed)' with report-only helper text, for a profit case", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(
      makeReport({
        sections: [equitySectionWithEarnings(50000)],
        totalEquityMinor: 50000,
        currentPeriodEarningsMinor: 50000,
        totalAssetsMinor: 50000,
        isBalanced: true,
      }),
    );

    render(<BalanceSheetReportView />);

    expect((await screen.findAllByText("Current Period Earnings (Unclosed)")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not a real chart of accounts entry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/net income not yet closed to retained earnings/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0); // positive earnings shown as-is
  });

  it("displays a net loss (negative Current Period Earnings) correctly, not hidden or zeroed", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(
      makeReport({
        sections: [equitySectionWithEarnings(-30000)],
        totalEquityMinor: -30000,
        currentPeriodEarningsMinor: -30000,
        totalAssetsMinor: -30000,
        isBalanced: true,
      }),
    );

    render(<BalanceSheetReportView />);

    expect((await screen.findAllByText("Current Period Earnings (Unclosed)")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("-$300.00").length).toBeGreaterThan(0);
  });

  it("shows the balanced state subtly and computes Total Liabilities and Equity as a display-only sum", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(
      makeReport({
        sections: [equitySectionWithEarnings(0, 10000)],
        totalAssetsMinor: 10000,
        totalLiabilitiesMinor: 0,
        totalEquityMinor: 10000,
        isBalanced: true,
      }),
    );

    render(<BalanceSheetReportView />);

    expect(await screen.findByText(/^Balanced —/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Total Liabilities and Equity")).toBeInTheDocument();
    // Assets 10000 + Liabilities 0 = Total Liabilities and Equity 10000 (verbatim from returned totals, summed for display only).
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
  });

  it("shows a prominent alert-role warning when isBalanced is false", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(
      makeReport({
        sections: [equitySectionWithEarnings(0, 10000)],
        totalAssetsMinor: 9000,
        totalLiabilitiesMinor: 0,
        totalEquityMinor: 10000,
        isBalanced: false,
      }),
    );

    render(<BalanceSheetReportView />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not balanced/i);
  });

  it("shows a distinct empty state when there is no posted activity as of the date", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockResolvedValue(makeReport({ sections: [] }));
    render(<BalanceSheetReportView />);

    expect(await screen.findByText(/no posted balance sheet activity as of this date/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a user-facing error message on failure", async () => {
    vi.mocked(dataLayer.getBalanceSheetReport).mockRejectedValue(new Error("Could not load the Balance Sheet."));
    render(<BalanceSheetReportView />);

    expect(await screen.findByText("Could not load the Balance Sheet.")).toBeInTheDocument();
  });
});
