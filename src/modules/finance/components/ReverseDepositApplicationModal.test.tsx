import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReverseDepositApplicationModal } from "@/modules/finance/components/ReverseDepositApplicationModal";
import { makePayment } from "@/modules/finance/testUtils";

vi.mock("@/lib/data", () => ({
  reverseDepositApplication: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const applicationPayment = () =>
  makePayment({
    id: "payment_app_1",
    payment_type: "adjustment",
    reference: "deposit_application_of:payment_deposit_1",
    amount_minor: 25000,
    invoice_id: "invoice_1",
  });

describe("ReverseDepositApplicationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays the applied amount as read-only, with no editable amount input", () => {
    render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    expect(screen.getAllByText("$250.00").length).toBeGreaterThan(0);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /amount/i })).not.toBeInTheDocument();
  });

  it("states FULL_ONLY and no-Cash-refund semantics", () => {
    render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    expect(screen.getByText(/partial reversal is not supported/i)).toBeInTheDocument();
    expect(screen.getByText(/not a payment refund/i)).toBeInTheDocument();
    expect(screen.getByText(/no money leaves the business/i)).toBeInTheDocument();
  });

  it("keeps submit disabled until a reason is entered", () => {
    render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /reverse application/i })).toBeDisabled();
  });

  it("rejects a whitespace-only reason", async () => {
    const user = userEvent.setup();
    render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "   ");
    expect(screen.getByRole("button", { name: /reverse application/i })).toBeDisabled();
  });

  it("submits the real user-entered reason, not a hardcoded string", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseDepositApplication).mockResolvedValue({
      success: true,
      data: makePayment({ payment_type: "refund", status: "succeeded" }),
    });
    render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Deposit applied to the wrong invoice");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));

    await waitFor(() =>
      expect(dataLayer.reverseDepositApplication).toHaveBeenCalledWith(
        "payment_app_1",
        expect.any(String),
        "Deposit applied to the wrong invoice",
      ),
    );
  });

  it("reuses the SAME idempotency key across a failed-then-retried submit within one open", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseDepositApplication)
      .mockResolvedValueOnce({ success: false, error: "Transient failure." })
      .mockResolvedValueOnce({ success: true, data: makePayment({ payment_type: "refund", status: "succeeded" }) });
    render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Retry test");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));
    await waitFor(() => expect(dataLayer.reverseDepositApplication).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /reverse application/i }));
    await waitFor(() => expect(dataLayer.reverseDepositApplication).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.reverseDepositApplication).mock.calls[0][1];
    const secondKey = vi.mocked(dataLayer.reverseDepositApplication).mock.calls[1][1];
    expect(firstKey).toBe(secondKey);
  });

  it("generates a NEW idempotency key when the modal is closed and reopened", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseDepositApplication).mockResolvedValue({
      success: true,
      data: makePayment({ payment_type: "refund", status: "succeeded" }),
    });
    const { rerender } = render(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "First attempt");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));
    await waitFor(() => expect(dataLayer.reverseDepositApplication).toHaveBeenCalledTimes(1));

    rerender(
      <ReverseDepositApplicationModal open={false} onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );
    rerender(
      <ReverseDepositApplicationModal open onClose={vi.fn()} payment={applicationPayment()} onReversed={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Second attempt");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));
    await waitFor(() => expect(dataLayer.reverseDepositApplication).toHaveBeenCalledTimes(2));

    const firstKey = vi.mocked(dataLayer.reverseDepositApplication).mock.calls[0][1];
    const secondKey = vi.mocked(dataLayer.reverseDepositApplication).mock.calls[1][1];
    expect(firstKey).not.toBe(secondKey);
  });

  it("displays the server error verbatim, keeps the modal open, and still refetches (stale-state safety)", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseDepositApplication).mockResolvedValue({
      success: false,
      error: "This Deposit Application has already been reversed.",
    });
    const onClose = vi.fn();
    const onReversed = vi.fn();
    render(
      <ReverseDepositApplicationModal open onClose={onClose} payment={applicationPayment()} onReversed={onReversed} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Attempting reversal");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));

    expect(await screen.findByText(/already been reversed/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onReversed).toHaveBeenCalled();
  });

  it("recovers from an unexpected thrown error — resets submitting, shows a generic fallback, does not hang", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseDepositApplication).mockRejectedValue(new Error("relation payments does not exist"));
    const onClose = vi.fn();
    const onReversed = vi.fn();
    render(
      <ReverseDepositApplicationModal open onClose={onClose} payment={applicationPayment()} onReversed={onReversed} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Testing an unexpected failure");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/relation payments does not exist/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reverse application/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("on success calls onReversed and closes the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reverseDepositApplication).mockResolvedValue({
      success: true,
      data: makePayment({ payment_type: "refund", status: "succeeded" }),
    });
    const onReversed = vi.fn();
    const onClose = vi.fn();
    render(
      <ReverseDepositApplicationModal open onClose={onClose} payment={applicationPayment()} onReversed={onReversed} />,
    );

    await user.type(screen.getByLabelText(/reason/i), "Client cancelled the deposit application");
    await user.click(screen.getByRole("button", { name: /reverse application/i }));

    await waitFor(() => expect(onReversed).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
