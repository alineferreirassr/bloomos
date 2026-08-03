"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { listProviders } from "@/core/integrations/providerRegistry";
import { listConnections, getConnectionHealth } from "@/core/integrations/integrationManager";
import { getCredentialForConnection } from "@/core/integrations/credentialManager";
import { summarizeHealth, type HealthSummary } from "@/core/integrations/healthMonitor";
import { getIntegrationAuditLog } from "@/core/integrations/auditCenter";
import { listJobsForWorkspace } from "@/core/integrations/queueEngine";
import { listConflictsForConnection } from "@/core/integrations/syncEngine";
import { listDeadLetterDeliveries } from "@/core/webhooks/deadLetterQueue";
import { computeIntegrationsHealth } from "@/core/integrations/integrationHealthEngine";
import { computeIntegrationsAnalytics } from "@/core/integrations/integrationAnalyticsEngine";
import type { AuditLogEntry } from "@/core/audit";
import type { IntegrationConnection, ProviderDefinition } from "@/core/integrations/types";
import type { IntegrationsHealthReport } from "@/types/integrationsHealth";
import type { IntegrationsAnalytics } from "@/types/integrationsAnalytics";

const GENERIC_ACCESS_ERROR = "The Integrations Dashboard isn't available. You may not have access to it.";

registerBuiltinProviders();

export interface IntegrationsDashboardConnectionRow {
  connection: IntegrationConnection;
  provider: ProviderDefinition | null;
  healthy: boolean;
}

export interface IntegrationsDashboardData {
  providerCount: number;
  health: HealthSummary;
  connections: IntegrationsDashboardConnectionRow[];
  queueBacklog: number;
  unresolvedConflicts: number;
  deadLetterCount: number;
  recentAuditLog: AuditLogEntry[];
  integrationsHealth: IntegrationsHealthReport;
  integrationsAnalytics: IntegrationsAnalytics;
}

export type GetIntegrationsDashboardDataResult = { success: true; data: IntegrationsDashboardData } | { success: false; error: string };

/**
 * The Integration Dashboard (v2 Checkpoint 22, Step 16) — a workspace-
 * wide read, mirroring `getOperationsDashboardData.ts`'s (Checkpoint 21)
 * own "one aggregate, computed fresh" shape for a dedicated dashboard
 * page. Every figure is read straight from the engines this checkpoint
 * already built — the Provider Registry, Integration Manager, Health
 * Monitor, Queue Engine, Synchronization Engine, Audit Center, and the
 * Webhook Engine's own Dead Letter Queue — never a second, independently
 * maintained counter.
 */
export async function getIntegrationsDashboardData(): Promise<GetIntegrationsDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const providers = listProviders();
  const rawConnections = listConnections(session.workspace.id);
  const healthSnapshots = rawConnections.map((connection) => getConnectionHealth(connection.id)).filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null);

  const connections: IntegrationsDashboardConnectionRow[] = rawConnections.map((connection) => {
    const snapshot = healthSnapshots.find((health) => health.connection_id === connection.id) ?? null;
    return { connection, provider: providers.find((provider) => provider.id === connection.provider_id) ?? null, healthy: snapshot ? snapshot.state === "connected" && snapshot.failure_count === 0 : false };
  });

  const jobs = listJobsForWorkspace(session.workspace.id);
  const unresolvedConflicts = rawConnections.flatMap((connection) => listConflictsForConnection(connection.id)).filter((conflict) => conflict.resolution === "unresolved").length;
  const auditLog = await getIntegrationAuditLog(session.workspace.id);

  const credentialsByConnectionId = new Map(rawConnections.map((connection) => [connection.id, getCredentialForConnection(connection.id)]));

  return {
    success: true,
    data: {
      providerCount: providers.length,
      health: summarizeHealth(healthSnapshots),
      connections,
      queueBacklog: jobs.filter((job) => job.status === "queued" || job.status === "delayed").length,
      unresolvedConflicts,
      deadLetterCount: listDeadLetterDeliveries(session.workspace.id).length,
      recentAuditLog: auditLog.slice(0, 5),
      integrationsHealth: computeIntegrationsHealth({ connections: rawConnections, credentialsByConnectionId }),
      integrationsAnalytics: computeIntegrationsAnalytics({ workspaceId: session.workspace.id, connections: rawConnections }),
    },
  };
}
