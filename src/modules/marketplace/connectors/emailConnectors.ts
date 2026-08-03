import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Email's own 2 built-in connectors. */
export function registerEmailConnectors(): void {
  if (registered) return;

  registerConnector({
    id: "gmail",
    name: "Gmail",
    category: "email",
    icon: "Mail",
    version: 1,
    status: "available",
    description: "Send Proposals and Invoices from a connected Gmail address — a placeholder connector; no real Google account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: ["proposal.accepted", "invoice.created"],
    configSchema: [
      { key: "fromAddress", label: "Send-as address", type: "text", required: true, placeholder: "you@company.com" },
      { key: "signature", label: "Email signature", type: "text", required: false },
    ],
  } satisfies ConnectorDefinition);

  registerConnector({
    id: "outlook",
    name: "Outlook",
    category: "email",
    icon: "Inbox",
    version: 1,
    status: "available",
    description: "Send client email and keep an Outlook calendar in sync with booked Events — a placeholder connector; no real Microsoft account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read", "portal.read"],
    subscribedWebhookEvents: ["event.created", "invoice.paid"],
    configSchema: [
      { key: "mailbox", label: "Mailbox address", type: "text", required: true, placeholder: "you@company.com" },
      { key: "calendarSync", label: "Sync Events to Outlook calendar", type: "boolean", required: false },
    ],
  } satisfies ConnectorDefinition);

  registered = true;
}
