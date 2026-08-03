import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Productivity's own 1 built-in connector. */
export function registerProductivityConnectors(): void {
  if (registered) return;
  registerConnector({
    id: "notion",
    name: "Notion",
    category: "productivity",
    icon: "FileText",
    version: 1,
    status: "available",
    description: "Mirror published Documents and Templates into a Notion database — a placeholder connector; no real Notion workspace is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: ["document.published", "template.published"],
    configSchema: [
      { key: "databaseId", label: "Notion database ID", type: "text", required: true },
      { key: "workspaceUrl", label: "Notion workspace URL", type: "url", required: false },
    ],
  } satisfies ConnectorDefinition);
  registered = true;
}
