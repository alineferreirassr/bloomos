"use server";

import { listConnectors } from "@/core/marketplace/connectorRegistry";
import { refreshConnectorHealth } from "@/core/marketplace/connectionManager";
import { summarizeApiUsage, type ApiUsageSummary } from "@/lib/data/core/api/apiUsageStore";
import { summarizeWebhookDeliveries } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { listConnectorInstallationsForWorkspace } from "@/lib/data/core/marketplace/connectorInstallationStore";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinConnectors } from "@/modules/marketplace/registerBuiltinConnectors";
import type { ConnectorDefinition } from "@/types/connector";
import type { ConnectorHealthStatus, ConnectorInstallation } from "@/types/connectorInstallation";
import type { WebhookDeliverySummary } from "@/types/webhookDelivery";

const GENERIC_ACCESS_ERROR = "The Marketplace isn't available. You may not have access to it.";

registerBuiltinConnectors();

export interface MarketplaceObservabilitySummary {
  installationCount: number;
  failureCount: number;
  byHealth: Record<ConnectorHealthStatus, number>;
  totalReconnects: number;
  webhookUsage: WebhookDeliverySummary;
  apiUsage: ApiUsageSummary;
}

export interface MarketplaceData {
  catalog: ConnectorDefinition[];
  installations: ConnectorInstallation[];
  observability: MarketplaceObservabilitySummary;
}

export type GetMarketplaceDataResult = { success: true; data: MarketplaceData } | { success: false; error: string };

function summarizeObservability(workspaceId: string, installations: ConnectorInstallation[]): MarketplaceObservabilitySummary {
  const byHealth: Record<ConnectorHealthStatus, number> = { connected: 0, disconnected: 0, pending: 0, error: 0, rate_limited: 0 };
  let totalReconnects = 0;
  for (const installation of installations) {
    byHealth[installation.health_status] += 1;
    totalReconnects += installation.reconnect_count;
  }

  return {
    installationCount: installations.length,
    failureCount: byHealth.error + byHealth.rate_limited,
    byHealth,
    totalReconnects,
    webhookUsage: summarizeWebhookDeliveries(workspaceId),
    apiUsage: summarizeApiUsage(workspaceId),
  };
}

/**
 * Checkpoint 18, Step 8 — the one aggregate the Marketplace UI reads
 * from, mirroring `getWebhooksConsoleData.ts`'s own "one aggregate,
 * computed fresh" shape. Every installation's health is re-derived from
 * real signals (`refreshConnectorHealth`) on each load — Observability
 * composes Checkpoint 16's `summarizeApiUsage` and Checkpoint 17's
 * `summarizeWebhookDeliveries` directly rather than reinventing either.
 */
export async function getMarketplaceData(): Promise<GetMarketplaceDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const rawInstallations = listConnectorInstallationsForWorkspace(session.workspace.id);
  const installations = rawInstallations.map((installation) => refreshConnectorHealth(installation.id) ?? installation);

  return {
    success: true,
    data: {
      catalog: listConnectors(),
      installations,
      observability: summarizeObservability(session.workspace.id, installations),
    },
  };
}
