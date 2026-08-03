import { describe, expect, it } from "vitest";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";
import { buildChargeRefundedEvent, buildCheckoutSessionCompletedEvent, buildPaymentIntentFailedEvent, createFakeStripeClient } from "@/core/integrations/providers/stripe/testFixtures";

describe("createFakeStripeClient", () => {
  it("produces a client a real StripeProvider can be constructed with and used", async () => {
    const provider = new StripeProvider(createFakeStripeClient());
    const result = await provider.ping();
    expect(result.ok).toBe(true);
  });

  it("lets a single method be overridden without losing the rest of the fake surface", async () => {
    const provider = new StripeProvider(createFakeStripeClient({ balance: { retrieve: async () => { throw new Error("rate limited"); } } }));
    const ping = await provider.ping();
    expect(ping.ok).toBe(false);
    expect(ping.error).toBe("rate limited");

    // Untouched methods still work.
    const customer = await provider.createCustomer({ email: "a@b.test", name: "A", metadata: {} });
    expect(customer.id).toBe("cus_fake");
  });
});

describe("event builders", () => {
  it("buildCheckoutSessionCompletedEvent produces a real, internally-consistent event the webhook handler can process", () => {
    const event = buildCheckoutSessionCompletedEvent({ amount_total: 12345 });
    expect(event.type).toBe("checkout.session.completed");
    const session = event.data.object as unknown as { amount_total: number; metadata: { bloomos_workspace_id: string } };
    expect(session.amount_total).toBe(12345);
    expect(session.metadata.bloomos_workspace_id).toBe("ws_1");
  });

  it("buildPaymentIntentFailedEvent and buildChargeRefundedEvent produce the right event types", () => {
    expect(buildPaymentIntentFailedEvent().type).toBe("payment_intent.payment_failed");
    expect(buildChargeRefundedEvent().type).toBe("charge.refunded");
  });
});
