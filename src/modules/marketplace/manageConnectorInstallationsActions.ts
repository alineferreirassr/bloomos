"use server";

import { getConnector } from "@/core/marketplace/connectorRegistry";
import {
  ConnectorAlreadyInstalledError,
  ConnectorConfigValidationError,
  UnknownConnectorError,
  disableConnector,
  enableConnector,
  installConnector,
  reconnectConnector,
  uninstallConnector,
} from "@/core/marketplace/connectionManager";
import { getLogger } from "@/core/observability/logger";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getConnectorInstallationByConnectorId, getConnectorInstallationById } from "@/lib/data/core/marketplace/connectorInstallationStore";
import type { ConnectorConfigValue, ConnectorInstallation } from "@/types/connectorInstallation";

const GENERIC_ACCESS_ERROR = "The Marketplace isn't available. You may not have access to it.";

export type ManageConnectorInstallationsResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Checkpoint 18, Step 3/9 — every installation mutation funnels through
 * this one file, mirroring `manageWebhookEndpointsActions.ts`'s own shape
 * exactly: each action independently re-checks `workspace.manage` (Step
 * 9's own "Developer/Admin only"), returns the same
 * `{success,data}|{success,error}` envelope, and logs via `getLogger()`.
 */

async function requireWorkspaceManage(): Promise<{ success: true; workspaceId: string; memberId: string } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, workspaceId: session.workspace.id, memberId: session.membership.id };
}

async function requireOwnedInstallation(installationId: string): Promise<{ success: true; workspaceId: string } | { success: false; error: string }> {
  const gate = await requireWorkspaceManage();
  if (!gate.success) return gate;

  const existing = getConnectorInstallationById(installationId);
  if (!existing || existing.workspace_id !== gate.workspaceId) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, workspaceId: gate.workspaceId };
}

export async function installConnectorAction(connectorId: string, config: Record<string, ConnectorConfigValue>): Promise<ManageConnectorInstallationsResult<ConnectorInstallation>> {
  const gate = await requireWorkspaceManage();
  if (!gate.success) return gate;

  const definition = getConnector(connectorId);
  if (!definition) return { success: false, error: "Unknown connector." };
  if (definition.status !== "available") return { success: false, error: `${definition.name} isn't available to install yet.` };

  const existingInstallation = getConnectorInstallationByConnectorId(gate.workspaceId, connectorId);

  try {
    const installation = await installConnector({
      workspaceId: gate.workspaceId,
      installedBy: gate.memberId,
      connectorId,
      config,
      existingInstallation,
    });
    getLogger().info("Connector installed", { workspaceId: gate.workspaceId, connectorId, installationId: installation.id });
    return { success: true, data: installation };
  } catch (error) {
    if (error instanceof ConnectorConfigValidationError) return { success: false, error: `Fill in required fields: ${error.missingKeys.join(", ")}.` };
    if (error instanceof ConnectorAlreadyInstalledError) return { success: false, error: `${definition.name} is already installed.` };
    if (error instanceof UnknownConnectorError) return { success: false, error: "Unknown connector." };
    throw error;
  }
}

export async function enableConnectorAction(installationId: string): Promise<ManageConnectorInstallationsResult<ConnectorInstallation>> {
  const gate = await requireOwnedInstallation(installationId);
  if (!gate.success) return gate;

  const updated = enableConnector(installationId);
  if (!updated) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("Connector enabled", { workspaceId: gate.workspaceId, installationId });
  return { success: true, data: updated };
}

export async function disableConnectorAction(installationId: string): Promise<ManageConnectorInstallationsResult<ConnectorInstallation>> {
  const gate = await requireOwnedInstallation(installationId);
  if (!gate.success) return gate;

  const updated = disableConnector(installationId);
  if (!updated) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("Connector disabled", { workspaceId: gate.workspaceId, installationId });
  return { success: true, data: updated };
}

export async function reconnectConnectorAction(installationId: string): Promise<ManageConnectorInstallationsResult<ConnectorInstallation>> {
  const gate = await requireOwnedInstallation(installationId);
  if (!gate.success) return gate;

  const updated = reconnectConnector(installationId);
  if (!updated) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("Connector reconnected", { workspaceId: gate.workspaceId, installationId });
  return { success: true, data: updated };
}

export async function uninstallConnectorAction(installationId: string): Promise<ManageConnectorInstallationsResult<{ uninstalled: true }>> {
  const gate = await requireOwnedInstallation(installationId);
  if (!gate.success) return gate;

  const removed = uninstallConnector(installationId);
  if (!removed) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("Connector uninstalled", { workspaceId: gate.workspaceId, installationId });
  return { success: true, data: { uninstalled: true } };
}
