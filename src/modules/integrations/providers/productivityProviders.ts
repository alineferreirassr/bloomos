import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/** v2 Checkpoint 22, Step 2 — Productivity's own built-in provider. Reuses the Marketplace's (Checkpoint 18) exact `notion` connector id. */
export function registerProductivityProviders(): void {
  if (registered) return;

  registerProvider({
    id: "notion",
    name: "Notion",
    category: "productivity",
    icon: "FileText",
    version: 1,
    capabilities: ["oauth", "storage"],
    description: "Publish Proposal and Document copies into a connected Notion workspace. Infrastructure only — no real Notion workspace is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: ["document.published"],
    oauth: {
      authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
      tokenEndpoint: "https://api.notion.com/v1/oauth/token",
      defaultScopes: [],
      supportsPkce: false,
    },
  } satisfies ProviderDefinition);

  registered = true;
}
