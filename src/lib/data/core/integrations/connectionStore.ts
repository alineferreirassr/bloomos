import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseConnectionStore from "@/lib/data/core/integrations/supabaseConnectionStore";
import type { ConnectionStateTransition, IntegrationConnection } from "@/core/integrations/types";

/**
 * The Integration Connection store. Mock implementation kept exactly as
 * it has been since v2 Checkpoint 22 — GMAIL-02 adds a real Supabase-
 * backed sibling (`supabaseConnectionStore.ts`) and routes every function
 * below through `selectRepository()`, the same convention
 * `credentialStore.ts` now uses. Mock mode's own behavior is unchanged.
 * Holds both `IntegrationConnection` records and their own
 * `ConnectionStateTransition` history — the two are never queried
 * independently of one another (a transition log with no connection to
 * belong to is meaningless), unlike Credentials, which genuinely stand
 * alone.
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

async function mockInsertConnection(connection: IntegrationConnection): Promise<IntegrationConnection> {
  connections = [...connections, connection];
  return connection;
}

async function mockGetConnectionById(id: string): Promise<IntegrationConnection | null> {
  return connections.find((connection) => connection.id === id) ?? null;
}

async function mockListConnectionsForWorkspace(workspaceId: string): Promise<IntegrationConnection[]> {
  return connections.filter((connection) => connection.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function mockUpdateConnection(id: string, patch: Partial<IntegrationConnection>): Promise<IntegrationConnection | null> {
  const existing = await mockGetConnectionById(id);
  if (!existing) return null;
  const updated: IntegrationConnection = { ...existing, ...patch, updated_at: nowIso() };
  connections = connections.map((connection) => (connection.id === id ? updated : connection));
  return updated;
}

async function mockDeleteConnection(id: string): Promise<boolean> {
  const existed = connections.some((connection) => connection.id === id);
  connections = connections.filter((connection) => connection.id !== id);
  return existed;
}

async function mockInsertTransition(transition: ConnectionStateTransition): Promise<ConnectionStateTransition> {
  transitions = [...transitions, transition];
  return transition;
}

async function mockListTransitionsForConnection(connectionId: string): Promise<ConnectionStateTransition[]> {
  return transitions.filter((transition) => transition.connection_id === connectionId).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export function insertConnection(connection: IntegrationConnection): Promise<IntegrationConnection> {
  return selectRepository({ mock: mockInsertConnection, supabase: supabaseConnectionStore.insertConnection })(connection);
}

export function getConnectionById(id: string): Promise<IntegrationConnection | null> {
  return selectRepository({ mock: mockGetConnectionById, supabase: supabaseConnectionStore.getConnectionById })(id);
}

export function listConnectionsForWorkspace(workspaceId: string): Promise<IntegrationConnection[]> {
  return selectRepository({ mock: mockListConnectionsForWorkspace, supabase: supabaseConnectionStore.listConnectionsForWorkspace })(workspaceId);
}

export function updateConnection(id: string, patch: Partial<IntegrationConnection>): Promise<IntegrationConnection | null> {
  return selectRepository({ mock: mockUpdateConnection, supabase: supabaseConnectionStore.updateConnection })(id, patch);
}

export function deleteConnection(id: string): Promise<boolean> {
  return selectRepository({ mock: mockDeleteConnection, supabase: supabaseConnectionStore.deleteConnection })(id);
}

export function insertTransition(transition: ConnectionStateTransition): Promise<ConnectionStateTransition> {
  return selectRepository({ mock: mockInsertTransition, supabase: supabaseConnectionStore.insertTransition })(transition);
}

export function listTransitionsForConnection(connectionId: string): Promise<ConnectionStateTransition[]> {
  return selectRepository({ mock: mockListTransitionsForConnection, supabase: supabaseConnectionStore.listTransitionsForConnection })(connectionId);
}
