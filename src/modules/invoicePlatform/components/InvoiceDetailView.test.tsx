import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { InvoiceDetailView } from "@/modules/invoicePlatform/components/InvoiceDetailView";
import type { InvoiceDetail } from "@/types/invoicePlatform";
import type { Invoice } from "@/types/invoice";

vi.mock("@/modules/invoicePlatform/invoicePlatformActions", () => ({
  evaluateInvoiceAction: vi.fn(),
  listInvoiceTemplatesAction: vi.fn(),
  createInvoiceVersionAction: vi.fn(),
  publishInvoiceVersionAction: vi.fn(),
  archiveInvoiceDocumentAction: vi.fn(),
  restoreInvoiceVersionAction: vi.fn(),
  compareInvoiceVersionsAction: vi.fn(),
  markInvoiceReadyAction: vi.fn(),
}));

vi.mock("@/modules/communication/comments/components/CommentsPanel", () => ({
  CommentsPanel: () => <div data-testid="comments-panel" />,
}));

import { evaluateInvoiceAction, listInvoiceTemplatesAction } from "@/modules/invoicePlatform/invoicePlatformActions";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "invoice_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    event_id: "event_1",
    contract_id: null,
    invoice_number: "INV-0001",
    title: "Luxury Picnic Invoice",
    description: null,
    status: "draft",
    issue_date: now,
    due_date: null,
    subtotal_minor: 65000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 65000,
    paid_minor: 0,
    balance_minor: 65000,
    currency: "USD",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    invoice: makeInvoice(),
    builderState: null,
    currentVersion: null,
    health: { categories: [], overallScore: 0, evaluatedAt: "2026-01-01T00:00:00.000Z" },
    readiness: { state: "missing_pricing", reasons: ["No invoice document has been built yet."], canPublish: false },
    ...overrides,
  };
}

describe("InvoiceDetailView", () => {
  it("renders the invoice's readiness state once loaded", async () => {
    vi.mocked(evaluateInvoiceAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(listInvoiceTemplatesAction).mockResolvedValue({ success: true, data: [] });
    render(<InvoiceDetailView invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByText("Missing Pricing")).toBeInTheDocument());
  });

  it("shows an accessible empty state when the invoice can't be found", async () => {
    vi.mocked(evaluateInvoiceAction).mockResolvedValue({ success: false, error: "This invoice could not be found." });
    vi.mocked(listInvoiceTemplatesAction).mockResolvedValue({ success: true, data: [] });
    render(<InvoiceDetailView invoiceId="nonexistent" />);
    await waitFor(() => expect(screen.getByText("This invoice isn't available")).toBeInTheDocument());
  });

  it("disables the Mark Ready button when the invoice isn't ready", async () => {
    vi.mocked(evaluateInvoiceAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(listInvoiceTemplatesAction).mockResolvedValue({ success: true, data: [] });
    render(<InvoiceDetailView invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Mark Ready" })).toBeDisabled());
  });

  it("renders the comments panel", async () => {
    vi.mocked(evaluateInvoiceAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(listInvoiceTemplatesAction).mockResolvedValue({ success: true, data: [] });
    render(<InvoiceDetailView invoiceId="invoice_1" />);
    await waitFor(() => expect(screen.getByTestId("comments-panel")).toBeInTheDocument());
  });
});
