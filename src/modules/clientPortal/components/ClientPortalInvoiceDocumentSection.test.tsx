import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/clientPortal/getClientPortalInvoiceDocument", () => ({
  getClientPortalInvoiceDocumentAction: vi.fn(),
  compareClientPortalInvoiceVersionsAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalInvoiceDocumentSection } from "@/modules/clientPortal/components/ClientPortalInvoiceDocumentSection";
import { getClientPortalInvoiceDocumentAction } from "@/modules/clientPortal/getClientPortalInvoiceDocument";

const SUMMARY = {
  currentVersionNumber: 1,
  availableVersionNumbers: [1],
  lineItems: [{ id: "li_1", label: "Photography package", kind: "service", amount_minor: 500000 }],
  paymentSchedule: [{ id: "inst_1", label: "Deposit", kind: "deposit", dueDate: null, amount_minor: 150000 }],
  adjustments: [],
  pricing: { depositDue_minor: 150000, remainingBalance_minor: 350000, grandTotal_minor: 500000, outstandingBalance_minor: 500000, currency: "USD" },
  terms: "Payment due within 30 days.",
  policies: null,
};

describe("ClientPortalInvoiceDocumentSection", () => {
  it("renders line items, payment schedule, and pricing", async () => {
    vi.mocked(getClientPortalInvoiceDocumentAction).mockResolvedValue({ success: true, data: SUMMARY } as never);
    render(<ClientPortalInvoiceDocumentSection invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByText("Invoice Document")).toBeInTheDocument());
    expect(screen.getByText(/Photography package/)).toBeInTheDocument();
    expect(screen.getByText("Payment due within 30 days.")).toBeInTheDocument();
  });

  it("renders nothing when the document isn't available to this client", async () => {
    vi.mocked(getClientPortalInvoiceDocumentAction).mockResolvedValue({ success: false, error: "not available" } as never);
    const { container } = render(<ClientPortalInvoiceDocumentSection invoiceId="invoice_1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("never renders payment or PDF-download controls (no path here can move money)", async () => {
    vi.mocked(getClientPortalInvoiceDocumentAction).mockResolvedValue({ success: true, data: SUMMARY } as never);
    render(<ClientPortalInvoiceDocumentSection invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByText("Invoice Document")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });
});
