import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrialBalanceReportView } from "@/modules/finance/components/TrialBalanceReportView";
import type { TrialBalanceReport } from "@/types/financeReport";

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/reports/trial-balance",
}));

vi.mock("@/lib/data", () => ({
  getTrialBalanceReport: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeReport(overrides: Partial<TrialBalanceReport> = {}): TrialBalanceReport {
  return {
    workspaceId: "ws1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    asOfDate: "2026-07-23",
    rows: [],
    totalEndingDebitMinor: 0,
    totalEndingCreditMinor: 0,
    isBalanced: true,
    ...overrides,
  };
}

describe("TrialBalanceReportView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults the as-of date to today and passes includeZeroBalances: false", async () => {
    vi.mocked(dataLayer.getTrialBalanceReport).mockResolvedValue(makeReport());
    render(<TrialBalanceReportView />);

    await waitFor(() => expect(dataLayer.getTrialBalanceReport).toHaveBeenCalledTimes(1));
    const [args] = vi.mocked(dataLayer.getTrialBalanceReport).mock.calls[0];
    expect(args.includeZeroBalances).toBe(false);
    expect(args.asOfDate).toBe((screen.getByLabelText("As-of date") as HTMLInputElement).value);
  });

  it("passes exact filter arguments when the include-zero toggle is checked and resubmitted", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getTrialBalanceReport).mockResolvedValue(makeReport());
    render(<TrialBalanceReportView />);
    await waitFor(() => expect(dataLayer.getTrialBalanceReport).toHaveBeenCalledTimes(1));

    await user.clear(screen.getByLabelText("As-of date"));
    await user.type(screen.getByLabelText("As-of date"), "2026-06-30");
    await user.click(screen.getByRole("checkbox", { name: /include zero balances/i }));
    await user.click(screen.getByRole("button", { name: "Run Report" }));

    await waitFor(() => expect(dataLayer.getTrialBalanceReport).toHaveBeenCalledTimes(2));
    expect(dataLayer.getTrialBalanceReport).toHaveBeenLastCalledWith({ asOfDate: "2026-06-30", includeZeroBalances: true });
  });

  it("shows the balanced state subtly when isBalanced is true", async () => {
    vi.mocked(dataLayer.getTrialBalanceReport).mockResolvedValue(
      makeReport({
        rows: [
          {
            accountId: "a1",
            accountNumber: 1000,
            accountName: "Cash",
            accountType: "asset",
            normalBalance: "debit",
            isArchived: false,
            debitMinor: 100,
            creditMinor: 0,
            endingDebitMinor: 100,
            endingCreditMinor: 0,
          },
        ],
        totalEndingDebitMinor: 100,
        totalEndingCreditMinor: 100,
        isBalanced: true,
      }),
    );

    render(<TrialBalanceReportView />);

    const alert = await screen.findByText(/^Balanced —/);
    expect(alert).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a prominent alert-role warning when isBalanced is false, without hiding the figures", async () => {
    vi.mocked(dataLayer.getTrialBalanceReport).mockResolvedValue(
      makeReport({
        rows: [
          {
            accountId: "a1",
            accountNumber: 1000,
            accountName: "Cash",
            accountType: "asset",
            normalBalance: "debit",
            isArchived: false,
            debitMinor: 100,
            creditMinor: 0,
            endingDebitMinor: 100,
            endingCreditMinor: 0,
          },
        ],
        totalEndingDebitMinor: 100,
        totalEndingCreditMinor: 90,
        isBalanced: false,
      }),
    );

    render(<TrialBalanceReportView />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not balanced/i);
    expect(screen.getByText("1000 — Cash")).toBeInTheDocument();
    expect(screen.getAllByText("$1.00").length).toBeGreaterThan(0); // ending debit still shown, not plugged to match credit
  });

  it("keeps archived accounts visible with an Inactive badge, never hidden", async () => {
    vi.mocked(dataLayer.getTrialBalanceReport).mockResolvedValue(
      makeReport({
        rows: [
          {
            accountId: "a1",
            accountNumber: 9000,
            accountName: "Old Discontinued Account",
            accountType: "asset",
            normalBalance: "debit",
            isArchived: true,
            debitMinor: 0,
            creditMinor: 0,
            endingDebitMinor: 500,
            endingCreditMinor: 0,
          },
        ],
      }),
    );

    render(<TrialBalanceReportView />);

    expect(await screen.findByText("Old Discontinued Account")).toBeInTheDocument();
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
  });

  it("shows a distinct empty state, not an error, when there are no balances", async () => {
    vi.mocked(dataLayer.getTrialBalanceReport).mockResolvedValue(makeReport({ rows: [] }));
    render(<TrialBalanceReportView />);

    expect(await screen.findByText(/no posted ledger balances as of this date/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a user-facing error message on failure, with a retry action", async () => {
    vi.mocked(dataLayer.getTrialBalanceReport).mockRejectedValue(new Error("Could not load the Trial Balance."));
    render(<TrialBalanceReportView />);

    expect(await screen.findByText("Could not load the Trial Balance.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
