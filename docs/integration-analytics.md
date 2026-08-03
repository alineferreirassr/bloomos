# Integration Analytics — v2 Checkpoint 43

`core/integrations/integrationAnalyticsEngine.ts` — `computeIntegrationsAnalytics({workspaceId, connections})`. Same "computed, not persisted" precedent as `reportingAnalytics`/`notificationAnalytics` — every field is a real-time aggregate over the platform's own stores, never a separately maintained counter.

## Fields (`IntegrationsAnalytics`)

| Field | Source |
|---|---|
| `connectedProviders` | distinct `provider_id`s among `connected` connections |
| `activeConnections` / `failedConnections` | count by `state` |
| `totalSyncs` / `successfulSyncs` / `failedSyncs` | `syncEngine.listSyncRunsForConnection()` across every connection |
| `webhookEventsReceived` / `webhookEventsFailed` | Queue Engine jobs whose `queue` ends in `-webhooks` (`stripe-webhooks`, `twilio-webhooks`, `docusign-webhooks`) |
| `retriesTotal` | `sum(job.attempts - 1)` across every queued job |
| `storageTransfers` | jobs in the `storage-transfers` queue |
| `averageProcessingDurationMs` | mean of `completed_at - started_at` across completed jobs; `null` when no job has completed yet |
| `providerErrorRate` | recent (24h) `IntegrationErrorRecord` count ÷ connection count |

## Honest gap

No fabricated per-provider event breakdown (a "payment events: 12, email events: 4" split) is computed — this checkpoint's webhook processing records those as Timeline/Audit events, not as a separately-countable analytics row per category. Adding that breakdown would require a new persisted counter keyed by `(provider_id, event_type)`, out of this checkpoint's scope; `webhookEventsReceived`/`webhookEventsFailed` are workspace-wide totals only.

## Where it's read

`getIntegrationsDashboardData.ts` computes it fresh on every `/integrations` page load, alongside `computeIntegrationsHealth` (`docs/integration-health.md`).
