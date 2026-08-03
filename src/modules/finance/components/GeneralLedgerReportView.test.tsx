import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralLedgerReportView } from "@/modules/finance/components/GeneralLedgerReportView";
import { makeChartOfAccount } from "@/modules/finance/testUtils";
import type { GeneralLedgerReport } from "@/types/financeReport";

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/reports/general-ledger",
}));

vi.mock("@/lib/data", () => ({
  getGeneralLedgerReport: vi.fn(),
  getChartOfAccounts: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeReport(overrides: Partial<GeneralLedgerReport> = {}): GeneralLedgerReport {
  return {
    workspaceId: "ws1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    startDate: "2026-07-01",
    endDate: "2026-07-23",
    accounts: [],
    ...overrides,
  };
}

describe("GeneralLedgerReportView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the current month and loads the account dropdown from getChartOfAccounts", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([makeChartOfAccount({ id: "a1", name: "Cash" })]);
    vi.mocked(dataLayer.getGeneralLedgerReport).mockResolvedValue(makeReport());

    render(<GeneralLedgerReportView />);

    await waitFor(() => expect(dataLayer.getChartOfAccounts).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("option", { name: /Cash/ })).toBeInTheDocument();
    await waitFor(() => expect(dataLayer.getGeneralLedgerReport).toHaveBeenCalledTimes(1));

    const [args] = vi.mocked(dataLayer.getGeneralLedgerReport).mock.calls[0];
    expect(args.startDate.slice(8, 10)).toBe("01"); // first of the current month
    expect(args.accountId).toBeUndefined();
    expect(args.accountType).toBeUndefined();
    expect(args.sourceType).toBeUndefined();
  });

  it("passes exact filter arguments to the Repository on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([makeChartOfAccount({ id: "a1", name: "Cash" })]);
    vi.mocked(dataLayer.getGeneralLedgerReport).mockResolvedValue(makeReport());

    render(<GeneralLedgerReportView />);
    await waitFor(() => expect(dataLayer.getGeneralLedgerReport).toHaveBeenCalledTimes(1));

    await user.clear(screen.getByLabelText("Start date"));
    await user.type(screen.getByLabelText("Start date"), "2026-01-01");
    await user.clear(screen.getByLabelText("End date"));
    await user.type(screen.getByLabelText("End date"), "2026-01-31");
    await user.type(screen.getByLabelText("Filter by source type"), "payment_settlement");
    await user.click(screen.getByRole("button", { name: "Run Report" }));

    await waitFor(() => expect(dataLayer.getGeneralLedgerReport).toHaveBeenCalledTimes(2));
    expect(dataLayer.getGeneralLedgerReport).toHaveBeenLastCalledWith({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      accountId: undefined,
      accountType: undefined,
      sourceType: "payment_settlement",
    });
  });

  it("rejects an inverted date range client-side without calling the Repository", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);
    vi.mocked(dataLayer.getGeneralLedgerReport).mockResolvedValue(makeReport());

    render(<GeneralLedgerReportView />);
    await waitFor(() => expect(dataLayer.getGeneralLedgerReport).toHaveBeenCalledTimes(1));

    await user.clear(screen.getByLabelText("Start date"));
    await user.type(screen.getByLabelText("Start date"), "2026-07-31");
    await user.clear(screen.getByLabelText("End date"));
    await user.type(screen.getByLabelText("End date"), "2026-07-01");
    await user.click(screen.getByRole("button", { name: "Run Report" }));

    expect(await screen.findByText(/end date must not be before start date/i)).toBeInTheDocument();
    expect(dataLayer.getGeneralLedgerReport).toHaveBeenCalledTimes(1); // only the initial default-filter load
  });

  it("shows a report-specific empty state when no account has activity or an opening balance", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);
    vi.mocked(dataLayer.getGeneralLedgerReport).mockResolvedValue(makeReport());

    render(<GeneralLedgerReportView />);

    expect(await screen.findByText(/no ledger activity for this range/i)).toBeInTheDocument();
  });

  it("shows a user-facing error and retries with the same filters preserved", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);
    vi.mocked(dataLayer.getGeneralLedgerReport)
      .mockRejectedValueOnce(new Error("Could not load the General Ledger."))
      .mockResolvedValueOnce(makeReport());

    render(<GeneralLedgerReportView />);

    expect(await screen.findByText("Could not load the General Ledger.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(dataLayer.getGeneralLedgerReport).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/no ledger activity for this range/i)).toBeInTheDocument();
  });

  it("renders an account's opening balance, transactions, and closing balance verbatim without recalculating", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);
    vi.mocked(dataLayer.getGeneralLedgerReport).mockResolvedValue(
      makeReport({
        accounts: [
          {
            accountId: "a1",
            accountNumber: 1000,
            accountName: "Cash",
            accountType: "asset",
            normalBalance: "debit",
            openingBalanceMinor: 5000,
            closingBalanceMinor: 12000,
            transactions: [
              {
                journalEntryId: "je-11112222",
                entryDate: "2026-07-05",
                memo: "Deposit",
                sourceType: "payment_settlement",
                sourceId: "pay-99998888",
                postingStatus: "posted",
                journalLineId: "jl1",
                lineMemo: null,
                debitMinor: 7000,
                creditMinor: 0,
                runningBalanceMinor: 12000,
              },
            ],
          },
        ],
      }),
    );

    render(<GeneralLedgerReportView />);

    expect(await screen.findByText(/1000 — Cash/)).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument(); // opening balance, shown verbatim, once
    expect(screen.getAllByText("$120.00").length).toBeGreaterThan(0); // closing balance == returned running balance
    expect(screen.getAllByText("$70.00").length).toBeGreaterThan(0); // debit, shown verbatim (desktop + mobile)
    expect(screen.getAllByText("Deposit").length).toBeGreaterThan(0); // memo (desktop + mobile)
    expect(screen.getByText("payment_settlement")).toBeInTheDocument(); // source type, isolated own-text match
    expect(screen.getByText("pay-9999")).toBeInTheDocument(); // truncated sourceId, distinct from journalEntryId
    expect(screen.getAllByText("je-11112").length).toBeGreaterThan(0); // truncated journalEntryId reference (desktop + mobile)
  });
});
