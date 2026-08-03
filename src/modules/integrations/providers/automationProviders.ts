import { registerProvider } from "@/core/integrations/providerRegistry";
import type { ProviderDefinition } from "@/core/integrations/types";

let registered = false;

/** v2 Checkpoint 22, Step 2 — Automation's own 2 built-in providers. Reuse the Marketplace's (Checkpoint 18) exact `zapier`/`make` connector ids. */
export function registerAutomationProviders(): void {
  if (registered) return;

  registerProvider({
    id: "zapier",
    name: "Zapier",
    category: "automation",
    icon: "Zap",
    version: 1,
    capabilities: ["webhook"],
    description: "Trigger a Zapier automation from a BloomOS webhook event. Infrastructure only — no real Zapier account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: [],
    subscribedWebhookEvents: [],
  } satisfies ProviderDefinition);

  registerProvider({
    id: "make",
    name: "Make",
    category: "automation",
    icon: "Workflow",
    version: 1,
    capabilities: ["webhook"],
    description: "Trigger a Make scenario from a BloomOS webhook event. Infrastructure only — no real Make account is ever contacted by this platform.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: [],
    subscribedWebhookEvents: [],
  } satisfies ProviderDefinition);

  registered = true;
}
