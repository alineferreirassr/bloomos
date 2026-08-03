import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { InvoiceDashboardView } from "@/modules/invoicePlatform/components/InvoiceDashboardView";
import type { InvoiceSummary, InvoiceAnalyticsSnapshot } from "@/types/invoicePlatform";

vi.mock("@/modules/invoicePlatform/invoicePlatformActions", () => ({
  listInvoiceSummariesAction: vi.fn(),
  getInvoiceAnalyticsAction: vi.fn(),
}));

import { listInvoiceSummariesAction, getInvoiceAnalyticsAction } from "@/modules/invoicePlatform/invoicePlatformActions";

function makeSummary(overrides: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    invoiceId: "invoice_1",
    clientId: "client_1",
    eventId: "event_1",
    contractId: null,
    documentStatus: "draft",
    invoiceStatus: "draft",
    currentVersionNumber: 1,
    templateKey: "luxury_event",
    grandTotal_minor: 65000,
    currency: "USD",
    overallHealthScore: 80,
    readinessState: "needs_review",
    readyAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function makeAnalytics(overrides: Partial<InvoiceAnalyticsSnapshot> = {}): InvoiceAnalyticsSnapshot {
  return {
    totalInvoices: 1,
    draftCount: 1,
    reviewCount: 0,
    publishedCount: 0,
    archivedCount: 0,
    averageInvoice_minor: 65000,
    averageDeposit_minor: 0,
    averageBalance_minor: 65000,
    averageDiscount_minor: 0,
    averageCredit_minor: 0,
    averageInstallments: 1,
    outstandingBalance_minor: 65000,
    evaluatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("InvoiceDashboardView", () => {
  it("renders KPIs and the invoice list once loaded", async () => {
    vi.mocked(listInvoiceSummariesAction).mockResolvedValue({ success: true, data: [makeSummary()] });
    vi.mocked(getInvoiceAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics() });
    render(<InvoiceDashboardView />);
    await waitFor(() => expect(screen.getAllByText("Luxury Event").length).toBeGreaterThan(0));
    expect(screen.getByText("Drafts")).toBeInTheDocument();
  });

  it("shows an accessible empty state when the action fails", async () => {
    vi.mocked(listInvoiceSummariesAction).mockResolvedValue({ success: false, error: "The Invoice Platform isn't available." });
    vi.mocked(getInvoiceAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics() });
    render(<InvoiceDashboardView />);
    await waitFor(() => expect(screen.getByText("The Invoice Platform isn't available")).toBeInTheDocument());
  });

  it("shows a friendly empty state when no invoices match the filter", async () => {
    vi.mocked(listInvoiceSummariesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getInvoiceAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics({ totalInvoices: 0, draftCount: 0 }) });
    render(<InvoiceDashboardView />);
    await waitFor(() => expect(screen.getByText("No invoices match this filter")).toBeInTheDocument());
  });

  it("displays top template usage", async () => {
    vi.mocked(listInvoiceSummariesAction).mockResolvedValue({ success: true, data: [makeSummary()] });
    vi.mocked(getInvoiceAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics() });
    render(<InvoiceDashboardView />);
    await waitFor(() => expect(screen.getByText("Top Templates")).toBeInTheDocument());
  });

  it("shows the outstanding balance KPI", async () => {
    vi.mocked(listInvoiceSummariesAction).mockResolvedValue({ success: true, data: [makeSummary()] });
    vi.mocked(getInvoiceAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics({ outstandingBalance_minor: 12345 }) });
    render(<InvoiceDashboardView />);
    await waitFor(() => expect(screen.getByText("Outstanding Balance")).toBeInTheDocument());
    expect(screen.getByText("$123.45")).toBeInTheDocument();
  });
});
