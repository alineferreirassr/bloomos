import { nowIso } from "@/lib/data/utils";
import { listSyncRunsForConnection } from "@/core/integrations/syncEngine";
import { listJobsForWorkspace } from "@/core/integrations/queueEngine";
import { countRecentErrorsForConnection } from "@/lib/data/core/integrations/errorRecordStore";
import type { IntegrationConnection } from "@/core/integrations/types";
import type { IntegrationsAnalytics } from "@/types/integrationsAnalytics";

const ERROR_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * v2 Checkpoint 43 — Integration Analytics. Every field is a real
 * aggregate over the platform's own stores (`syncEngine`'s `SyncRun`s,
 * `queueEngine`'s `QueueJob`s — the same durable job record the webhook
 * routes create — and the new `IntegrationErrorRecord` store). No
 * fabricated per-provider event breakdown (payment/email/SMS/signature
 * counts) is computed here, honestly, since this checkpoint's webhook
 * processing records those as Timeline/Audit events, not as a
 * separately-countable analytics row per category — see
 * docs/integration-analytics.md for the disclosed gap.
 */
export function computeIntegrationsAnalytics(params: { workspaceId: string; connections: IntegrationConnection[] }): IntegrationsAnalytics {
  const { workspaceId, connections } = params;

  const connectedProviders = new Set(connections.filter((c) => c.state === "connected").map((c) => c.provider_id)).size;
  const activeConnections = connections.filter((c) => c.state === "connected").length;
  const failedConnections = connections.filter((c) => c.state === "failed").length;

  let totalSyncs = 0;
  let successfulSyncs = 0;
  let failedSyncs = 0;
  for (const connection of connections) {
    const runs = listSyncRunsForConnection(connection.id);
    totalSyncs += runs.length;
    successfulSyncs += runs.filter((r) => r.status === "succeeded").length;
    failedSyncs += runs.filter((r) => r.status === "failed").length;
  }

  const jobs = listJobsForWorkspace(workspaceId);
  const webhookJobs = jobs.filter((job) => job.queue.endsWith("-webhooks"));
  const webhookEventsReceived = webhookJobs.length;
  const webhookEventsFailed = webhookJobs.filter((job) => job.status === "failed").length;
  const retriesTotal = jobs.reduce((sum, job) => sum + Math.max(0, job.attempts - 1), 0);

  const storageTransfers = jobs.filter((job) => job.queue === "storage-transfers").length;

  const completedJobs = jobs.filter((job) => job.completed_at && job.started_at);
  const durations = completedJobs.map((job) => new Date(job.completed_at as string).getTime() - new Date(job.started_at as string).getTime()).filter((ms) => ms >= 0);
  const averageProcessingDurationMs = durations.length === 0 ? null : Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length);

  const sinceIso = new Date(Date.now() - ERROR_RATE_WINDOW_MS).toISOString();
  const totalRecentErrors = connections.reduce((sum, connection) => sum + countRecentErrorsForConnection(connection.id, sinceIso), 0);
  const providerErrorRate = connections.length === 0 ? 0 : Math.round((totalRecentErrors / connections.length) * 100) / 100;

  return {
    connectedProviders,
    activeConnections,
    failedConnections,
    totalSyncs,
    successfulSyncs,
    failedSyncs,
    webhookEventsReceived,
    webhookEventsFailed,
    retriesTotal,
    storageTransfers,
    averageProcessingDurationMs,
    providerErrorRate,
    computedAt: nowIso(),
  };
}
