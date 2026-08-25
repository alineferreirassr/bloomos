import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentEditModal } from "@/modules/finance/components/PaymentEditModal";
import { makePayment } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  updatePayment: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("PaymentEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form prefilled with the current Payment's values", () => {
    render(
      <PaymentEditModal
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD", reference: "ref-123" })}
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/amount/i)).toHaveValue(100);
    expect(screen.getByLabelText(/currency/i)).toHaveValue("USD");
    expect(screen.getByLabelText(/reference/i)).toHaveValue("ref-123");
  });

  it("on success calls updatePayment with the form values and calls onSaved", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updatePayment).mockResolvedValue({
      success: true,
      data: makePayment({ id: "payment_1" }),
    });
    const onSaved = vi.fn();
    render(
      <PaymentEditModal payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })} open onClose={vi.fn()} onSaved={onSaved} />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(dataLayer.updatePayment).toHaveBeenCalledWith("payment_1", expect.any(Object)));
    expect(onSaved).toHaveBeenCalled();
  });

  it("displays a resolved DataResult failure and keeps the modal open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updatePayment).mockResolvedValue({
      success: false,
      error: "Please fix the highlighted fields.",
    });
    const onSaved = vi.fn();
    render(
      <PaymentEditModal payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })} open onClose={vi.fn()} onSaved={onSaved} />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/please fix the highlighted fields/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — shows a generic fallback, does not call onSaved, preserves fields, and remains retryable", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updatePayment).mockRejectedValue(new Error("relation payments does not exist"));
    const onSaved = vi.fn();
    render(
      <PaymentEditModal
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD", reference: "ref-123" })}
        open
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation payments does not exist/i)).not.toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    // React Hook Form's own isSubmitting has already cleared — submit is usable again.
    expect(screen.getByRole("button", { name: /save changes/i })).not.toBeDisabled();
    expect(screen.getByLabelText(/amount/i)).toHaveValue(100);
    expect(screen.getByLabelText(/currency/i)).toHaveValue("USD");
    expect(screen.getByLabelText(/reference/i)).toHaveValue("ref-123");
  });

  it("allows retry after a thrown failure, calling updatePayment again with the same values", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updatePayment)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makePayment({ id: "payment_1" }) });
    const onSaved = vi.fn();
    render(
      <PaymentEditModal payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })} open onClose={vi.fn()} onSaved={onSaved} />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(dataLayer.updatePayment).toHaveBeenCalledTimes(2));
    expect(onSaved).toHaveBeenCalledTimes(1);
    const firstCallInput = vi.mocked(dataLayer.updatePayment).mock.calls[0][1];
    const secondCallInput = vi.mocked(dataLayer.updatePayment).mock.calls[1][1];
    expect(secondCallInput).toEqual(firstCallInput);
  });
});
