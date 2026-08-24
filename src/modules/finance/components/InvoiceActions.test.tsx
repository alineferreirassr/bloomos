import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceActions } from "@/modules/finance/components/InvoiceActions";
import { makeInvoice } from "@/modules/finance/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "finance.create", "finance.update", "finance.refund"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderInvoiceActions(props: Parameters<typeof InvoiceActions>[0], permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <InvoiceActions {...props} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  archiveInvoice: vi.fn(),
  duplicateInvoice: vi.fn(),
  issueInvoice: vi.fn(),
  markInvoiceOverdue: vi.fn(),
  markInvoiceViewed: vi.fn(),
  restoreInvoice: vi.fn(),
  sendInvoice: vi.fn(),
  voidInvoice: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("InvoiceActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Issue, Void, Archive, and Duplicate for a draft invoice", () => {
    renderInvoiceActions({ invoice: makeInvoice({ status: "draft" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /^issue$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^void$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });

  it("shows Send and Record Payment for an issued invoice", () => {
    renderInvoiceActions({
      invoice: makeInvoice({ status: "issued", due_date: "2026-01-01", client_id: "client_1" }),
      onChanged: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /^send$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /record payment/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/finance/payments/new?invoiceId="),
    );
  });

  it("shows Mark Viewed and Mark Overdue for a sent invoice with a due date", () => {
    renderInvoiceActions({ invoice: makeInvoice({ status: "sent", due_date: "2026-01-01" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /mark viewed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark overdue/i })).toBeInTheDocument();
  });

  it("hides Record Payment for a paid invoice", () => {
    renderInvoiceActions({ invoice: makeInvoice({ status: "paid" }), onChanged: vi.fn() });
    expect(screen.queryByRole("link", { name: /record payment/i })).not.toBeInTheDocument();
  });

  it("shows only Restore and Duplicate for an archived invoice", () => {
    renderInvoiceActions({ invoice: makeInvoice({ status: "archived" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("issues directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.issueInvoice).mockResolvedValue({ success: true, data: makeInvoice({ status: "issued" }) });
    const onChanged = vi.fn();
    renderInvoiceActions({ invoice: makeInvoice({ id: "invoice_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^issue$/i }));

    await waitFor(() => expect(dataLayer.issueInvoice).toHaveBeenCalledWith("invoice_1"));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("voids through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.voidInvoice).mockResolvedValue({ success: true, data: makeInvoice({ status: "voided" }) });
    const onChanged = vi.fn();
    renderInvoiceActions({ invoice: makeInvoice({ id: "invoice_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^void$/i }));
    const dialog = screen.getByRole("dialog", { name: /void invoice/i });
    await user.click(within(dialog).getByRole("button", { name: /^void$/i }));

    await waitFor(() => expect(dataLayer.voidInvoice).toHaveBeenCalledWith("invoice_1", expect.any(String), expect.any(String)));
    expect(onChanged).toHaveBeenCalled();
  });

  it("archives through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveInvoice).mockResolvedValue({
      success: true,
      data: makeInvoice({ status: "archived" }),
    });
    const onChanged = vi.fn();
    renderInvoiceActions({ invoice: makeInvoice({ id: "invoice_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive invoice/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveInvoice).toHaveBeenCalledWith("invoice_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("duplicates directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.duplicateInvoice).mockResolvedValue({
      success: true,
      data: makeInvoice({ id: "invoice_2" }),
    });
    renderInvoiceActions({ invoice: makeInvoice({ id: "invoice_1", status: "draft" }), onChanged: vi.fn() });

    await user.click(screen.getByRole("button", { name: /^duplicate$/i }));

    await waitFor(() => expect(dataLayer.duplicateInvoice).toHaveBeenCalledWith("invoice_1"));
  });

  it("surfaces an error and does not call onChanged when a quick action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveInvoice).mockResolvedValue({ success: false, error: "This invoice is voided." });
    const onChanged = vi.fn();
    renderInvoiceActions({ invoice: makeInvoice({ id: "invoice_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive invoice/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/this invoice is voided/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
