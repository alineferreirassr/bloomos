import { registerConnector } from "@/core/marketplace/connectorRegistry";
import type { ConnectorDefinition } from "@/types/connector";

let registered = false;

/** Checkpoint 18, Step 4 — Calendar's own 1 built-in connector. */
export function registerCalendarConnectors(): void {
  if (registered) return;
  registerConnector({
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    icon: "Calendar",
    version: 1,
    status: "available",
    description: "Keep a Calendar in sync with newly booked Events — a placeholder connector; no real Google account is ever contacted.",
    requiredPermission: "workspace.manage",
    requiredApiScopes: ["crm.read"],
    subscribedWebhookEvents: ["event.created"],
    configSchema: [
      { key: "calendarId", label: "Calendar ID", type: "text", required: true, placeholder: "primary", helpText: "The Google Calendar to keep in sync." },
      { key: "syncDirection", label: "Sync direction", type: "select", required: true, options: [{ value: "one_way", label: "BloomOS → Calendar" }, { value: "two_way", label: "Two-way" }] },
    ],
  } satisfies ConnectorDefinition);
  registered = true;
}
