import { describe, expect, it } from "vitest";
import { createProviderInstance, hasProviderImplementation, resetProviderFactoryRegistry } from "@/core/integrations/providerFactory";
import { registerStripeProviderFactory } from "@/modules/integrations/stripe/registerStripeProviderFactory";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";

describe("registerStripeProviderFactory", () => {
  it("registers a real StripeProvider factory for the stripe provider id, idempotently, and throws with no secret", () => {
    resetProviderFactoryRegistry();
    registerStripeProviderFactory();
    registerStripeProviderFactory();

    expect(hasProviderImplementation("stripe")).toBe(true);
    const instance = createProviderInstance("stripe", { secret: "sk_test_fake" });
    expect(instance).toBeInstanceOf(StripeProvider);
    expect(() => createProviderInstance("stripe")).toThrow(/secret key is required/);
  });
});
