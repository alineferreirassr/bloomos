import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getClientPortalInvoiceById: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalInvoiceDetailView } from "@/modules/clientPortal/components/ClientPortalInvoiceDetailView";
import { getClientPortalInvoiceById } from "@/lib/data";

const INVOICE = {
  id: "invoice_1",
  client_id: "client_1",
  event_id: null,
  contract_id: null,
  invoice_number: "INV-1001",
  title: "Deposit Invoice",
  description: null,
  status: "partially_paid",
  issue_date: "2026-01-01",
  due_date: "2026-02-01",
  subtotal_minor: 300000,
  tax_minor: 0,
  discount_minor: 0,
  total_minor: 300000,
  paid_minor: 100000,
  balance_minor: 200000,
  currency: "USD",
  sent_at: null,
  viewed_at: null,
  paid_at: null,
  overdue_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  payments: [
    {
      id: "payment_1",
      invoice_id: "invoice_1",
      payment_type: "deposit",
      status: "completed",
      amount_minor: 100000,
      currency: "USD",
      payment_method: "credit_card",
      transaction_date: "2026-01-10T00:00:00.000Z",
      received_at: "2026-01-10T00:00:00.000Z",
      refunded_at: null,
      created_at: "2026-01-10T00:00:00.000Z",
    },
  ],
};

describe("ClientPortalInvoiceDetailView", () => {
  it("renders client-safe invoice and payment-history fields", async () => {
    vi.mocked(getClientPortalInvoiceById).mockResolvedValue(INVOICE as never);
    render(<ClientPortalInvoiceDetailView invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByText("Deposit Invoice")).toBeInTheDocument());
    expect(screen.getByText("Payment History")).toBeInTheDocument();
  });

  it("shows a not-found state for a manipulated or inaccessible id", async () => {
    vi.mocked(getClientPortalInvoiceById).mockRejectedValue(new NotFoundError("Invoice invoice_2 was not found"));
    render(<ClientPortalInvoiceDetailView invoiceId="invoice_2" />);
    await waitFor(() => expect(screen.getByText("This invoice could not be found.")).toBeInTheDocument());
  });

  it("shows an error state with retry on an unexpected failure", async () => {
    vi.mocked(getClientPortalInvoiceById).mockRejectedValue(new Error("boom"));
    render(<ClientPortalInvoiceDetailView invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByText("Could not load this invoice.")).toBeInTheDocument());
  });

  it("never renders internal expenses or refund-control actions", async () => {
    vi.mocked(getClientPortalInvoiceById).mockResolvedValue(INVOICE as never);
    render(<ClientPortalInvoiceDetailView invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByText("Deposit Invoice")).toBeInTheDocument());
    expect(screen.queryByText(/expense/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refund/i })).not.toBeInTheDocument();
  });
});
