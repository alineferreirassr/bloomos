/**
 * Checkpoint 18, Step 6 — Connection Health's own closed set. `pending`
 * is the brief moment between "Install clicked" and the mock handshake
 * resolving; every built-in connector resolves to `connected` almost
 * immediately (no real OAuth to actually wait on — Non-Goal). `error`/
 * `rate_limited` are real, reachable states — see
 * `core/marketplace/connectionManager.ts`'s own doc comment for exactly
 * what can still drive a real installation into either without a real
 * provider on the other end.
 */
export const CONNECTOR_HEALTH_STATUSES = ["connected", "disconnected", "pending", "error", "rate_limited"] as const;
export type ConnectorHealthStatus = (typeof CONNECTOR_HEALTH_STATUSES)[number];

export type ConnectorConfigValue = string | boolean;

/**
 * Checkpoint 18, Step 3 — a Workspace's own installed connector. `enabled`
 * is a real, independent on/off switch — Disable never uninstalls
 * (`ConnectorInstallation` itself is never deleted by Disable, only by
 * Uninstall), the same "distinct, non-destructive states" precedent
 * Checkpoint 16's `ApiKey.revoked_at` and Checkpoint 17's
 * `WebhookEndpoint.status` both already established for their own
 * on/off switches.
 */
export interface ConnectorInstallation {
  id: string;
  workspace_id: string;
  connector_id: string;
  enabled: boolean;
  health_status: ConnectorHealthStatus;
  config: Record<string, ConnectorConfigValue>;
  /** The real `ApiKey.id` (Checkpoint 16) provisioned at install time, scoped to exactly this connector's own `requiredApiScopes` — `null` only if that provisioning itself failed. Never a second, parallel credential concept. */
  api_key_id: string | null;
  last_sync_at: string | null;
  installed_by: string;
  installed_at: string;
  updated_at: string;
  reconnect_count: number;
}

export interface InstallConnectorInput {
  connector_id: string;
  config: Record<string, ConnectorConfigValue>;
}
