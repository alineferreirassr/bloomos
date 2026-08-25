import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceAdjustmentModal } from "@/modules/finance/components/InvoiceAdjustmentModal";
import { makeInvoice } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  recordInvoiceAdjustment: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("InvoiceAdjustmentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefills subtotal/tax/discount from the Invoice's current economic fields on open", () => {
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 500, discount_minor: 200, total_minor: 10300 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/new subtotal/i)).toHaveValue(100);
    expect(screen.getByLabelText(/new tax/i)).toHaveValue(5);
    expect(screen.getByLabelText(/new discount/i)).toHaveValue(2);
  });

  it("keeps submit disabled when only the reason changes and financial values stay identical", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Just documenting, no change");

    expect(screen.getByRole("button", { name: /^adjust invoice$/i })).toBeDisabled();
    expect(dataLayer.recordInvoiceAdjustment).not.toHaveBeenCalled();
  });

  it("enables submit once a financial field actually changes and a reason is entered", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "120");
    await user.type(screen.getByLabelText(/reason/i), "Added a line item after the fact");

    expect(screen.getByRole("button", { name: /^adjust invoice$/i })).toBeEnabled();
    expect(screen.getByText("+$20.00")).toBeInTheDocument(); // derived change preview: $120 - $100 current total
  });

  it("disables submit and warns when the new total would fall below the amount already paid", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000, paid_minor: 8000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "50");
    await user.type(screen.getByLabelText(/reason/i), "Reduced scope");

    expect(screen.getByText(/reduce the invoice below the amount already paid/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^adjust invoice$/i })).toBeDisabled();
    expect(dataLayer.recordInvoiceAdjustment).not.toHaveBeenCalled();
  });

  it("allows an adjustment whose new total exceeds a fully-paid invoice's paid amount (upward correction)", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInvoiceAdjustment).mockResolvedValue({
      success: true,
      data: makeInvoice({ status: "paid" }),
    });
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({
          subtotal_minor: 10000,
          tax_minor: 0,
          discount_minor: 0,
          total_minor: 10000,
          paid_minor: 10000,
          status: "paid",
        })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "150");
    await user.type(screen.getByLabelText(/reason/i), "Client added an extra service");

    expect(screen.getByRole("button", { name: /^adjust invoice$/i })).toBeEnabled();
  });

  it("reuses the SAME idempotency key across a failed-then-retried submit within one open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInvoiceAdjustment)
      .mockResolvedValueOnce({ success: false, error: "Transient failure." })
      .mockResolvedValueOnce({ success: true, data: makeInvoice() });
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "120");
    await user.type(screen.getByLabelText(/reason/i), "Correction");

    await user.click(screen.getByRole("button", { name: /^adjust invoice$/i }));
    await waitFor(() => expect(dataLayer.recordInvoiceAdjustment).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /^adjust invoice$/i }));
    await waitFor(() => expect(dataLayer.recordInvoiceAdjustment).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.recordInvoiceAdjustment).mock.calls[0][2];
    const secondKey = vi.mocked(dataLayer.recordInvoiceAdjustment).mock.calls[1][2];
    expect(firstKey).toBe(secondKey);
  });

  it("displays the server error verbatim on failure and keeps the modal open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInvoiceAdjustment).mockResolvedValue({
      success: false,
      error: "This adjustment would leave the invoice underpaid.",
    });
    const onClose = vi.fn();
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000 })}
        onClose={onClose}
        onChanged={vi.fn()}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "120");
    await user.type(screen.getByLabelText(/reason/i), "Correction");
    await user.click(screen.getByRole("button", { name: /^adjust invoice$/i }));

    expect(await screen.findByText(/this adjustment would leave the invoice underpaid/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInvoiceAdjustment).mockRejectedValue(new Error("relation invoices does not exist"));
    const onClose = vi.fn();
    const onChanged = vi.fn();
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000, paid_minor: 0 })}
        onClose={onClose}
        onChanged={onChanged}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "120");
    await user.type(screen.getByLabelText(/reason/i), "Testing an unexpected failure");
    await user.click(screen.getByRole("button", { name: /adjust invoice/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation invoices does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByLabelText(/new subtotal/i)).toHaveValue(120);
    expect(screen.getByLabelText(/new tax/i)).toHaveValue(0);
    expect(screen.getByLabelText(/new discount/i)).toHaveValue(0);
    expect(screen.getByLabelText(/reason/i)).toHaveValue("Testing an unexpected failure");
    expect(screen.getByRole("button", { name: /adjust invoice/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("reuses the SAME adjustmentId across a thrown-then-retried submit within one open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInvoiceAdjustment)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeInvoice({ subtotal_minor: 12000, total_minor: 12000 }) });
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000, paid_minor: 0 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "120");
    await user.type(screen.getByLabelText(/reason/i), "Retry after throw");
    await user.click(screen.getByRole("button", { name: /adjust invoice/i }));
    await waitFor(() => expect(dataLayer.recordInvoiceAdjustment).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /adjust invoice/i }));
    await waitFor(() => expect(dataLayer.recordInvoiceAdjustment).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.recordInvoiceAdjustment).mock.calls[0][2];
    const secondKey = vi.mocked(dataLayer.recordInvoiceAdjustment).mock.calls[1][2];
    expect(firstKey).toBe(secondKey);
  });

  it("on success calls onChanged and closes the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInvoiceAdjustment).mockResolvedValue({
      success: true,
      data: makeInvoice({ subtotal_minor: 12000, total_minor: 12000 }),
    });
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(
      <InvoiceAdjustmentModal
        open
        invoice={makeInvoice({ subtotal_minor: 10000, tax_minor: 0, discount_minor: 0, total_minor: 10000 })}
        onClose={onClose}
        onChanged={onChanged}
      />,
    );

    const subtotalInput = screen.getByLabelText(/new subtotal/i);
    await user.clear(subtotalInput);
    await user.type(subtotalInput, "120");
    await user.type(screen.getByLabelText(/reason/i), "Correction");
    await user.click(screen.getByRole("button", { name: /^adjust invoice$/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
