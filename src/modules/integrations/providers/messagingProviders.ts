import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/**
 * v2 Checkpoint 43 — the `messaging` `ProviderCategory` (declared since
 * Checkpoint 22) had zero registered providers until now. Twilio is
 * neither an id the Marketplace (Checkpoint 18) nor the Provider Registry
 * (Checkpoint 22) ever registered — genuinely new, no collision risk.
 * Twilio authenticates with an Account SID + Auth Token, not OAuth (no
 * `oauth` metadata block, same shape Stripe's `provider_secret` credential
 * kind already supports).
 */
export function registerMessagingProviders(): void {
  if (registered) return;

  registerProvider({
    id: "twilio",
    name: "Twilio",
    category: "messaging",
    icon: "MessageSquare",
    version: 1,
    capabilities: ["communication", "webhook"],
    // v2 Checkpoint 43 — a real TwilioProvider (core/integrations/providers/twilio/) implements
    // CommunicationProvider.sendSms + WebhookProvider against Twilio's real REST API. No Account
    // SID/Auth Token is configured in this environment, so the connection remains unverified.
    description: "Send SMS reminders and operational alerts through Twilio. Real adapter implemented; connection unverified — no Account SID/Auth Token is configured in this environment.",
    requiredPermission: "integrations.messaging",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: [],
  } satisfies ProviderDefinition);

  registered = true;
}
