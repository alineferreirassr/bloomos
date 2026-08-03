import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Communication's own 2 built-in connectors. */
export function registerCommunicationConnectors(): void {
  if (registered) return;

  registerConnector({
    id: "slack",
    name: "Slack",
    category: "communication",
    icon: "Hash",
    version: 1,
    status: "available",
    description: "Post a channel message whenever a Proposal is accepted, an Invoice is paid, or a Workflow publishes — a placeholder connector; no real Slack workspace is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["analytics.read"],
    subscribedWebhookEvents: ["proposal.accepted", "invoice.paid", "workflow.published"],
    configSchema: [
      { key: "webhookUrl", label: "Incoming webhook URL", type: "url", required: true },
      { key: "channel", label: "Channel", type: "text", required: false, placeholder: "#sales" },
    ],
  } satisfies ConnectorDefinition);

  registerConnector({
    id: "discord",
    name: "Discord",
    category: "communication",
    icon: "MessageCircle",
    version: 1,
    status: "available",
    description: "Post to a server channel whenever a Workflow publishes or a simulation completes — a placeholder connector; no real Discord server is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["workflow.read"],
    subscribedWebhookEvents: ["workflow.published", "workflow.simulated"],
    configSchema: [
      { key: "webhookUrl", label: "Channel webhook URL", type: "url", required: true },
      { key: "channel", label: "Channel name", type: "text", required: false, placeholder: "#ops" },
    ],
  } satisfies ConnectorDefinition);

  registered = true;
}
