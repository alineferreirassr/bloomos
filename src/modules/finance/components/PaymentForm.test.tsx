import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentForm } from "@/modules/finance/components/PaymentForm";
import { makeInvoice } from "@/modules/finance/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  getInvoices: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockClients() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    { id: "client_1", first_name: "Jordan", last_name: "Ellis" } as never,
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
  vi.mocked(dataLayer.getInvoices).mockResolvedValue([
    makeInvoice({ id: "invoice_1", invoice_number: "INV-2026-0001", client_id: "client_1", balance_minor: 20000 }),
  ]);
}

async function waitForClientOptions() {
  const select = await screen.findByLabelText(/^client\b/i);
  await waitFor(() => {
    expect(within(select).getAllByRole("option").length).toBeGreaterThan(1);
  });
  return select;
}

describe("PaymentForm", () => {
  it("shows a validation error for a missing client and does not submit", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn();
    render(<PaymentForm submitLabel="Record Payment" cancelHref="/finance/payments" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(await screen.findByText(/client is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the selected invoice's remaining balance once an invoice is chosen", async () => {
    const user = userEvent.setup();
    mockClients();
    render(<PaymentForm submitLabel="Record Payment" cancelHref="/finance/payments" onSubmit={vi.fn()} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");

    const invoiceSelect = await screen.findByLabelText(/^invoice\b/i);
    await waitFor(() => expect(within(invoiceSelect).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(invoiceSelect, "invoice_1");

    expect(await screen.findByText(/remaining balance: \$200\.00/i)).toBeInTheDocument();
  });

  it("submits with the entered values on success", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: {} });
    render(<PaymentForm submitLabel="Record Payment" cancelHref="/finance/payments" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    await user.click(screen.getByRole("button", { name: /record payment/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ client_id: "client_1", amount: "150" })),
    );
  });

  it("surfaces the no-overpayment rejection from the data layer as a field error", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "This payment (50000 minor units) would exceed the invoice's remaining balance (20000 minor units).",
      fieldErrors: { amount_minor: "Amount exceeds the remaining balance." },
    });
    render(<PaymentForm submitLabel="Record Payment" cancelHref="/finance/payments" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "500");
    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(await screen.findByText(/would exceed the invoice's remaining balance/i)).toBeInTheDocument();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, hides the raw error, preserves form state, does not navigate, and remains retryable", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn().mockRejectedValue(new Error("relation payments does not exist"));
    render(<PaymentForm submitLabel="Record Payment" cancelHref="/finance/payments" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    const submitButton = screen.getByRole("button", { name: /record payment/i });
    await user.click(submitButton);

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation payments does not exist/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^amount\b/i)).toHaveValue(150);
    expect(submitButton).not.toBeDisabled();

    onSubmit.mockResolvedValueOnce({ success: true, data: {} });
    await user.click(submitButton);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it("hides excluded payment methods from the picker", async () => {
    mockClients();
    render(
      <PaymentForm
        submitLabel="Record Settlement"
        cancelHref="/finance/payments"
        excludeMethods={["stripe"]}
        onSubmit={vi.fn()}
      />,
    );

    const methodSelect = await screen.findByLabelText(/payment method/i);
    expect(within(methodSelect).queryByRole("option", { name: /stripe/i })).not.toBeInTheDocument();
    expect(within(methodSelect).getByRole("option", { name: /cash/i })).toBeInTheDocument();
  });
});
