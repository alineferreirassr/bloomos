import { getConnector } from "@/core/marketplace/connectorRegistry";
import { getLogger } from "@/core/observability/logger";
import { createApiKey, getApiKeyById, revokeApiKey } from "@/lib/data/core/api/apiKeyStore";
import { listApiRequestLogsForWorkspace } from "@/lib/data/core/api/apiUsageStore";
import {
  createConnectorInstallation,
  deleteConnectorInstallation,
  getConnectorInstallationById,
  updateConnectorInstallation,
} from "@/lib/data/core/marketplace/connectorInstallationStore";
import { nowIso } from "@/lib/data/utils";
import type { ConnectorConfigValue, ConnectorHealthStatus, ConnectorInstallation } from "@/types/connectorInstallation";

/** Requests against this installation's own provisioned API Key, within this window, before health is reported `rate_limited` — a real, computed signal, not an arbitrary flag flip. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUEST_THRESHOLD = 50;

export class UnknownConnectorError extends Error {
  constructor(connectorId: string) {
    super(`Unknown connector: ${connectorId}`);
    this.name = "UnknownConnectorError";
  }
}

export class ConnectorConfigValidationError extends Error {
  constructor(public readonly missingKeys: string[]) {
    super(`Missing required configuration: ${missingKeys.join(", ")}`);
    this.name = "ConnectorConfigValidationError";
  }
}

export class ConnectorAlreadyInstalledError extends Error {
  constructor(connectorId: string) {
    super(`Connector already installed: ${connectorId}`);
    this.name = "ConnectorAlreadyInstalledError";
  }
}

/** Step 3's own "Configuration validation" — every `required` field in the connector's declared `configSchema` must be present with a non-empty value. Never more than that: BloomOS never actually calls out to the provider, so there's nothing further to validate. */
function validateConnectorConfig(connectorId: string, configSchema: { key: string; required: boolean }[], config: Record<string, ConnectorConfigValue>): void {
  const missingKeys = configSchema
    .filter((field) => field.required)
    .map((field) => field.key)
    .filter((key) => config[key] === undefined || config[key] === "");
  if (missingKeys.length > 0) throw new ConnectorConfigValidationError(missingKeys);
  void connectorId;
}

/**
 * Checkpoint 18, Step 3/6 — the Connection Manager. Every lifecycle
 * transition here is the literal enforcement of this checkpoint's own
 * "must consume only the Public API and Webhooks, never bypass the
 * Public API, never access internal services directly": installing a
 * connector provisions a real Checkpoint 16 API Key scoped to exactly the
 * connector's own declared `requiredApiScopes` — the connector's only
 * credential, and the only door it has into BloomOS data. There is no
 * second, parallel internal-access path.
 *
 * `subscribedWebhookEvents` stays descriptive metadata only — installing a
 * connector deliberately does NOT auto-create a live Checkpoint 17
 * Webhook Endpoint, since a mock connector has no real subscriber URL to
 * deliver to, and a fake one would only generate noisy failed deliveries
 * in the Developer Console's Deliveries tab. A member who wants live
 * delivery can create a matching Webhook Endpoint by hand. See
 * docs/marketplace.md's Known Limitations.
 */
export async function installConnector(params: {
  workspaceId: string;
  installedBy: string;
  connectorId: string;
  config: Record<string, ConnectorConfigValue>;
  existingInstallation?: ConnectorInstallation | null;
}): Promise<ConnectorInstallation> {
  const definition = getConnector(params.connectorId);
  if (!definition) throw new UnknownConnectorError(params.connectorId);
  if (params.existingInstallation) throw new ConnectorAlreadyInstalledError(params.connectorId);

  validateConnectorConfig(params.connectorId, definition.configSchema, params.config);

  const { key } = await createApiKey(params.workspaceId, params.installedBy, {
    name: `${definition.name} (Marketplace)`,
    scopes: definition.requiredApiScopes,
  });

  const installation = createConnectorInstallation({
    workspaceId: params.workspaceId,
    connectorId: params.connectorId,
    config: params.config,
    apiKeyId: key.id,
    installedBy: params.installedBy,
    // No real OAuth handshake to actually wait on (Non-Goal) — every built-in connector resolves to `connected` immediately.
    healthStatus: "connected",
  });

  getLogger().info("Connector installed", { workspaceId: params.workspaceId, connectorId: params.connectorId, installationId: installation.id });
  return installation;
}

