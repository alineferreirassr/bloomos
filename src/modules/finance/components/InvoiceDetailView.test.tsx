import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceDetailView } from "@/modules/finance/components/InvoiceDetailView";
import { makeInvoice } from "@/modules/finance/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "finance.create", "finance.update", "finance.refund"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderInvoiceDetail(invoiceId: string) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <InvoiceDetailView invoiceId={invoiceId} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getInvoiceById: vi.fn(),
  getClientById: vi.fn(),
  getEventById: vi.fn(),
  getContract: vi.fn(),
  getPayments: vi.fn(),
  getNotesByInvoiceId: vi.fn(),
  getTimelineByInvoiceId: vi.fn(),
  getInvoiceNextAction: vi.fn(),
  createInvoiceNote: vi.fn(),
  togglePinNote: vi.fn(),
  getDocumentOwnerSummary: vi.fn(),
  archiveInvoice: vi.fn(),
  duplicateInvoice: vi.fn(),
  issueInvoice: vi.fn(),
  markInvoiceOverdue: vi.fn(),
  markInvoiceViewed: vi.fn(),
  restoreInvoice: vi.fn(),
  sendInvoice: vi.fn(),
  voidInvoice: vi.fn(),
  recordInvoiceAdjustment: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

/**
 * Finance F2.1C-D-E-B-REVIEW: this file previously had no dedicated test
 * coverage at all. The review gate flagged this as a genuine gap for the
 * new partial-void explanatory note (isPartiallyVoided derivation) — the
 * three tests below are the smallest direct proof that the note's exact
 * condition (status === "voided" && paid_minor > 0) renders correctly and
 * nowhere else.
 */
describe("InvoiceDetailView — partial-void explanatory note", () => {
  function mockLoad(invoice: ReturnType<typeof makeInvoice>) {
    vi.mocked(dataLayer.getInvoiceById).mockResolvedValue(invoice);
    vi.mocked(dataLayer.getClientById).mockResolvedValue(null as never);
    vi.mocked(dataLayer.getPayments).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByInvoiceId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByInvoiceId).mockResolvedValue([]);
    vi.mocked(dataLayer.getInvoiceNextAction).mockResolvedValue(null);
    vi.mocked(dataLayer.getDocumentOwnerSummary).mockResolvedValue({
      total: 0,
      active: 0,
      draft: 0,
      expiringSoon: 0,
      expired: 0,
      archived: 0,
      deleted: 0,
      totalStorageBytes: 0,
      byCategory: {} as never,
      latestUploads: [],
    });
  }

  it("shows the partial-cancellation note when the invoice was voided with a settled balance retained", async () => {
    mockLoad(makeInvoice({ id: "invoice_1", status: "voided", paid_minor: 4000, balance_minor: 0, total_minor: 10000 }));
    renderInvoiceDetail("invoice_1");

    expect(await screen.findByText(/this invoice was partially cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/\$40\.00 was already/i)).toBeInTheDocument();
  });

  it("does not show the note for a clean void (nothing was ever paid)", async () => {
    mockLoad(makeInvoice({ id: "invoice_2", status: "voided", paid_minor: 0, balance_minor: 0, total_minor: 10000 }));
    renderInvoiceDetail("invoice_2");

    await screen.findByRole("heading", { name: "Test Invoice" });
    expect(screen.queryByText(/partially cancelled/i)).not.toBeInTheDocument();
  });

  it("does not show the note for an active (non-voided) invoice, even with a paid amount", async () => {
    mockLoad(makeInvoice({ id: "invoice_3", status: "partially_paid", paid_minor: 4000, balance_minor: 6000, total_minor: 10000 }));
    renderInvoiceDetail("invoice_3");

    await screen.findByRole("heading", { name: "Test Invoice" });
    expect(screen.queryByText(/partially cancelled/i)).not.toBeInTheDocument();
  });
});
