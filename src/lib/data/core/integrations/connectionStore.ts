import { generateId, nowIso } from "@/lib/data/utils";
import type { ConnectionStateTransition, IntegrationConnection } from "@/core/integrations/types";

/**
 * v2 Checkpoint 22 — the Integration Connection store. Mock-only,
 * unconditionally, same precedent as `webhookEndpointStore.ts`/
 * `credentialStore.ts`. Holds both `IntegrationConnection` records and
 * their own `ConnectionStateTransition` history in one file — the two
 * are never queried independently of one another (a transition log with
 * no connection to belong to is meaningless), unlike e.g. Credentials,
 * which genuinely stand alone.
 */
let connections: IntegrationConnection[] = [];
let transitions: ConnectionStateTransition[] = [];

export function resetConnectionStore(): void {
  connections = [];
  transitions = [];
}

export function generateConnectionId(): string {
  return generateId("integration-connection");
}

export function insertConnection(connection: IntegrationConnection): IntegrationConnection {
  connections = [...connections, connection];
  return connection;
}

export function getConnectionById(id: string): IntegrationConnection | null {
  return connections.find((connection) => connection.id === id) ?? null;
}

export function listConnectionsForWorkspace(workspaceId: string): IntegrationConnection[] {
  return connections.filter((connection) => connection.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function updateConnection(id: string, patch: Partial<IntegrationConnection>): IntegrationConnection | null {
  const existing = getConnectionById(id);
  if (!existing) return null;
  const updated: IntegrationConnection = { ...existing, ...patch, updated_at: nowIso() };
  connections = connections.map((connection) => (connection.id === id ? updated : connection));
  return updated;
}

export function deleteConnection(id: string): boolean {
  const existed = connections.some((connection) => connection.id === id);
  connections = connections.filter((connection) => connection.id !== id);
  return existed;
}

export function insertTransition(transition: ConnectionStateTransition): ConnectionStateTransition {
  transitions = [...transitions, transition];
  return transition;
}

export function listTransitionsForConnection(connectionId: string): ConnectionStateTransition[] {
  return transitions.filter((transition) => transition.connection_id === connectionId).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
