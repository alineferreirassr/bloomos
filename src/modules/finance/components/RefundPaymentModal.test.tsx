import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefundPaymentModal } from "@/modules/finance/components/RefundPaymentModal";
import { makePayment } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  getPaymentRefundableAmount: vi.fn(),
  refundPayment: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("RefundPaymentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills the amount with the full refundable amount on open", async () => {
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(10000);
    render(
      <RefundPaymentModal
        open
        onClose={vi.fn()}
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })}
        onRefunded={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText(/refund amount/i)).toHaveValue(100));
    expect(screen.getByText(/full refund/i)).toBeInTheDocument();
  });

  it("submits a full refund calling refundPayment with the full amount", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(10000);
    vi.mocked(dataLayer.refundPayment).mockResolvedValue({
      success: true,
      data: makePayment({ id: "payment_1", status: "refunded" }),
    });
    const onRefunded = vi.fn();
    const onClose = vi.fn();
    render(
      <RefundPaymentModal
        open
        onClose={onClose}
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })}
        onRefunded={onRefunded}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText(/refund amount/i)).toHaveValue(100));
    await user.click(screen.getByRole("button", { name: /^refund$/i }));

    await waitFor(() => expect(dataLayer.refundPayment).toHaveBeenCalledWith("payment_1", 10000, expect.any(String)));
    expect(onRefunded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("submits a partial refund when the amount is reduced", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(10000);
    vi.mocked(dataLayer.refundPayment).mockResolvedValue({
      success: true,
      data: makePayment({ id: "payment_1", status: "partially_refunded" }),
    });
    render(
      <RefundPaymentModal
        open
        onClose={vi.fn()}
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })}
        onRefunded={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText(/refund amount/i)).toHaveValue(100));
    const input = screen.getByLabelText(/refund amount/i);
    await user.clear(input);
    await user.type(input, "40");

    expect(screen.getByText(/partial refund/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^refund$/i }));

    await waitFor(() => expect(dataLayer.refundPayment).toHaveBeenCalledWith("payment_1", 4000, expect.any(String)));
  });

  it("F2.1C-C-IDEMPOTENCY: reuses the SAME idempotency key across multiple submit attempts within one modal open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(10000);
    vi.mocked(dataLayer.refundPayment).mockResolvedValueOnce({ success: false, error: "Transient failure." }).mockResolvedValueOnce({
      success: true,
      data: makePayment({ id: "payment_1", status: "refunded" }),
    });
    render(
      <RefundPaymentModal
        open
        onClose={vi.fn()}
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })}
        onRefunded={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText(/refund amount/i)).toHaveValue(100));
    await user.click(screen.getByRole("button", { name: /^refund$/i }));
    await waitFor(() => expect(dataLayer.refundPayment).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /^refund$/i }));
    await waitFor(() => expect(dataLayer.refundPayment).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.refundPayment).mock.calls[0][2];
    const secondKey = vi.mocked(dataLayer.refundPayment).mock.calls[1][2];
    expect(firstKey).toBe(secondKey);
  });

  it("disables submit and shows an error when the entered amount exceeds the refundable amount", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(5000);
    render(
      <RefundPaymentModal
        open
        onClose={vi.fn()}
        payment={makePayment({ id: "payment_1", amount_minor: 10000, currency: "USD" })}
        onRefunded={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText(/refund amount/i)).toHaveValue(50));
    const input = screen.getByLabelText(/refund amount/i);
    await user.clear(input);
    await user.type(input, "90");

    expect(screen.getByText(/cannot refund more than the refundable amount/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^refund$/i })).toBeDisabled();
    expect(dataLayer.refundPayment).not.toHaveBeenCalled();
  });
});
