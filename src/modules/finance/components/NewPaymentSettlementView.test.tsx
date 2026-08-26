import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewPaymentSettlementView } from "@/modules/finance/components/NewPaymentSettlementView";
import { makePayment } from "@/modules/finance/testUtils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  getInvoices: vi.fn(),
  recordPaymentSettlement: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockClients() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    { id: "client_1", first_name: "Jordan", last_name: "Ellis" } as never,
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
  vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);
}

async function waitForClientOptions() {
  const select = await screen.findByLabelText(/^client\b/i);
  await waitFor(() => {
    expect(within(select).getAllByRole("option").length).toBeGreaterThan(1);
  });
  return select;
}

describe("NewPaymentSettlementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not offer Stripe as a settlement method", async () => {
    mockClients();
    render(<NewPaymentSettlementView />);

    const methodSelect = await screen.findByLabelText(/payment method/i);
    expect(within(methodSelect).queryByRole("option", { name: /stripe/i })).not.toBeInTheDocument();
  });

  it("calls recordPaymentSettlement (not createPayment) with a generated paymentId and navigates to the new payment", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.recordPaymentSettlement).mockResolvedValue({
      success: true,
      data: makePayment({ id: "payment_new" }),
    });

    render(<NewPaymentSettlementView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    await user.click(screen.getByRole("button", { name: /record settlement/i }));

    await waitFor(() => expect(dataLayer.recordPaymentSettlement).toHaveBeenCalledWith(expect.objectContaining({ amount_minor: 15000 }), expect.any(String)));
    const paymentId = vi.mocked(dataLayer.recordPaymentSettlement).mock.calls[0][1];
    expect(paymentId.length).toBeGreaterThan(0);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/payments/payment_new"));
  });

  it("reuses the SAME paymentId across a thrown-then-retried submit with an unchanged payload", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.recordPaymentSettlement)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makePayment({ id: "payment_new" }) });

    render(<NewPaymentSettlementView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    const submitButton = screen.getByRole("button", { name: /record settlement/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.recordPaymentSettlement).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.recordPaymentSettlement).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.recordPaymentSettlement).mock.calls[1][1];
    expect(secondId).toBe(firstId);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/payments/payment_new"));
  });

  it("generates a NEW paymentId when the Founder edits the payload after a failed attempt", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.recordPaymentSettlement)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makePayment({ id: "payment_new" }) });

    render(<NewPaymentSettlementView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    const amountInput = screen.getByLabelText(/^amount\b/i);
    await user.clear(amountInput);
    await user.type(amountInput, "150");
    const submitButton = screen.getByRole("button", { name: /record settlement/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();

    await user.clear(amountInput);
    await user.type(amountInput, "200");
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.recordPaymentSettlement).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.recordPaymentSettlement).mock.calls[0][1];
    const secondCall = vi.mocked(dataLayer.recordPaymentSettlement).mock.calls[1];
    expect(secondCall[1]).not.toBe(firstId);
    expect(secondCall[0]).toEqual(expect.objectContaining({ amount_minor: 20000 }));
  });

  it("surfaces a translated error from the Repository without navigating", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.recordPaymentSettlement).mockResolvedValue({
      success: false,
      error: "The stripe payment method is not available for manual settlement.",
    });

    render(<NewPaymentSettlementView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    await user.click(screen.getByRole("button", { name: /record settlement/i }));

    expect(await screen.findByText(/not available for manual settlement/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
