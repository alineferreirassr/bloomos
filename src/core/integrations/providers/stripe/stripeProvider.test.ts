import { describe, expect, it, vi } from "vitest";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";
import type Stripe from "stripe";

/** A minimal fake matching only the Stripe SDK surface `StripeProvider` actually calls — never a real network call, injected via the constructor so no `stripe` module mocking is needed. */
function makeFakeStripeClient(overrides: Record<string, unknown> = {}): Stripe {
  return {
    balance: { retrieve: vi.fn().mockResolvedValue({ available: [] }) },
    accounts: { retrieve: vi.fn().mockResolvedValue({ id: "acct_1", email: "owner@example.test" }) },
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: "pi_1", status: "requires_payment_method" }),
      retrieve: vi.fn().mockResolvedValue({ id: "pi_1", status: "succeeded" }),
    },
    refunds: { create: vi.fn().mockResolvedValue({ id: "re_1", status: "succeeded" }) },
    webhooks: { constructEvent: vi.fn() },
    customers: {
      create: vi.fn().mockResolvedValue({ id: "cus_1", email: "client@example.test" }),
      update: vi.fn().mockResolvedValue({ id: "cus_1", email: "updated@example.test" }),
      retrieve: vi.fn().mockResolvedValue({ id: "cus_1" }),
    },
    products: {
      create: vi.fn().mockResolvedValue({ id: "prod_1", name: "Photography Package" }),
      update: vi.fn().mockResolvedValue({ id: "prod_1", active: false }),
    },
    prices: {
      create: vi.fn().mockResolvedValue({ id: "price_1", unit_amount: 50000 }),
      update: vi.fn().mockResolvedValue({ id: "price_1", active: false }),
    },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" }), retrieve: vi.fn().mockResolvedValue({ id: "cs_1" }) } },
    paymentLinks: { create: vi.fn().mockResolvedValue({ id: "plink_1", url: "https://buy.stripe.com/plink_1" }), update: vi.fn().mockResolvedValue({ id: "plink_1", active: false }) },
    invoiceItems: { create: vi.fn().mockResolvedValue({ id: "ii_1" }) },
    invoices: {
      create: vi.fn().mockResolvedValue({ id: "in_1", status: "draft" }),
      finalizeInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "open" }),
      sendInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "open" }),
      voidInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "void" }),
      markUncollectible: vi.fn().mockResolvedValue({ id: "in_1", status: "uncollectible" }),
      retrieve: vi.fn().mockResolvedValue({ id: "in_1", status: "paid" }),
    },
    ...overrides,
  } as unknown as Stripe;
}

describe("StripeProvider.ping", () => {
  it("returns ok with a real balance.retrieve call", async () => {
    const provider = new StripeProvider(makeFakeStripeClient());
    const result = await provider.ping();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok:false with the error message when the call rejects", async () => {
    const client = makeFakeStripeClient({ balance: { retrieve: vi.fn().mockRejectedValue(new Error("Invalid API key")) } });
    const provider = new StripeProvider(client);
    const result = await provider.ping();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid API key");
  });
});

describe("StripeProvider PaymentProvider contract", () => {
  it("createCharge/getChargeStatus/refundCharge all delegate to the real Stripe SDK shape", async () => {
    const provider = new StripeProvider(makeFakeStripeClient());
    const charge = await provider.createCharge({ amountMinor: 50000, currency: "usd", description: "Deposit" });
    expect(charge).toEqual({ externalChargeId: "pi_1", status: "requires_payment_method" });

    const status = await provider.getChargeStatus("pi_1");
    expect(status).toEqual({ status: "succeeded" });

    const refund = await provider.refundCharge("pi_1", 10000);
    expect(refund).toEqual({ externalRefundId: "re_1", status: "succeeded" });
  });
});

describe("StripeProvider WebhookProvider contract", () => {
  it("verifyInboundSignature returns true when constructEvent succeeds, false when it throws", () => {
    const okClient = makeFakeStripeClient();
    expect(new StripeProvider(okClient).verifyInboundSignature({ rawBody: "{}", signatureHeader: "t=1,v1=abc", secret: "whsec_test" })).toBe(true);

    const badClient = makeFakeStripeClient({ webhooks: { constructEvent: vi.fn().mockImplementation(() => { throw new Error("bad signature"); }) } });
    expect(new StripeProvider(badClient).verifyInboundSignature({ rawBody: "{}", signatureHeader: "bad", secret: "whsec_test" })).toBe(false);
  });

  it("mapInboundEvent maps a real Stripe event name to BloomOS's own WebhookEventType, exactly as sdk.ts's own doc comment anticipated", () => {
    const provider = new StripeProvider(makeFakeStripeClient());
    expect(provider.mapInboundEvent("payment_intent.succeeded")).toBe("payment.succeeded");
    expect(provider.mapInboundEvent("invoice.paid")).toBe("invoice.paid");
    expect(provider.mapInboundEvent("some.unknown.event")).toBeNull();
  });
});

describe("StripeProvider Customers/Products/Prices/Checkout/PaymentLinks/Invoices", () => {
  it("every real operation delegates to the correct Stripe SDK method with the right params", async () => {
    const provider = new StripeProvider(makeFakeStripeClient());

    const customer = await provider.createCustomer({ email: "client@example.test", name: "Jordan Blake", metadata: { bloomos_client_id: "client_1" } });
    expect(customer.id).toBe("cus_1");

    const product = await provider.createProduct({ name: "Photography Package", metadata: { bloomos_service_id: "svc_1" } });
    expect(product.id).toBe("prod_1");

    const price = await provider.createPrice({ productId: "prod_1", unitAmountMinor: 50000, currency: "usd" });
    expect(price.id).toBe("price_1");

    const archived = await provider.archiveProduct("prod_1");
    expect(archived.active).toBe(false);

    const session = await provider.createCheckoutSession({ mode: "payment", line_items: [], success_url: "https://app.test/success" });
    expect(session.id).toBe("cs_1");

    const link = await provider.createPaymentLink({ line_items: [{ price: "price_1", quantity: 1 }] });
    expect(link.id).toBe("plink_1");

    const invoice = await provider.createStripeInvoice({ customerId: "cus_1", autoAdvance: true });
    expect(invoice.id).toBe("in_1");

    const finalized = await provider.finalizeStripeInvoice("in_1");
    expect(finalized.status).toBe("open");

    const voided = await provider.voidStripeInvoice("in_1");
    expect(voided.status).toBe("void");
  });
});
