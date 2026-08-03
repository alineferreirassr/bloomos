import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types/invoice";

const { fakeInvoice, fakeProvider } = vi.hoisted(() => {
  const fakeInvoice: Invoice = {
    id: "inv_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    event_id: "event_1",
    contract_id: null,
    invoice_number: "INV-0001",
    title: "Wedding Photography",
    description: null,
    status: "sent",
    issue_date: "2026-01-01",
    due_date: "2026-02-01",
    subtotal_minor: 100000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 100000,
    paid_minor: 40000,
    balance_minor: 60000,
    currency: "usd",
    notes: null,
    sent_at: "2026-01-01T00:00:00.000Z",
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const fakeProvider = {
    createCheckoutSession: vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" }),
  };
  return { fakeInvoice, fakeProvider };
});

vi.mock("@/lib/data", () => ({
  getInvoiceById: vi.fn().mockResolvedValue(fakeInvoice),
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeProviderForWorkspace: vi.fn().mockResolvedValue(fakeProvider),
}));

vi.mock("@/modules/integrations/stripe/customerSync", () => ({
  syncClientToStripeCustomer: vi.fn().mockResolvedValue({ mapping: { stripe_customer_id: "cus_1" } }),
}));

vi.mock("@/modules/integrations/stripe/productSync", () => ({
  getExistingStripeProductMapping: vi.fn().mockReturnValue({ stripe_price_id: "price_1" }),
  syncServiceToStripeProduct: vi.fn().mockResolvedValue({ mapping: { stripe_price_id: "price_synced" } }),
}));

import { createCheckoutSession, createDepositCheckoutSession, createRemainingBalanceCheckoutSession } from "@/modules/integrations/stripe/checkoutSessions";
import { getExistingStripeProductMapping, syncServiceToStripeProduct } from "@/modules/integrations/stripe/productSync";

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getExistingStripeProductMapping).mockReturnValue({ stripe_price_id: "price_1" } as never);
});

describe("createCheckoutSession", () => {
  it("builds a single-service line item from an already-synced Price", async () => {
    const result = await createCheckoutSession({
      workspaceId: "ws_1",
      clientId: "client_1",
      paymentType: "full_payment",
      currency: "usd",
      lineItems: [{ serviceId: "svc_1" }],
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(fakeProvider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "payment", customer: "cus_1", line_items: [{ price: "price_1", quantity: 1 }] }),
    );
    expect(result).toEqual({ sessionId: "cs_1", url: "https://checkout.stripe.com/cs_1" });
  });

  it("supports multiple services in one session", async () => {
    await createCheckoutSession({
      workspaceId: "ws_1",
      clientId: "client_1",
      paymentType: "full_payment",
      currency: "usd",
      lineItems: [{ serviceId: "svc_1" }, { serviceId: "svc_2", quantity: 2 }],
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    const call = fakeProvider.createCheckoutSession.mock.calls[0][0];
    expect(call.line_items).toHaveLength(2);
    expect(call.line_items[1]).toEqual({ price: "price_1", quantity: 2 });
  });

  it("auto-syncs a service with no existing Price mapping", async () => {
    vi.mocked(getExistingStripeProductMapping).mockReturnValue(null);
    await createCheckoutSession({
      workspaceId: "ws_1",
      clientId: "client_1",
      paymentType: "full_payment",
      currency: "usd",
      lineItems: [{ serviceId: "svc_new" }],
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(syncServiceToStripeProduct).toHaveBeenCalledWith("ws_1", "svc_new");
    const call = fakeProvider.createCheckoutSession.mock.calls[0][0];
    expect(call.line_items[0]).toEqual({ price: "price_synced", quantity: 1 });
  });

  it("supports a custom ad-hoc amount via price_data", async () => {
    await createCheckoutSession({
      workspaceId: "ws_1",
      clientId: "client_1",
      paymentType: "other",
      currency: "usd",
      lineItems: [{ amountMinor: 12345, description: "Custom add-on" }],
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    const call = fakeProvider.createCheckoutSession.mock.calls[0][0];
    expect(call.line_items[0]).toEqual({ price_data: { currency: "usd", unit_amount: 12345, product_data: { name: "Custom add-on" } }, quantity: 1 });
  });

  it("passes a coupon and automatic tax through when provided", async () => {
    await createCheckoutSession({
      workspaceId: "ws_1",
      clientId: "client_1",
      paymentType: "full_payment",
      currency: "usd",
      lineItems: [{ amountMinor: 1000 }],
      couponId: "coupon_promo",
      enableAutomaticTax: true,
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    const call = fakeProvider.createCheckoutSession.mock.calls[0][0];
    expect(call.discounts).toEqual([{ coupon: "coupon_promo" }]);
    expect(call.automatic_tax).toEqual({ enabled: true });
  });

  it("rejects an empty line item list", async () => {
    await expect(
      createCheckoutSession({ workspaceId: "ws_1", clientId: "client_1", paymentType: "full_payment", currency: "usd", lineItems: [], successUrl: "a", cancelUrl: "b" }),
    ).rejects.toThrow(/At least one line item/);
  });
});

describe("createDepositCheckoutSession", () => {
  it("builds a deposit line item tagged with the Invoice's own metadata", async () => {
    await createDepositCheckoutSession("ws_1", "inv_1", 25000, "https://app.test/success", "https://app.test/cancel");
    const call = fakeProvider.createCheckoutSession.mock.calls[0][0];
    expect(call.line_items[0].price_data.unit_amount).toBe(25000);
    expect(call.metadata.bloomos_payment_type).toBe("deposit");
    expect(call.metadata.bloomos_invoice_id).toBe("inv_1");
  });
});

describe("createRemainingBalanceCheckoutSession", () => {
  it("uses the Invoice's own real balance_minor, never a client-supplied figure", async () => {
    await createRemainingBalanceCheckoutSession("ws_1", "inv_1", "https://app.test/success", "https://app.test/cancel");
    const call = fakeProvider.createCheckoutSession.mock.calls[0][0];
    expect(call.line_items[0].price_data.unit_amount).toBe(60000);
    expect(call.metadata.bloomos_payment_type).toBe("final_payment");
  });
});
