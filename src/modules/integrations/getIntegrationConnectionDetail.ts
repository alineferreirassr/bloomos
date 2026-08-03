"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { getProvider } from "@/core/integrations/providerRegistry";
import { listConnections, getConnectionHealth, getConnectionHistory } from "@/core/integrations/integrationManager";
import { listMappingsForConnection } from "@/lib/data/core/integrations/mappingStore";
import { listErrorRecordsForConnection } from "@/lib/data/core/integrations/errorRecordStore";
import { listSyncRunsForConnection } from "@/core/integrations/syncEngine";
import type { ConnectionStateTransition, IntegrationConnection, IntegrationErrorRecord, IntegrationHealthSnapshot, IntegrationMapping, ProviderDefinition } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "That integration isn't available. You may not have access to it.";

registerBuiltinProviders();

export interface IntegrationConnectionDetailRow {
  connection: IntegrationConnection;
  health: IntegrationHealthSnapshot | null;
  history: ConnectionStateTransition[];
  mappings: IntegrationMapping[];
  recentErrors: IntegrationErrorRecord[];
  syncRunCount: number;
}

export interface IntegrationConnectionDetailData {
  provider: ProviderDefinition | null;
  connections: IntegrationConnectionDetailRow[];
}

export type GetIntegrationConnectionDetailResult = { success: true; data: IntegrationConnectionDetailData } | { success: false; error: string };

/**
 * v2 Checkpoint 43 — the `/integrations/[provider]` detail read, the one
 * genuinely new Connection Center route this checkpoint's scope
 * validation kept (see docs/v2-checkpoint-43.md's classification table;
 * the other 5 named routes were reclassified "out of scope" /
 * "already covered" against Checkpoint 22's existing `/integrations` +
 * `/developer` surfaces). A provider can have more than one connection
 * per workspace (nothing in `installProvider` enforces uniqueness), so
 * this returns every connection for the given provider rather than
 * assuming a singleton.
 */
export async function getIntegrationConnectionDetail(providerId: string): Promise<GetIntegrationConnectionDetailResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.view") && !session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const provider = getProvider(providerId) ?? null;
  const connections = listConnections(session.workspace.id).filter((connection) => connection.provider_id === providerId);

  const rows: IntegrationConnectionDetailRow[] = connections.map((connection) => ({
    connection,
    health: getConnectionHealth(connection.id),
    history: getConnectionHistory(connection.id).slice(0, 10),
    mappings: listMappingsForConnection(connection.id).slice(0, 20),
    recentErrors: listErrorRecordsForConnection(connection.id).slice(0, 10),
    syncRunCount: listSyncRunsForConnection(connection.id).length,
  }));

  return { success: true, data: { provider, connections: rows } };
}
