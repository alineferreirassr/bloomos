import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceDashboardView } from "@/modules/finance/components/FinanceDashboardView";
import { makeInvoice, makePayment, makeExpense } from "@/modules/finance/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";

vi.mock("@/lib/data", () => ({
  getFinanceDashboardData: vi.fn(),
  getClients: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("FinanceDashboardView", () => {
  it("renders every dashboard metric card with the value from getFinanceDashboardData", async () => {
    vi.mocked(dataLayer.getClients).mockResolvedValue([
      makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
    ]);
    vi.mocked(dataLayer.getFinanceDashboardData).mockResolvedValue({
      metrics: {
        totalInvoicedMinor: 1000000,
        totalCollectedMinor: 750000,
        outstandingReceivablesMinor: 250000,
        overdueReceivablesMinor: 50000,
        depositsPendingMinor: 30000,
        expensesThisMonthMinor: 40000,
        grossProfitMinor: 500000,
        netProfitMinor: 300000,
        refundsThisMonthMinor: 10000,
        unpaidExpensesCount: 3,
        eventsAwaitingDepositCount: 2,
        eventsPaidInFullCount: 5,
      },
      recentInvoices: [
        makeInvoice({ id: "invoice_1", invoice_number: "INV-2026-0001", client_id: "client_1", total_minor: 100000 }),
      ],
      recentPayments: [
        makePayment({ id: "payment_1", client_id: "client_1", amount_minor: 50000 }),
      ],
      overdueInvoices: [
        makeInvoice({
          id: "invoice_2",
          invoice_number: "INV-2026-0002",
          client_id: "client_1",
          status: "overdue",
          balance_minor: 20000,
          due_date: "2026-01-01",
        }),
      ],
      unpaidExpenses: [makeExpense({ id: "expense_1", description: "Florist balance", amount_minor: 15000 })],
      alerts: [{ message: "1 invoice overdue", severity: "danger", href: "/finance/invoices" }],
      eventsWithOutstandingBalance: [
        { event: makeEvent({ id: "event_1", title: "Malibu Sunset Proposal" }), outstandingMinor: 20000, status: "balance_due" },
      ],
    });

    render(<FinanceDashboardView />);

    expect(await screen.findByText("$10,000.00")).toBeInTheDocument(); // Total Invoiced
    expect(screen.getByText("$7,500.00")).toBeInTheDocument(); // Total Collected
    expect(screen.getByText("$2,500.00")).toBeInTheDocument(); // Outstanding Receivables
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0); // Overdue Receivables
    expect(screen.getByText("$300.00")).toBeInTheDocument(); // Deposits Pending
    expect(screen.getByText("$400.00")).toBeInTheDocument(); // Expenses This Month
    expect(screen.getByText("$5,000.00")).toBeInTheDocument(); // Gross Profit
    expect(screen.getByText("$3,000.00")).toBeInTheDocument(); // Net Profit
    expect(screen.getByText("$100.00")).toBeInTheDocument(); // Refunds This Month
    expect(screen.getByText("3")).toBeInTheDocument(); // Unpaid Expenses
    expect(screen.getByText("2")).toBeInTheDocument(); // Events Awaiting Deposit
    expect(screen.getByText("5")).toBeInTheDocument(); // Events Paid in Full

    expect(screen.getByText("1 invoice overdue")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Florist balance")).toBeInTheDocument();
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getAllByText("Jordan Ellis").length).toBeGreaterThan(0);
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(dataLayer.getFinanceDashboardData).mockRejectedValue(new Error("boom"));

    render(<FinanceDashboardView />);

    expect(await screen.findByText(/could not load the finance dashboard/i)).toBeInTheDocument();
  });

  it("shows empty-state copy for every section when nothing exists yet", async () => {
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(dataLayer.getFinanceDashboardData).mockResolvedValue({
      metrics: {
        totalInvoicedMinor: 0,
        totalCollectedMinor: 0,
        outstandingReceivablesMinor: 0,
        overdueReceivablesMinor: 0,
        depositsPendingMinor: 0,
        expensesThisMonthMinor: 0,
        grossProfitMinor: 0,
        netProfitMinor: 0,
        refundsThisMonthMinor: 0,
        unpaidExpensesCount: 0,
        eventsAwaitingDepositCount: 0,
        eventsPaidInFullCount: 0,
      },
      recentInvoices: [],
      recentPayments: [],
      overdueInvoices: [],
      unpaidExpenses: [],
      alerts: [],
      eventsWithOutstandingBalance: [],
    });

    render(<FinanceDashboardView />);

    expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no overdue invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/no unpaid expenses/i)).toBeInTheDocument();
    expect(screen.getByText(/no events currently have an outstanding balance/i)).toBeInTheDocument();
  });
});
