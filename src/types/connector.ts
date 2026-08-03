import type { Permission } from "@/core/enums/permission";
import type { ApiScope } from "@/types/apiScope";
import type { WebhookEventType } from "@/types/webhookEvent";

/**
 * Checkpoint 18, Step 1 — the Marketplace's own closed connector catalog.
 * A `ConnectorDefinition` never reaches into internal BloomOS services
 * itself — it only *declares* what it would need: `requiredApiScopes`
 * (Checkpoint 16's own `ApiScope` union) and `subscribedWebhookEvents`
 * (Checkpoint 17's own `WebhookEventType` union). Installing a connector
 * (`core/marketplace/connectionManager.ts`) provisions a real API Key
 * scoped to exactly those scopes — the literal enforcement of this
 * checkpoint's own "must consume only the Public API and Webhooks, never
 * bypass the Public API, never access internal services directly."
 */
export const CONNECTOR_CATEGORIES = ["calendar", "storage", "email", "communication", "payments", "automation", "productivity", "crm"] as const;
export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];

export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  calendar: "Calendar",
  storage: "Storage",
  email: "Email",
  communication: "Communication",
  payments: "Payments",
  automation: "Automation",
  productivity: "Productivity",
  crm: "CRM",
};

/** `deprecated` exists for the same "future deprecation" reason `WebhookEventDeprecation` does — a declared closed state, not yet reachable by any built-in connector. */
export const CONNECTOR_STATUSES = ["available", "coming_soon", "deprecated"] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const CONNECTOR_CONFIG_FIELD_TYPES = ["text", "url", "select", "boolean"] as const;
export type ConnectorConfigFieldType = (typeof CONNECTOR_CONFIG_FIELD_TYPES)[number];

export interface ConnectorConfigFieldOption {
  value: string;
  label: string;
}

/** One field in a connector's own configuration schema (Step 1's own "configuration schema") — rendered generically by the Marketplace UI's Configuration form, the same "one generic renderer over a declared schema" discipline `SettingField.tsx` (Checkpoint 11) already established for Workspace Settings. */
export interface ConnectorConfigField {
  key: string;
  label: string;
  type: ConnectorConfigFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: ConnectorConfigFieldOption[];
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  category: ConnectorCategory;
  /** A plain string name resolved by `modules/marketplace/components/connectorIcons.ts`, never a component reference — the same "registry stays importable server-side" discipline `MetricDefinition.icon` (Checkpoint 15) already established. */
  icon: string;
  version: number;
  status: ConnectorStatus;
  description: string;
  /** The internal permission gate to install/manage this connector — every built-in connector uses `workspace.manage` (Step 9's own "Developer/Admin only"), but the field stays generic so a future connector could declare a different one. */
  requiredPermission: Permission;
  configSchema: ConnectorConfigField[];
  requiredApiScopes: ApiScope[];
  subscribedWebhookEvents: WebhookEventType[];
}
