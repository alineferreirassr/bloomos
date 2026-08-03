/** v2 Checkpoint 43 — pure derivation, computed by integrationAnalyticsEngine.ts, never a stored type (same "computed, not persisted" precedent as reportingAnalytics/notificationAnalytics). */
export interface IntegrationsAnalytics {
  connectedProviders: number;
  activeConnections: number;
  failedConnections: number;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  webhookEventsReceived: number;
  webhookEventsFailed: number;
  retriesTotal: number;
  storageTransfers: number;
  averageProcessingDurationMs: number | null;
  providerErrorRate: number;
  computedAt: string;
}
