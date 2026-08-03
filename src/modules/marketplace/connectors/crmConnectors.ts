import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — CRM's own 1 built-in connector. */
export function registerCrmConnectors(): void {
  if (registered) return;
  registerConnector({
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    icon: "Building2",
    version: 1,
    status: "available",
    description: "Keep HubSpot Contacts in sync with BloomOS Clients — a placeholder connector; no real HubSpot account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read", "finance.read"],
    subscribedWebhookEvents: ["client.created", "client.updated", "proposal.accepted"],
    configSchema: [
      { key: "portalId", label: "HubSpot portal ID", type: "text", required: true },
      { key: "syncContacts", label: "Sync Contacts automatically", type: "boolean", required: false },
    ],
  } satisfies ConnectorDefinition);
  registered = true;
}
