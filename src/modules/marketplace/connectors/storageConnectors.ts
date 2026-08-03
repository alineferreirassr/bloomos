import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Storage's own 1 built-in connector. */
export function registerStorageConnectors(): void {
  if (registered) return;
  registerConnector({
    id: "google-drive",
    name: "Google Drive",
    category: "storage",
    icon: "HardDrive",
    version: 1,
    status: "available",
    description: "Mirror generated and published Documents into a Drive folder — a placeholder connector; no real Google account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["documents.read"],
    subscribedWebhookEvents: ["document.generated", "document.published"],
    configSchema: [
      { key: "folderId", label: "Destination folder ID", type: "text", required: true, helpText: "The Drive folder new Documents are copied into." },
      { key: "autoUpload", label: "Upload automatically on publish", type: "boolean", required: false },
    ],
  } satisfies ConnectorDefinition);
  registered = true;
}
