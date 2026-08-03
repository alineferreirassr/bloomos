import { generateId, nowIso } from "@/lib/data/utils";
import type { ConnectorHealthStatus, ConnectorInstallation } from "@/types/connectorInstallation";

/**
 * Checkpoint 18 — the Marketplace's own installation store. Mock-only,
 * unconditionally, the same "new checkpoint domain, mock-only this phase"
 * precedent every domain since Checkpoint 13 has followed.
 *
 * A plain `let` (not `getGlobalMockStore`) — nothing in this checkpoint
 * reads or writes installations from a Route Handler; every access is
 * from a Server Action or the Marketplace UI's own server-rendered data
 * loader, the same single-module-graph shape `webhookEndpointStore.ts`
 * (Checkpoint 17) already established for the identical reason.
 */
let installations: ConnectorInstallation[] = [];

export function resetConnectorInstallationStore(): void {
  installations = [];
}

export function createConnectorInstallation(input: {
  workspaceId: string;
  connectorId: string;
  config: Record<string, string | boolean>;
  apiKeyId: string | null;
  installedBy: string;
  healthStatus: ConnectorHealthStatus;
}): ConnectorInstallation {
  const now = nowIso();
  const installation: ConnectorInstallation = {
    id: generateId("connector-install"),
    workspace_id: input.workspaceId,
    connector_id: input.connectorId,
    enabled: true,
    health_status: input.healthStatus,
    config: input.config,
    api_key_id: input.apiKeyId,
    last_sync_at: null,
    installed_by: input.installedBy,
    installed_at: now,
    updated_at: now,
    reconnect_count: 0,
  };
  installations = [...installations, installation];
  return installation;
}

export function listConnectorInstallationsForWorkspace(workspaceId: string): ConnectorInstallation[] {
  return installations
    .filter((installation) => installation.workspace_id === workspaceId)
    .sort((a, b) => b.installed_at.localeCompare(a.installed_at));
}

export function getConnectorInstallationById(id: string): ConnectorInstallation | null {
  return installations.find((installation) => installation.id === id) ?? null;
}

export function getConnectorInstallationByConnectorId(workspaceId: string, connectorId: string): ConnectorInstallation | null {
  return installations.find((installation) => installation.workspace_id === workspaceId && installation.connector_id === connectorId) ?? null;
}

export function updateConnectorInstallation(id: string, patch: Partial<Omit<ConnectorInstallation, "id" | "workspace_id" | "connector_id" | "installed_at" | "installed_by">>): ConnectorInstallation | null {
  const existing = getConnectorInstallationById(id);
  if (!existing) return null;
  const updated: ConnectorInstallation = { ...existing, ...patch, updated_at: nowIso() };
  installations = installations.map((installation) => (installation.id === id ? updated : installation));
  return updated;
}

export function deleteConnectorInstallation(id: string): boolean {
  const before = installations.length;
  installations = installations.filter((installation) => installation.id !== id);
  return installations.length < before;
}
