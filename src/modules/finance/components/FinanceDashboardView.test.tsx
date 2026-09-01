import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceDashboardView } from "@/modules/finance/components/FinanceDashboardView";
import { makeInvoice, makePayment, makeExpense, makeAccountingPeriod, makeJournalEntry } from "@/modules/finance/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "finance.create", "finance.update", "finance.refund", "finance.amounts.view", "finance.accounting.view", "finance.reports.view", "finance.executive.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderDashboard() {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <FinanceDashboardView />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance",
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  // Bloom AI's PaymentForecastCard (Checkpoint 20, Step 12) reads this directly.
  getInvoices: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/finance/financeActions", () => ({
  getFinanceDashboardDataAction: vi.fn(),
  getFinanceLedgerSummaryAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";
import * as financeActions from "@/modules/finance/financeActions";

function mockLedgerSuccess() {
  vi.mocked(financeActions.getFinanceLedgerSummaryAction).mockResolvedValue({
    success: true,
    data: { activeAccountCount: 0, openPeriod: null, periodCounts: { open: 0, closed: 0, locked: 0 }, latestEntries: [] },
  });
}

const emptyMetrics = {
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
};

describe("FinanceDashboardView", () => {
  it("renders every dashboard metric card with the value from getFinanceDashboardDataAction", async () => {
    mockLedgerSuccess();
    vi.mocked(dataLayer.getClients).mockResolvedValue([
      makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
    ]);
    vi.mocked(financeActions.getFinanceDashboardDataAction).mockResolvedValue({
      success: true,
      data: {
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
          { ...makeInvoice({ id: "invoice_1", invoice_number: "INV-2026-0001", client_id: "client_1", total_minor: 100000 }) },
        ],
        recentPayments: [
          { ...makePayment({ id: "payment_1", client_id: "client_1", amount_minor: 50000 }) },
        ],
        overdueInvoices: [
          {
            ...makeInvoice({
              id: "invoice_2",
              invoice_number: "INV-2026-0002",
              client_id: "client_1",
              status: "overdue",
              balance_minor: 20000,
              due_date: "2026-01-01",
            }),
          },
        ],
        unpaidExpenses: [{ ...makeExpense({ id: "expense_1", description: "Florist balance", amount_minor: 15000 }) }],
        alerts: [{ message: "1 invoice overdue", severity: "danger", href: "/finance/invoices" }],
        eventsWithOutstandingBalance: [
          { event: makeEvent({ id: "event_1", title: "Malibu Sunset Proposal" }), outstandingMinor: 20000, status: "balance_due" },
        ],
      },
    });
    vi.mocked(financeActions.getFinanceLedgerSummaryAction).mockResolvedValue({
      success: true,
      data: {
        activeAccountCount: 1,
        openPeriod: makeAccountingPeriod({ id: "period_1", status: "open", period_start: "2026-06-01", period_end: "2026-08-31" }),
        periodCounts: { open: 1, closed: 0, locked: 0 },
        latestEntries: [makeJournalEntry({ id: "entry_1", memo: "Manual Adjustment: correction" })],
      },
    });

    renderDashboard();

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

    expect(await screen.findByText("Manual Adjustment: correction")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // Active Accounts
  });

  it("shows an error state when loading fails", async () => {
    mockLedgerSuccess();
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(financeActions.getFinanceDashboardDataAction).mockRejectedValue(new Error("boom"));

    renderDashboard();

    expect(await screen.findByText(/could not load the finance dashboard/i)).toBeInTheDocument();
  });

  it("shows a Ledger error state independently when the Ledger summary fails to load", async () => {
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(financeActions.getFinanceDashboardDataAction).mockResolvedValue({
      success: true,
      data: { metrics: emptyMetrics, recentInvoices: [], recentPayments: [], overdueInvoices: [], unpaidExpenses: [], alerts: [], eventsWithOutstandingBalance: [] },
    });
    vi.mocked(financeActions.getFinanceLedgerSummaryAction).mockRejectedValue(new Error("boom"));

    renderDashboard();

    expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
    expect(await screen.findByText(/could not load the general ledger summary/i)).toBeInTheDocument();
  });

  it("shows empty-state copy for every section when nothing exists yet", async () => {
    mockLedgerSuccess();
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(financeActions.getFinanceDashboardDataAction).mockResolvedValue({
      success: true,
      data: { metrics: emptyMetrics, recentInvoices: [], recentPayments: [], overdueInvoices: [], unpaidExpenses: [], alerts: [], eventsWithOutstandingBalance: [] },
    });

    renderDashboard();

    expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no overdue invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/no unpaid expenses/i)).toBeInTheDocument();
    expect(screen.getByText(/no events currently have an outstanding balance/i)).toBeInTheDocument();
    expect(await screen.findByText(/no journal entries yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no open period/i)).toBeInTheDocument();
  });

  it("Phase 06B — hides the General Ledger section entirely (not an error) when the caller lacks finance.accounting.view", async () => {
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(financeActions.getFinanceDashboardDataAction).mockResolvedValue({
      success: true,
      data: { metrics: emptyMetrics, recentInvoices: [], recentPayments: [], overdueInvoices: [], unpaidExpenses: [], alerts: [], eventsWithOutstandingBalance: [] },
    });
    vi.mocked(financeActions.getFinanceLedgerSummaryAction).mockResolvedValue({
      success: false,
      error: "You don't have permission to view the accounting ledger.",
    });

    renderDashboard();

    expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/general ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not load the general ledger summary/i)).not.toBeInTheDocument();
  });

  it("Phase 06B — redacted metrics render as '—' instead of $0.00", async () => {
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    mockLedgerSuccess();
    vi.mocked(financeActions.getFinanceDashboardDataAction).mockResolvedValue({
      success: true,
      data: {
        metrics: { ...emptyMetrics, grossProfitMinor: null, netProfitMinor: null },
        recentInvoices: [],
        recentPayments: [],
        overdueInvoices: [],
        unpaidExpenses: [],
        alerts: [],
        eventsWithOutstandingBalance: [],
      },
    });

    renderDashboard();

    await screen.findByText(/no invoices yet/i);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});
