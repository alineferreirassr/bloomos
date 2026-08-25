import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmPaymentActionModal } from "@/modules/finance/components/ConfirmPaymentActionModal";
import { makePayment } from "@/modules/finance/testUtils";

const baseProps = {
  open: true,
  title: "Mark Payment Failed",
  description: "This marks the payment as failed — a terminal state that can't be undone from here.",
  confirmLabel: "Mark Failed",
  pendingLabel: "Marking…",
};

describe("ConfirmPaymentActionModal", () => {
  it("renders the title and description", () => {
    render(
      <ConfirmPaymentActionModal
        {...baseProps}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /mark payment failed/i })).toBeInTheDocument();
    expect(screen.getByText(/terminal state that can't be undone/i)).toBeInTheDocument();
  });

  it("on success calls onConfirmed with the returned Payment and closes the modal", async () => {
    const user = userEvent.setup();
    const payment = makePayment({ id: "payment_1", status: "failed" });
    const onConfirm = vi.fn().mockResolvedValue({ success: true, data: payment });
    const onConfirmed = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmPaymentActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={onConfirmed} />,
    );

    await user.click(screen.getByRole("button", { name: /mark failed/i }));

    expect(onConfirm).toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith(payment);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure verbatim and keeps the modal open", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({ success: false, error: "Cannot mark this payment as failed." });
    const onClose = vi.fn();
    render(
      <ConfirmPaymentActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /mark failed/i }));

    expect(await screen.findByText(/cannot mark this payment as failed/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("relation payments does not exist"));
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    render(
      <ConfirmPaymentActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={onConfirmed} />,
    );

    await user.click(screen.getByRole("button", { name: /mark failed/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation payments does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: /mark failed/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling onConfirm again", async () => {
    const user = userEvent.setup();
    const payment = makePayment({ id: "payment_1", status: "failed" });
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({ success: true, data: payment });
    render(
      <ConfirmPaymentActionModal {...baseProps} onClose={vi.fn()} onConfirm={onConfirm} onConfirmed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /mark failed/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /mark failed/i }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
