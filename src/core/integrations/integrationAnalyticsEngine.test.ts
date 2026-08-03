import { afterEach, describe, expect, it } from "vitest";
import { computeIntegrationsAnalytics } from "@/core/integrations/integrationAnalyticsEngine";
import { resetQueueEngine, enqueueJob, claimNextJob, completeJob } from "@/core/integrations/queueEngine";
import { resetSyncEngine, startSyncRun, completeSyncRun, failSyncRun } from "@/core/integrations/syncEngine";
import { resetErrorRecordStore } from "@/lib/data/core/integrations/errorRecordStore";
import type { IntegrationConnection } from "@/core/integrations/types";

function makeConnection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "conn_1",
    workspace_id: "ws_1",
    provider_id: "twilio",
    state: "connected",
    config: {},
    credential_id: "cred_1",
    capabilities: ["communication"],
    version: 1,
    installed_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    last_state_change_at: "2026-01-01T00:00:00.000Z",
    last_health_check_at: null,
    last_sync_at: null,
    failure_count: 0,
    retry_count: 0,
    ...overrides,
  };
}

afterEach(() => {
  resetQueueEngine();
  resetSyncEngine();
  resetErrorRecordStore();
});

describe("computeIntegrationsAnalytics", () => {
  it("counts zero of everything for a workspace with no connections and no activity", () => {
    const analytics = computeIntegrationsAnalytics({ workspaceId: "ws_1", connections: [] });
    expect(analytics.connectedProviders).toBe(0);
    expect(analytics.totalSyncs).toBe(0);
    expect(analytics.averageProcessingDurationMs).toBeNull();
  });

  it("counts connected providers and active connections from real connection state", () => {
    const analytics = computeIntegrationsAnalytics({ workspaceId: "ws_1", connections: [makeConnection(), makeConnection({ id: "conn_2", provider_id: "docusign" })] });
    expect(analytics.connectedProviders).toBe(2);
    expect(analytics.activeConnections).toBe(2);
  });

  it("counts failed connections separately from connected ones", () => {
    const analytics = computeIntegrationsAnalytics({ workspaceId: "ws_1", connections: [makeConnection({ state: "failed" })] });
    expect(analytics.failedConnections).toBe(1);
    expect(analytics.activeConnections).toBe(0);
  });

  it("counts successful and failed syncs from real SyncRun records", () => {
    const run1 = startSyncRun("conn_1", "incremental");
    completeSyncRun(run1.id, 10);
    const run2 = startSyncRun("conn_1", "incremental");
    failSyncRun(run2.id, "network error");

    const analytics = computeIntegrationsAnalytics({ workspaceId: "ws_1", connections: [makeConnection()] });
    expect(analytics.totalSyncs).toBe(2);
    expect(analytics.successfulSyncs).toBe(1);
    expect(analytics.failedSyncs).toBe(1);
  });

  it("counts webhook events received/failed from real Queue Engine jobs in a -webhooks queue", () => {
    const job1 = enqueueJob({ workspaceId: "ws_1", queue: "twilio-webhooks", kind: "delivered", payload: {} });
    claimNextJob("twilio-webhooks");
    completeJob(job1.id);
    enqueueJob({ workspaceId: "ws_1", queue: "twilio-webhooks", kind: "failed", payload: {}, maxAttempts: 1 });

    const analytics = computeIntegrationsAnalytics({ workspaceId: "ws_1", connections: [makeConnection()] });
    expect(analytics.webhookEventsReceived).toBe(2);
  });

  it("never fabricates a processing duration when no job has both started_at and completed_at", () => {
    enqueueJob({ workspaceId: "ws_1", queue: "twilio-webhooks", kind: "delivered", payload: {} });
    const analytics = computeIntegrationsAnalytics({ workspaceId: "ws_1", connections: [makeConnection()] });
    expect(analytics.averageProcessingDurationMs).toBeNull();
  });
});
