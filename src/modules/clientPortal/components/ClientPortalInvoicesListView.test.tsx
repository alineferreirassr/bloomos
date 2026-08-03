import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalInvoices: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalInvoicesListView } from "@/modules/clientPortal/components/ClientPortalInvoicesListView";
import { getClientPortalInvoices } from "@/lib/data";

const INVOICE = {
  id: "invoice_1",
  client_id: "client_1",
  event_id: null,
  contract_id: null,
  invoice_number: "INV-1001",
  title: "Deposit Invoice",
  description: null,
  status: "sent",
  issue_date: "2026-01-01",
  due_date: "2026-02-01",
  subtotal_minor: 300000,
  tax_minor: 0,
  discount_minor: 0,
  total_minor: 300000,
  paid_minor: 0,
  balance_minor: 300000,
  currency: "USD",
  sent_at: null,
  viewed_at: null,
  paid_at: null,
  overdue_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ClientPortalInvoicesListView", () => {
  it("renders each invoice's client-safe fields", async () => {
    vi.mocked(getClientPortalInvoices).mockResolvedValue([INVOICE] as never);
    render(<ClientPortalInvoicesListView />);
    await waitFor(() => expect(screen.getByText("Deposit Invoice")).toBeInTheDocument());
    // Appears twice — once in the new Upcoming Payments section (Step 5), once in the full list below it.
    expect(screen.getAllByText(/INV-1001/).length).toBeGreaterThan(0);
  });

  it("Step 5: lists an outstanding, due invoice under its own Upcoming Payments section", async () => {
    vi.mocked(getClientPortalInvoices).mockResolvedValue([INVOICE] as never);
    render(<ClientPortalInvoicesListView />);
    await waitFor(() => expect(screen.getByText("Upcoming Payments")).toBeInTheDocument());
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
  });

  it("Step 5: omits the Upcoming Payments section entirely when nothing is outstanding", async () => {
    vi.mocked(getClientPortalInvoices).mockResolvedValue([{ ...INVOICE, balance_minor: 0 }] as never);
    render(<ClientPortalInvoicesListView />);
    await waitFor(() => expect(screen.getByText("Deposit Invoice")).toBeInTheDocument());
    expect(screen.queryByText("Upcoming Payments")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no invoices", async () => {
    vi.mocked(getClientPortalInvoices).mockResolvedValue([] as never);
    render(<ClientPortalInvoicesListView />);
    await waitFor(() => expect(screen.getByText("No invoices yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalInvoices).mockRejectedValue(new Error("boom"));
    render(<ClientPortalInvoicesListView />);
    await waitFor(() => expect(screen.getByText("Could not load your invoices.")).toBeInTheDocument());
  });
});
