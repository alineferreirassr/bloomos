import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoidInvoiceModal } from "@/modules/finance/components/VoidInvoiceModal";
import { makeInvoice } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  voidInvoice: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("VoidInvoiceModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows clean-void copy with no settlement preview when nothing has been paid", () => {
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ title: "Studio Rental", paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText(/no payments have been applied/i)).toBeInTheDocument();
    expect(screen.queryByText(/amount being cancelled/i)).not.toBeInTheDocument();
  });

  it("shows the partial-cancellation preview with settled/cancelled/final-balance figures when a balance remains", () => {
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 4000, balance_minor: 6000, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText(/cancels the unpaid remainder/i)).toBeInTheDocument();
    expect(screen.getByText(/will not be refunded/i)).toBeInTheDocument();
    expect(screen.getByText(/amount being cancelled/i)).toBeInTheDocument();
    expect(screen.getByText("$60.00")).toBeInTheDocument(); // amount being cancelled = balance_minor
    expect(screen.getByText("$40.00")).toBeInTheDocument(); // already settled = paid_minor
  });

  it("keeps submit disabled until a reason is entered", async () => {
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^void$/i })).toBeDisabled();
    expect(dataLayer.voidInvoice).not.toHaveBeenCalled();
  });

  it("submits the real user-entered reason, not a hardcoded string", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.voidInvoice).mockResolvedValue({ success: true, data: makeInvoice({ status: "voided" }) });
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ id: "invoice_9", paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Client cancelled the booking");
    await user.click(screen.getByRole("button", { name: /^void$/i }));

    await waitFor(() =>
      expect(dataLayer.voidInvoice).toHaveBeenCalledWith("invoice_9", expect.any(String), "Client cancelled the booking"),
    );
  });

  it("reuses the SAME idempotency key across a failed-then-retried submit within one open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.voidInvoice)
      .mockResolvedValueOnce({ success: false, error: "Transient failure." })
      .mockResolvedValueOnce({ success: true, data: makeInvoice({ status: "voided" }) });
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Retry test");
    await user.click(screen.getByRole("button", { name: /^void$/i }));
    await waitFor(() => expect(dataLayer.voidInvoice).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /^void$/i }));
    await waitFor(() => expect(dataLayer.voidInvoice).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.voidInvoice).mock.calls[0][1];
    const secondKey = vi.mocked(dataLayer.voidInvoice).mock.calls[1][1];
    expect(firstKey).toBe(secondKey);
  });

  it("generates a NEW idempotency key when the modal is closed and reopened", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.voidInvoice).mockResolvedValue({ success: true, data: makeInvoice({ status: "voided" }) });
    const onClose = vi.fn();
    const { rerender } = render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={onClose}
        onChanged={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "First attempt");
    await user.click(screen.getByRole("button", { name: /^void$/i }));
    await waitFor(() => expect(dataLayer.voidInvoice).toHaveBeenCalledTimes(1));

    rerender(
      <VoidInvoiceModal
        open={false}
        invoice={makeInvoice({ paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={onClose}
        onChanged={vi.fn()}
      />,
    );
    rerender(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={onClose}
        onChanged={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Second attempt");
    await user.click(screen.getByRole("button", { name: /^void$/i }));
    await waitFor(() => expect(dataLayer.voidInvoice).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.voidInvoice).mock.calls[0][1];
    const secondKey = vi.mocked(dataLayer.voidInvoice).mock.calls[1][1];
    expect(firstKey).not.toBe(secondKey);
  });

  it("displays the server error verbatim on failure and keeps the modal open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.voidInvoice).mockResolvedValue({
      success: false,
      error: "Cannot void this invoice — it has an unresolved Customer Deposit Application.",
    });
    const onClose = vi.fn();
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 4000, balance_minor: 6000, total_minor: 10000 })}
        onClose={onClose}
        onChanged={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Cancelling");
    await user.click(screen.getByRole("button", { name: /^void$/i }));

    expect(await screen.findByText(/unresolved customer deposit application/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("on success calls onChanged and closes the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.voidInvoice).mockResolvedValue({ success: true, data: makeInvoice({ status: "voided" }) });
    const onChanged = vi.fn();
    const onClose = vi.fn();
    render(
      <VoidInvoiceModal
        open
        invoice={makeInvoice({ paid_minor: 0, balance_minor: 10000, total_minor: 10000 })}
        onClose={onClose}
        onChanged={onChanged}
      />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Client cancelled");
    await user.click(screen.getByRole("button", { name: /^void$/i }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
