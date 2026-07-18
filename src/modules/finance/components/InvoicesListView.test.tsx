import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesListView } from "@/modules/finance/components/InvoicesListView";
import { makeInvoice } from "@/modules/finance/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
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

function renderInvoicesListView() {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <InvoicesListView />
    </MemberSessionProvider>,
  );
}

vi.mock("@/lib/data", () => ({
  getInvoices: vi.fn(),
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  getInvoiceNextAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
  vi.mocked(dataLayer.getInvoiceNextAction).mockResolvedValue(null);
}

describe("InvoicesListView", () => {
  it("renders invoices sorted by updated date, newest first, by default", async () => {
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([
      makeInvoice({ id: "i_old", title: "Older Invoice", client_id: "client_1", updated_at: "2026-01-01T00:00:00.000Z" }),
      makeInvoice({ id: "i_new", title: "Newer Invoice", client_id: "client_1", updated_at: "2026-06-01T00:00:00.000Z" }),
    ]);

    renderInvoicesListView();

    const titles = await screen.findAllByText(/^(Newer|Older) Invoice$/);
    expect(titles[0]).toHaveTextContent("Newer Invoice");
  });

  it("re-fetches with the entered search text", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);

    renderInvoicesListView();
    await waitFor(() => expect(dataLayer.getInvoices).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/search invoices/i), "malibu");

    await waitFor(() =>
      expect(dataLayer.getInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ search: "malibu" })),
    );
  });

  it("re-fetches with the selected status filter", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);

    renderInvoicesListView();
    await waitFor(() => expect(dataLayer.getInvoices).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "overdue");

    await waitFor(() =>
      expect(dataLayer.getInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ status: "overdue" })),
    );
  });

  it("re-fetches with overdueOnly when the checkbox is checked", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);

    renderInvoicesListView();
    await waitFor(() => expect(dataLayer.getInvoices).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /overdue only/i }));

    await waitFor(() =>
      expect(dataLayer.getInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ overdueOnly: true })),
    );
  });

  it("re-sorts by balance when selected", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([
      makeInvoice({ id: "i_small", title: "Small Balance", client_id: "client_1", balance_minor: 1000 }),
      makeInvoice({ id: "i_big", title: "Big Balance", client_id: "client_1", balance_minor: 90000 }),
    ]);

    renderInvoicesListView();
    await screen.findAllByText("Small Balance");

    await user.selectOptions(screen.getByLabelText(/sort by/i), "balance:desc");

    await waitFor(() =>
      expect(dataLayer.getInvoices).toHaveBeenCalled(),
    );
    const titles = await screen.findAllByText(/^(Small|Big) Balance$/);
    expect(titles[0]).toHaveTextContent("Big Balance");
  });

  it("shows an empty state when no invoices match", async () => {
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);

    renderInvoicesListView();

    expect(await screen.findByText(/no invoices yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    mockCommon();
    vi.mocked(dataLayer.getInvoices).mockRejectedValue(new Error("boom"));

    renderInvoicesListView();

    expect(await screen.findByText(/could not load invoices/i)).toBeInTheDocument();
  });
});
