import { registerProviderFactory } from "@/core/integrations/providerFactory";
import { createStripeClient } from "@/core/integrations/providers/stripe/stripeClient";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";

let registered = false;

/** v2 Checkpoint 23 — registers the real `StripeProvider` factory against the `"stripe"` provider id already in the Provider Registry (Checkpoint 22). Throws if called with no secret — a caller must resolve a connection's own credential first (`resolveProviderSecret`), never construct a Stripe client from nothing. */
export function registerStripeProviderFactory(): void {
  if (registered) return;
  registerProviderFactory("stripe", (params) => {
    if (!params?.secret) throw new Error("A Stripe secret key is required to construct a StripeProvider instance.");
    return new StripeProvider(createStripeClient(params.secret));
  });
  registered = true;
}