export function enableConnector(installationId: string): ConnectorInstallation | null {
  const reEnabled = updateConnectorInstallation(installationId, { enabled: true });
  if (!reEnabled) return null;
  const health = checkConnectorHealth(reEnabled);
  if (health === reEnabled.health_status) return reEnabled;
  return updateConnectorInstallation(installationId, { health_status: health });
}

export function disableConnector(installationId: string): ConnectorInstallation | null {
  return updateConnectorInstallation(installationId, { enabled: false, health_status: "disconnected" });
}

/** Uninstall revokes the connector's own provisioned API Key (its only credential) and removes the installation record — never leaves an orphaned, still-valid key behind. */
export function uninstallConnector(installationId: string): boolean {
  const existing = getConnectorInstallationById(installationId);
  if (!existing) return false;
  if (existing.api_key_id) revokeApiKey(existing.api_key_id);
  const removed = deleteConnectorInstallation(installationId);
  if (removed) getLogger().info("Connector uninstalled", { installationId, connectorId: existing.connector_id });
  return removed;
}

/** A manual "Reconnect" always resolves to `connected` and bumps `reconnect_count` — the same "member takes an explicit corrective action" shape a real OAuth re-auth flow would have, without actually performing one (Non-Goal: real OAuth). */
export function reconnectConnector(installationId: string): ConnectorInstallation | null {
  const existing = getConnectorInstallationById(installationId);
  if (!existing) return null;
  return updateConnectorInstallation(installationId, {
    enabled: true,
    health_status: "connected",
    reconnect_count: existing.reconnect_count + 1,
    last_sync_at: nowIso(),
  });
}

/**
 * Step 6's own "Connection Health" — derived from real signals rather
 * than an arbitrary simulated flag, mirroring this session's own
 * "structurally real, policy deferred" precedent:
 *
 * - `disconnected` when the member has explicitly disabled the connector.
 * - `error` when the installation's own provisioned API Key has been
 *   revoked out from under it (e.g. from the Developer Console's API
 *   Keys tab) — a genuine, checkable loss of credential, not invented.
 * - `rate_limited` when that same API Key's real request volume
 *   (`apiUsageStore`, Checkpoint 16) exceeds a threshold within the last
 *   minute — real traffic, real math; simply unreachable in this
 *   checkpoint's demo since nothing yet drives automated calls through a
 *   connector's key (documented as a known limitation).
 * - `connected` otherwise.
 */
export function checkConnectorHealth(installation: ConnectorInstallation): ConnectorHealthStatus {
  if (!installation.enabled) return "disconnected";
  if (!installation.api_key_id) return "error";

  const apiKey = getApiKeyById(installation.api_key_id);
  if (!apiKey || apiKey.revoked_at !== null) return "error";

  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const recentRequestCount = listApiRequestLogsForWorkspace(installation.workspace_id)
    .filter((entry) => entry.api_key_id === installation.api_key_id)
    .filter((entry) => new Date(entry.occurred_at).getTime() >= windowStart).length;
  if (recentRequestCount >= RATE_LIMIT_REQUEST_THRESHOLD) return "rate_limited";

  return "connected";
}

/** Re-derives and persists an installation's health from `checkConnectorHealth` — called on demand (Marketplace UI load, a Server Action) rather than on a background timer (Non-Goal: real background workers). */
export function refreshConnectorHealth(installationId: string): ConnectorInstallation | null {
  const existing = getConnectorInstallationById(installationId);
  if (!existing) return null;
  const health = checkConnectorHealth(existing);
  if (health === existing.health_status) return existing;
  return updateConnectorInstallation(installationId, { health_status: health });
}
