import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Automation's own 2 built-in connectors. */
export function registerAutomationConnectors(): void {
  if (registered) return;

  registerConnector({
    id: "zapier",
    name: "Zapier",
    category: "automation",
    icon: "Zap",
    version: 1,
    status: "available",
    description: "Trigger a Zap whenever a Client is created, an Invoice is paid, or a Document is generated — a placeholder connector; no real Zapier account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read", "finance.read", "documents.read"],
    subscribedWebhookEvents: ["client.created", "invoice.paid", "document.generated"],
    configSchema: [
      { key: "zapierWebhookUrl", label: "Zapier catch hook URL", type: "url", required: true },
    ],
  } satisfies ConnectorDefinition);

  registerConnector({
    id: "make",
    name: "Make",
    category: "automation",
    icon: "Workflow",
    version: 1,
    status: "available",
    description: "Run a Make scenario whenever a Workflow publishes or an Executive Summary generates — a placeholder connector; no real Make account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["workflow.read", "analytics.read"],
    subscribedWebhookEvents: ["workflow.published", "executive.summary.generated"],
    configSchema: [
      { key: "makeWebhookUrl", label: "Make webhook URL", type: "url", required: true },
    ],
  } satisfies ConnectorDefinition);

  registered = true;
}
