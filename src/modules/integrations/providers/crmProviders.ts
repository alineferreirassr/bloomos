import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/** v2 Checkpoint 22, Step 2 — CRM's own built-in provider. Reuses the Marketplace's (Checkpoint 18) exact `hubspot` connector id. */
export function registerCrmProviders(): void {
  if (registered) return;

  registerProvider({
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    icon: "Building2",
    version: 1,
    capabilities: ["oauth", "webhook"],
    description: "Mirror Clients and Leads into an external HubSpot CRM. Infrastructure only — no real HubSpot account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: ["client.created", "client.updated"],
    oauth: {
      authorizationEndpoint: "https://app.hubspot.com/oauth/authorize",
      tokenEndpoint: "https://api.hubapi.com/oauth/v1/token",
      defaultScopes: ["crm.objects.contacts.read"],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registered = true;
}
