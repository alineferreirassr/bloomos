import { generateId, nowIso } from "@/lib/data/utils";
import { getProvider } from "@/core/integrations/providerRegistry";
import { canTransition, listValidEventsFrom } from "@/core/integrations/connectionStateMachine";
import { recordConnectionAuditEvent } from "@/core/integrations/auditCenter";
import { revokeCredential, getCredential } from "@/core/integrations/credentialManager";
import { computeHealthSnapshot } from "@/core/integrations/healthMonitor";
import {
  deleteConnection,
  generateConnectionId,
  getConnectionById,
  insertConnection,
  insertTransition,
  listConnectionsForWorkspace,
  listTransitionsForConnection,
  updateConnection,
} from "@/lib/data/core/integrations/connectionStore";
import type { ConnectionEvent, ConnectionStateTransition, IntegrationConnection, IntegrationHealthSnapshot } from "@/core/integrations/types";

/**
 * The Integration Manager (v2 Checkpoint 22, Step 1) — the one
 * orchestration layer every other engine in this checkpoint gets called
 * through, never a call site reaching into `connectionStore.ts` or the
 * Connection State Machine directly. It ties together:
 *
 * - the Provider Registry (validates `providerId` exists before an
 *   install can happen at all)
 * - the Connection State Machine (`canTransition` gates every state
 *   change — an illegal transition throws here rather than silently
 *   corrupting a connection's own `state`)
 * - the Audit Center (every install/uninstall/transition is a real,
 *   append-only audit entry)
 * - the Health Monitor (`getConnectionHealth` is the one place a caller
 *   asks "is this connection okay right now")
 * - the Credentials Manager (`uninstallConnection` revokes the
 *   connection's own credential, the same "never leave an orphaned,
 *   still-valid credential behind" discipline `uninstallConnector`
 *   already established for Marketplace)
 */

export interface InstallProviderParams {
  workspaceId: string;
  providerId: string;
  installedBy: string;
  config?: Record<string, string | number | boolean>;
}

export async function installProvider(params: InstallProviderParams): Promise<IntegrationConnection> {
  const provider = getProvider(params.providerId);
  if (!provider) throw new Error(`No provider is registered for "${params.providerId}".`);

  const now = nowIso();
  const connection: IntegrationConnection = {
    id: generateConnectionId(),
    workspace_id: params.workspaceId,
    provider_id: params.providerId,
    state: "disconnected",
    config: params.config ?? {},
    credential_id: null,
    capabilities: provider.capabilities,
    version: provider.version,
    installed_by: params.installedBy,
    created_at: now,
    updated_at: now,
    last_state_change_at: now,
    last_health_check_at: null,
    last_sync_at: null,
    failure_count: 0,
    retry_count: 0,
  };

  insertConnection(connection);
  await recordConnectionAuditEvent(params.workspaceId, params.installedBy, "connection.installed", connection.id, null, { provider_id: params.providerId, state: connection.state });
  return connection;
}

export interface ApplyConnectionEventResult {
  connection: IntegrationConnection;
  transition: ConnectionStateTransition;
}

const FAILURE_EVENTS: ConnectionEvent[] = ["connect_failed", "refresh_failed", "health_check_failed"];
const RECOVERY_EVENTS: ConnectionEvent[] = ["connect_succeeded", "refresh_succeeded"];

/** The one door every state change goes through — an event the state machine rejects from the connection's current state throws, rather than the caller silently overwriting `state` by hand. */
export async function applyConnectionEvent(connectionId: string, event: ConnectionEvent, actor: string, note: string | null = null): Promise<ApplyConnectionEventResult> {
  const connection = getConnectionById(connectionId);
  if (!connection) throw new Error(`No connection found for id "${connectionId}".`);

  const result = canTransition(connection.state, event);
  if (!result.allowed || !result.nextState) throw new Error(result.reason ?? `Event "${event}" is not valid from state "${connection.state}".`);

  const now = nowIso();
  const patch: Partial<IntegrationConnection> = { state: result.nextState, last_state_change_at: now };
  if (FAILURE_EVENTS.includes(event)) patch.failure_count = connection.failure_count + 1;
  if (RECOVERY_EVENTS.includes(event)) patch.failure_count = 0;
  if (event === "health_check_failed" || event === "health_check_unknown") patch.last_health_check_at = now;

  const updated = updateConnection(connectionId, patch);
  if (!updated) throw new Error(`Connection "${connectionId}" was removed mid-transition.`);

  const transition: ConnectionStateTransition = {
    id: generateId("connection-transition"),
    connection_id: connectionId,
    from_state: connection.state,
    to_state: result.nextState,
    event,
    occurred_at: now,
    note,
  };
  insertTransition(transition);
  await recordConnectionAuditEvent(connection.workspace_id, actor, `connection.${event}`, connectionId, { state: connection.state }, { state: result.nextState });

  return { connection: updated, transition };
}

/** Revokes the connection's own credential (if any) and removes the installation — never leaves an orphaned, still-valid credential behind, the same discipline `uninstallConnector` (Checkpoint 18) already established. */
export async function uninstallConnection(connectionId: string, actor: string): Promise<boolean> {
  const connection = getConnectionById(connectionId);
  if (!connection) return false;
  if (connection.credential_id) revokeCredential(connection.credential_id);
  const removed = deleteConnection(connectionId);
  if (removed) await recordConnectionAuditEvent(connection.workspace_id, actor, "connection.uninstalled", connectionId, { state: connection.state }, null);
  return removed;
}

export function attachCredential(connectionId: string, credentialId: string): IntegrationConnection | null {
  return updateConnection(connectionId, { credential_id: credentialId });
}

/** Merges into a connection's own free-form `config` — e.g. Stripe's `mode` (`sandbox`/`production`), the exact "declared by the provider's own configSchema-equivalent" slot Checkpoint 22 designed for connection-level settings that aren't a credential. */
export function setConnectionConfig(connectionId: string, config: Record<string, string | number | boolean>): IntegrationConnection | null {
  const existing = getConnectionById(connectionId);
  if (!existing) return null;
  return updateConnection(connectionId, { config: { ...existing.config, ...config } });
}

export function getConnection(connectionId: string): IntegrationConnection | null {
  return getConnectionById(connectionId);
}

export function listConnections(workspaceId: string): IntegrationConnection[] {
  return listConnectionsForWorkspace(workspaceId);
}

export function getConnectionHistory(connectionId: string): ConnectionStateTransition[] {
  return listTransitionsForConnection(connectionId);
}

export function listAvailableActions(connectionId: string): ConnectionEvent[] {
  const connection = getConnectionById(connectionId);
  if (!connection) return [];
  return listValidEventsFrom(connection.state);
}

export function getConnectionHealth(connectionId: string): IntegrationHealthSnapshot | null {
  const connection = getConnectionById(connectionId);
  if (!connection) return null;
  const credential = connection.credential_id ? getCredential(connection.credential_id) : null;
  return computeHealthSnapshot(connection, credential);
}
