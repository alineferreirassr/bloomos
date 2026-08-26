import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewInvoiceView } from "@/modules/finance/components/NewInvoiceView";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  createInvoice: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeInvoice(overrides: Partial<{ id: string }> = {}) {
  return {
    id: "invoice_new",
    workspace_id: "ws_1",
    client_id: "client_1",
    event_id: null,
    contract_id: null,
    invoice_number: "INV-2026-0001",
    title: "Deposit Invoice",
    description: null,
    status: "draft",
    issue_date: null,
    due_date: null,
    subtotal_minor: 100000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 100000,
    paid_minor: 0,
    balance_minor: 100000,
    currency: "USD",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as never;
}

function mockClients() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    { id: "client_1", first_name: "Jordan", last_name: "Ellis" } as never,
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
}

async function waitForClientOptions() {
  const select = await screen.findByLabelText(/^client\b/i);
  await waitFor(() => {
    expect(within(select).getAllByRole("option").length).toBeGreaterThan(1);
  });
  return select;
}

describe("NewInvoiceView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createInvoice with a generated invoiceId and navigates to the new invoice", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createInvoice).mockResolvedValue({ success: true, data: makeInvoice() });

    render(<NewInvoiceView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    await waitFor(() =>
      expect(dataLayer.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ title: "Deposit Invoice" }), expect.any(String)),
    );
    const invoiceId = vi.mocked(dataLayer.createInvoice).mock.calls[0][1];
    expect(invoiceId.length).toBeGreaterThan(0);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/invoices/invoice_new"));
  });

  it("surfaces a translated error from the Repository without navigating", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createInvoice).mockResolvedValue({
      success: false,
      error: "The selected event doesn't belong to this client.",
    });

    render(<NewInvoiceView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    expect(await screen.findByText(/doesn't belong to this client/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("reuses the SAME invoiceId across a thrown-then-retried submit with an unchanged payload", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createInvoice)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeInvoice() });

    render(<NewInvoiceView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    const submitButton = screen.getByRole("button", { name: /create invoice/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.createInvoice).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.createInvoice).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.createInvoice).mock.calls[1][1];
    expect(secondId).toBe(firstId);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/invoices/invoice_new"));
  });

  it("generates a NEW invoiceId when the Founder edits the payload after a failed attempt", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createInvoice)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeInvoice() });

    render(<NewInvoiceView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    const titleInput = screen.getByLabelText(/^title\b/i);
    await user.type(titleInput, "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    const submitButton = screen.getByRole("button", { name: /create invoice/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();

    await user.clear(titleInput);
    await user.type(titleInput, "Retitled Invoice");
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.createInvoice).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.createInvoice).mock.calls[0][1];
    const secondCall = vi.mocked(dataLayer.createInvoice).mock.calls[1];
    expect(secondCall[1]).not.toBe(firstId);
    expect(secondCall[0]).toEqual(expect.objectContaining({ title: "Retitled Invoice" }));
  });

  it("does not allow a duplicate submit while a request is pending", async () => {
    const user = userEvent.setup();
    mockClients();
    let resolveCreate: (value: { success: true; data: ReturnType<typeof makeInvoice> }) => void;
    vi.mocked(dataLayer.createInvoice).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    render(<NewInvoiceView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    const submitButton = screen.getByRole("button", { name: /create invoice/i });
    await user.click(submitButton);
    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);

    expect(dataLayer.createInvoice).toHaveBeenCalledTimes(1);
    resolveCreate!({ success: true, data: makeInvoice() });
  });
});
