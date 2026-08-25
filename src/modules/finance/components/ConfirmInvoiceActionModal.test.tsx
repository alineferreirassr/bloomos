import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmInvoiceActionModal } from "@/modules/finance/components/ConfirmInvoiceActionModal";
import { makeInvoice } from "@/modules/finance/testUtils";

const baseProps = {
  open: true,
  title: "Archive Invoice",
  description: 'This archives "Studio Rental". It will be hidden from the active Invoices list until restored.',
  confirmLabel: "Archive",
  pendingLabel: "Archiving…",
};

describe("ConfirmInvoiceActionModal", () => {
  it("renders the title and description", () => {
    render(
      <ConfirmInvoiceActionModal
        {...baseProps}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /archive invoice/i })).toBeInTheDocument();
    expect(screen.getByText(/hidden from the active invoices list/i)).toBeInTheDocument();
  });

  it("on success calls onConfirmed with the returned Invoice and closes the modal", async () => {
    const user = userEvent.setup();
    const invoice = makeInvoice({ id: "invoice_1", status: "archived" });
    const onConfirm = vi.fn().mockResolvedValue({ success: true, data: invoice });
    const onConfirmed = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmInvoiceActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={onConfirmed} />,
    );

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(onConfirm).toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith(invoice);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure verbatim and keeps the modal open", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({ success: false, error: "This invoice is already archived." });
    const onClose = vi.fn();
    render(
      <ConfirmInvoiceActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/this invoice is already archived/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("relation invoices does not exist"));
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    render(
      <ConfirmInvoiceActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={onConfirmed} />,
    );

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation invoices does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: /^archive$/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling onConfirm again", async () => {
    const user = userEvent.setup();
    const invoice = makeInvoice({ id: "invoice_1", status: "archived" });
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({ success: true, data: invoice });
    render(
      <ConfirmInvoiceActionModal {...baseProps} onClose={vi.fn()} onConfirm={onConfirm} onConfirmed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
