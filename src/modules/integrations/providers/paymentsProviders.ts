import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/**
 * v2 Checkpoint 22, Step 2 — Payments' own 2 built-in providers. `stripe`
 * reuses the Marketplace's (Checkpoint 18) exact connector id — the same
 * real-world service, never a second colliding id.
 *
 * v2 Checkpoint 23 — `stripe` is now BloomOS's first *real* provider: a
 * concrete `StripeProvider` (`core/integrations/providers/stripe/`) is
 * registered against this same id via `registerProviderFactory`, and
 * every "Connect"/"Test Connection" action in the Configuration Center
 * makes a genuine Stripe API call. The connection method is a
 * workspace-pasted secret key (`provider_secret`-kind credential), not
 * OAuth — Stripe's own direct-API-key integration model, distinct from
 * Stripe Connect's OAuth flow, which this checkpoint doesn't implement —
 * so the `oauth` capability/metadata Checkpoint 22 declared is removed
 * rather than left as a dead, never-exercised code path.
 */
export function registerPaymentsProviders(): void {
  if (registered) return;

  registerProvider({
    id: "stripe",
    name: "Stripe",
    category: "payments",
    icon: "CreditCard",
    version: 1,
    capabilities: ["payment", "webhook"],
    description: "The central payment engine for BloomOS — Customers, Products, Prices, Checkout Sessions, Payment Links, Invoices, and Refunds, reconciled in real time against a real Stripe account (sandbox or production).",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["finance.read"],
    subscribedWebhookEvents: ["invoice.paid", "receipt.created", "payment.succeeded", "payment.failed", "payment.refunded"],
  } satisfies ProviderDefinition);

  registerProvider({
    id: "paypal",
    name: "PayPal",
    category: "payments",
    icon: "Wallet",
    version: 1,
    capabilities: ["payment", "oauth"],
    description: "Accept PayPal as an Invoice payment method. Infrastructure only — no real PayPal account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["finance.read"],
    subscribedWebhookEvents: ["invoice.created", "invoice.paid"],
    oauth: {
      authorizationEndpoint: "https://www.paypal.com/connect",
      tokenEndpoint: "https://api-m.paypal.com/v1/oauth2/token",
      defaultScopes: ["openid"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registered = true;
}
