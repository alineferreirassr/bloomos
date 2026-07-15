import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "@/modules/finance/components/InvoiceForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

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

describe("InvoiceForm", () => {
  it("shows validation errors for missing required fields and does not submit", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn();
    render(<InvoiceForm submitLabel="Create Invoice" cancelHref="/finance/invoices" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    expect(await screen.findByText(/client is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a due date before the issue date", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn();
    render(<InvoiceForm submitLabel="Create Invoice" cancelHref="/finance/invoices" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    await user.type(screen.getByLabelText(/issue date/i), "2026-06-10");
    await user.type(screen.getByLabelText(/due date/i), "2026-06-01");
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    expect(await screen.findByText(/due date cannot be before the issue date/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered values on success", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: {} });
    render(<InvoiceForm submitLabel="Create Invoice" cancelHref="/finance/invoices" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: "client_1", title: "Deposit Invoice", subtotal: "1000" }),
      ),
    );
  });

  it("surfaces a server-side error returned by onSubmit", async () => {
    const user = userEvent.setup();
    mockClients();
    const onSubmit = vi.fn().mockResolvedValue({ success: false, error: "The selected event doesn't belong to this client." });
    render(<InvoiceForm submitLabel="Create Invoice" cancelHref="/finance/invoices" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Deposit Invoice");
    await user.type(screen.getByLabelText(/^subtotal\b/i), "1000");
    await user.click(screen.getByRole("button", { name: /create invoice/i }));

    expect(await screen.findByText(/the selected event doesn't belong to this client/i)).toBeInTheDocument();
  });
});
