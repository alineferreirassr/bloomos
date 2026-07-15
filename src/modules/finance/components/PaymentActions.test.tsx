import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentActions } from "@/modules/finance/components/PaymentActions";
import { makePayment } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  cancelPayment: vi.fn(),
  markPaymentFailed: vi.fn(),
  markPaymentProcessing: vi.fn(),
  markPaymentSucceeded: vi.fn(),
  refundPayment: vi.fn(),
  getPaymentRefundableAmount: vi.fn(),
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  getInvoices: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("PaymentActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(0);
    vi.mocked(dataLayer.getClients).mockResolvedValue([]);
    vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
    vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
    vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);
  });

  it("shows Edit, Mark Processing, and Mark Failed for a pending payment", () => {
    render(<PaymentActions payment={makePayment({ status: "pending" })} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark processing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark failed/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^refund$/i })).not.toBeInTheDocument();
  });

  it("shows Refund for a succeeded payment", () => {
    render(<PaymentActions payment={makePayment({ status: "succeeded" })} onChanged={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^refund$/i })).toBeInTheDocument();
  });

  it("hides Edit for a refunded (final) payment", () => {
    render(<PaymentActions payment={makePayment({ status: "refunded" })} onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("marks processing directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markPaymentProcessing).mockResolvedValue({
      success: true,
      data: makePayment({ status: "processing" }),
    });
    const onChanged = vi.fn();
    render(<PaymentActions payment={makePayment({ id: "payment_1", status: "pending" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /mark processing/i }));

    await waitFor(() => expect(dataLayer.markPaymentProcessing).toHaveBeenCalledWith("payment_1"));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks failed through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markPaymentFailed).mockResolvedValue({
      success: true,
      data: makePayment({ status: "failed" }),
    });
    const onChanged = vi.fn();
    render(<PaymentActions payment={makePayment({ id: "payment_1", status: "pending" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /mark failed/i }));
    const dialog = screen.getByRole("dialog", { name: /mark payment failed/i });
    await user.click(within(dialog).getByRole("button", { name: /mark failed/i }));

    await waitFor(() => expect(dataLayer.markPaymentFailed).toHaveBeenCalledWith("payment_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("cancels through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.cancelPayment).mockResolvedValue({
      success: true,
      data: makePayment({ status: "cancelled" }),
    });
    const onChanged = vi.fn();
    render(<PaymentActions payment={makePayment({ id: "payment_1", status: "pending" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    const dialog = screen.getByRole("dialog", { name: /cancel payment/i });
    await user.click(within(dialog).getByRole("button", { name: /cancel payment/i }));

    await waitFor(() => expect(dataLayer.cancelPayment).toHaveBeenCalledWith("payment_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("opens the Refund modal showing the refundable amount", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPaymentRefundableAmount).mockResolvedValue(10000);
    render(<PaymentActions payment={makePayment({ id: "payment_1", status: "succeeded", amount_minor: 10000 })} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^refund$/i }));

    const dialog = await screen.findByRole("dialog", { name: /refund payment/i });
    expect(within(dialog).getByText("$100.00")).toBeInTheDocument();
  });

  it("surfaces an error and does not call onChanged when a quick action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markPaymentProcessing).mockResolvedValue({
      success: false,
      error: "Cannot mark this payment processing.",
    });
    const onChanged = vi.fn();
    render(<PaymentActions payment={makePayment({ id: "payment_1", status: "pending" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /mark processing/i }));

    expect(await screen.findByText(/cannot mark this payment processing/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
