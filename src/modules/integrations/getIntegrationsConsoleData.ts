"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { listProviders } from "@/core/integrations/providerRegistry";
import { listConnections, getConnectionHealth, listAvailableActions } from "@/core/integrations/integrationManager";
import { getIntegrationAuditLog } from "@/core/integrations/auditCenter";
import { listJobsForWorkspace } from "@/core/integrations/queueEngine";
import { listSyncRunsForConnection, listConflictsForConnection } from "@/core/integrations/syncEngine";
import { listDeadLetterDeliveries } from "@/core/webhooks/deadLetterQueue";
import { listStripeApiCallsForWorkspace, type StripeApiCallLogEntry } from "@/core/integrations/providers/stripe/stripeApiCallLog";
import type { AuditLogEntry } from "@/core/audit";
import type { ConnectionEvent, IntegrationConnection, IntegrationHealthSnapshot, ProviderDefinition, QueueJob, SyncConflict, SyncRun } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "The Integrations Console isn't available. You may not have access to it.";

registerBuiltinProviders();

export interface ConnectionWithHealth {
  connection: IntegrationConnection;
  provider: ProviderDefinition | null;
  health: IntegrationHealthSnapshot | null;
  availableActions: ConnectionEvent[];
}

export interface IntegrationsConsoleData {
  providers: ProviderDefinition[];
  connections: ConnectionWithHealth[];
  auditLog: AuditLogEntry[];
  queueJobs: QueueJob[];
  syncRuns: SyncRun[];
  syncConflicts: SyncConflict[];
  deadLetterCount: number;
  /** v2 Checkpoint 23, Step 18 — real Stripe API call log (see `stripeApiCallLog.ts`); empty for a workspace with no Stripe connection. */
  stripeApiCalls: StripeApiCallLogEntry[];
}

export type GetIntegrationsConsoleDataResult = { success: true; data: IntegrationsConsoleData } | { success: false; error: string };

/**
 * v2 Checkpoint 22, Steps 14-15 — the one aggregate the Developer
 * Console's new "Integrations" (Configuration Center) and "Diagnostics"
 * tabs both read from, mirroring `getDeveloperConsoleData.ts`'s own "one
 * aggregate, computed fresh" shape. `workspace.manage` — the same gate
 * every other admin surface in this checkpoint's own research confirmed
 * is the established precedent (no new granular permission is invented).
 */
export async function getIntegrationsConsoleData(): Promise<GetIntegrationsConsoleDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const providers = listProviders();
  const rawConnections = listConnections(session.workspace.id);
  const connections: ConnectionWithHealth[] = rawConnections.map((connection) => ({
    connection,
    provider: providers.find((provider) => provider.id === connection.provider_id) ?? null,
    health: getConnectionHealth(connection.id),
    availableActions: listAvailableActions(connection.id),
  }));

  const syncRuns = rawConnections.flatMap((connection) => listSyncRunsForConnection(connection.id));
  const syncConflicts = rawConnections.flatMap((connection) => listConflictsForConnection(connection.id));

  return {
    success: true,
    data: {
      providers,
      connections,
      auditLog: await getIntegrationAuditLog(session.workspace.id),
      queueJobs: listJobsForWorkspace(session.workspace.id),
      syncRuns,
      syncConflicts,
      deadLetterCount: listDeadLetterDeliveries(session.workspace.id).length,
      stripeApiCalls: listStripeApiCallsForWorkspace(session.workspace.id),
    },
  };
}
