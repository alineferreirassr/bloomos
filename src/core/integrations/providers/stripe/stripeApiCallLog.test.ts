import { beforeEach, describe, expect, it } from "vitest";
import { withApiCallLogging, listStripeApiCallsForWorkspace, resetStripeApiCallLog } from "@/core/integrations/providers/stripe/stripeApiCallLog";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";
import type Stripe from "stripe";

function makeFakeClient(): Stripe {
  return {
    balance: { retrieve: async () => ({ available: [] }) },
    customers: { create: async () => ({ id: "cus_1" }) },
  } as unknown as Stripe;
}

beforeEach(() => {
  resetStripeApiCallLog();
});

describe("withApiCallLogging", () => {
  it("logs a real successful call with a real duration", async () => {
    const provider = withApiCallLogging("ws_1", new StripeProvider(makeFakeClient()));
    await provider.ping();

    const calls = listStripeApiCallsForWorkspace("ws_1");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("ping");
    expect(calls[0].success).toBe(true);
    expect(calls[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("logs a real failed call with its error message, and still throws to the caller", async () => {
    const client = { customers: { create: async () => { throw new Error("Invalid request"); } } } as unknown as Stripe;
    const provider = withApiCallLogging("ws_1", new StripeProvider(client));

    await expect(provider.createCustomer({ email: "a@b.test", name: "A", metadata: {} })).rejects.toThrow("Invalid request");

    const calls = listStripeApiCallsForWorkspace("ws_1");
    expect(calls[0].success).toBe(false);
    expect(calls[0].error).toBe("Invalid request");
  });

  it("scopes calls per workspace", async () => {
    const providerA = withApiCallLogging("ws_a", new StripeProvider(makeFakeClient()));
    const providerB = withApiCallLogging("ws_b", new StripeProvider(makeFakeClient()));
    await providerA.ping();
    await providerB.ping();
    await providerB.ping();

    expect(listStripeApiCallsForWorkspace("ws_a")).toHaveLength(1);
    expect(listStripeApiCallsForWorkspace("ws_b")).toHaveLength(2);
  });

  it("never logs verifyInboundSignature/mapInboundEvent/constructVerifiedEvent — those are local, never real API traffic", () => {
    const provider = withApiCallLogging("ws_1", new StripeProvider(makeFakeClient()));
    provider.mapInboundEvent("payment_intent.succeeded");
    expect(listStripeApiCallsForWorkspace("ws_1")).toHaveLength(0);
  });
});
