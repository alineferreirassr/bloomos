import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmExpenseActionModal } from "@/modules/finance/components/ConfirmExpenseActionModal";
import { makeExpense } from "@/modules/finance/testUtils";

const baseProps = {
  open: true,
  title: "Cancel Expense",
  description: 'This marks "Venue deposit" as cancelled — a terminal state that can\'t be undone from here.',
  confirmLabel: "Cancel Expense",
  pendingLabel: "Cancelling…",
};

describe("ConfirmExpenseActionModal", () => {
  it("renders the title and description", () => {
    render(
      <ConfirmExpenseActionModal
        {...baseProps}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: /cancel expense/i })).toBeInTheDocument();
    expect(screen.getByText(/terminal state that can't be undone/i)).toBeInTheDocument();
  });

  it("on success calls onConfirmed with the returned Expense and closes the modal", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ id: "expense_1", status: "cancelled" });
    const onConfirm = vi.fn().mockResolvedValue({ success: true, data: expense });
    const onConfirmed = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmExpenseActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={onConfirmed} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel expense/i }));

    expect(onConfirm).toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith(expense);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure verbatim and keeps the modal open", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue({ success: false, error: "Cannot cancel an expense that is already cancelled." });
    const onClose = vi.fn();
    render(
      <ConfirmExpenseActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel expense/i }));

    expect(await screen.findByText(/cannot cancel an expense that is already cancelled/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang, and refetches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("relation expenses does not exist"));
    const onClose = vi.fn();
    const onConfirmed = vi.fn();
    render(
      <ConfirmExpenseActionModal {...baseProps} onClose={onClose} onConfirm={onConfirm} onConfirmed={onConfirmed} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel expense/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation expenses does not exist/i)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: /cancel expense/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
  });

  it("allows retry after a thrown failure, calling onConfirm again", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ id: "expense_1", status: "cancelled" });
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({ success: true, data: expense });
    render(
      <ConfirmExpenseActionModal {...baseProps} onClose={vi.fn()} onConfirm={onConfirm} onConfirmed={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel expense/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel expense/i }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
