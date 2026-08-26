import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewPaymentView } from "@/modules/finance/components/NewPaymentView";
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
  createPayment: vi.fn(),
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

describe("NewPaymentView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createPayment with a generated paymentId and navigates to the new payment", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createPayment).mockResolvedValue({
      success: true,
      data: makePayment({ id: "payment_new" }),
    });

    render(<NewPaymentView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    await user.click(screen.getByRole("button", { name: /record payment/i }));

    await waitFor(() =>
      expect(dataLayer.createPayment).toHaveBeenCalledWith(expect.objectContaining({ amount_minor: 15000 }), expect.any(String)),
    );
    const paymentId = vi.mocked(dataLayer.createPayment).mock.calls[0][1];
    expect(paymentId.length).toBeGreaterThan(0);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/payments/payment_new"));
  });

  it("surfaces a translated error from the Repository without navigating", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createPayment).mockResolvedValue({
      success: false,
      error: "This payment would exceed the invoice's remaining balance.",
    });

    render(<NewPaymentView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    await user.click(screen.getByRole("button", { name: /record payment/i }));

    expect(await screen.findByText(/would exceed the invoice's remaining balance/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("reuses the SAME paymentId across a thrown-then-retried submit with an unchanged payload", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createPayment)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makePayment({ id: "payment_new" }) });

    render(<NewPaymentView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    const submitButton = screen.getByRole("button", { name: /record payment/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.createPayment).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.createPayment).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.createPayment).mock.calls[1][1];
    expect(secondId).toBe(firstId);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/payments/payment_new"));
  });

  it("generates a NEW paymentId when the Founder edits the payload after a failed attempt", async () => {
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createPayment)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makePayment({ id: "payment_new" }) });

    render(<NewPaymentView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    const amountInput = screen.getByLabelText(/^amount\b/i);
    await user.clear(amountInput);
    await user.type(amountInput, "150");
    const submitButton = screen.getByRole("button", { name: /record payment/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();

    await user.clear(amountInput);
    await user.type(amountInput, "200");
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.createPayment).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.createPayment).mock.calls[0][1];
    const secondCall = vi.mocked(dataLayer.createPayment).mock.calls[1];
    expect(secondCall[1]).not.toBe(firstId);
    expect(secondCall[0]).toEqual(expect.objectContaining({ amount_minor: 20000 }));
  });

  it("does not allow a duplicate submit while a request is pending", async () => {
    const user = userEvent.setup();
    mockClients();
    let resolveRecord: (value: { success: true; data: ReturnType<typeof makePayment> }) => void;
    vi.mocked(dataLayer.createPayment).mockReturnValue(
      new Promise((resolve) => {
        resolveRecord = resolve;
      }),
    );

    render(<NewPaymentView />);
    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "150");
    const submitButton = screen.getByRole("button", { name: /record payment/i });
    await user.click(submitButton);
    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);

    expect(dataLayer.createPayment).toHaveBeenCalledTimes(1);
    resolveRecord!({ success: true, data: makePayment({ id: "payment_new" }) });
  });

  it("uses an independent paymentId from NewPaymentSettlementView — each owns its own ref, never a shared one", async () => {
    // Rendered sequentially (both forms share id="client_id" internally via
    // PaymentForm, so rendering both at once would produce duplicate DOM
    // ids and unreliable label queries) — this still proves the two
    // components generate their identity independently, from two distinct
    // useRef instances in two distinct component functions, not a single
    // shared module-level ref.
    const user = userEvent.setup();
    mockClients();
    vi.mocked(dataLayer.createPayment).mockResolvedValue({ success: true, data: makePayment({ id: "payment_a" }) });
    vi.mocked(dataLayer.recordPaymentSettlement).mockResolvedValue({ success: true, data: makePayment({ id: "payment_b" }) });

    const paymentRender = render(<NewPaymentView />);
    await waitFor(() => expect(within(paymentRender.container).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(within(paymentRender.container).getByLabelText(/^client\b/i), "client_1");
    await user.clear(within(paymentRender.container).getByLabelText(/^amount\b/i));
    await user.type(within(paymentRender.container).getByLabelText(/^amount\b/i), "150");
    await user.click(within(paymentRender.container).getByRole("button", { name: /record payment/i }));
    await waitFor(() => expect(dataLayer.createPayment).toHaveBeenCalledTimes(1));
    const paymentId = vi.mocked(dataLayer.createPayment).mock.calls[0][1];
    paymentRender.unmount();

    const settlementRender = render(<NewPaymentSettlementView />);
    await waitFor(() => expect(within(settlementRender.container).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(within(settlementRender.container).getByLabelText(/^client\b/i), "client_1");
    await user.clear(within(settlementRender.container).getByLabelText(/^amount\b/i));
    await user.type(within(settlementRender.container).getByLabelText(/^amount\b/i), "150");
    await user.click(within(settlementRender.container).getByRole("button", { name: /record settlement/i }));
    await waitFor(() => expect(dataLayer.recordPaymentSettlement).toHaveBeenCalledTimes(1));
    const settlementId = vi.mocked(dataLayer.recordPaymentSettlement).mock.calls[0][1];

    expect(settlementId).not.toBe(paymentId);
  });
});
