# Integration Health — v2 Checkpoint 43

`core/integrations/integrationHealthEngine.ts` — `computeIntegrationsHealth({connections, credentialsByConnectionId})`. Same `{score, issues, notApplicableReason}` category shape `types/businessHealth.ts`'s `HealthCategoryScore` established, reused (not reinvented) by `types/searchHealth.ts`/`types/notificationHealth.ts`/`types/reportingHealth.ts` — this is that same contract again.

## 6 categories (`INTEGRATIONS_HEALTH_CATEGORIES`)

- **`connection_status`** — share of connections in `connected` state; issues list any `failed`/`expired` connection.
- **`authentication`** — derived from `healthMonitor.computeHealthSnapshot`'s `token_expires_at`: flags a token that has already expired or expires within 7 days, and any connection with no credential attached.
- **`webhook_health`** — `null`/`notApplicableReason` when no connected provider declares the `webhook` capability; otherwise a flat 100 (no real webhook-uptime signal exists to score against in this environment).
- **`sync_health`** — flags a connection that hasn't synced (`last_sync_at`) in over 30 days.
- **`error_rate`** — counts `IntegrationErrorRecord`s in the last 24h per connection via `countRecentErrorsForConnection`; more than 5 in a window is an issue.
- **`mapping_integrity`** — flags a connection with `IntegrationMapping` rows that have never confirmed a sync (`last_synced_at === null`).

`overallScore` is the mean of every non-`null` category score. A workspace with zero connections gets every category `notApplicableReason`-flagged honestly — "No providers are connected yet" — never a fabricated zero-is-bad score.

## Where it's read

`getIntegrationsDashboardData.ts` computes it fresh on every `/integrations` page load, passing the real `IntegrationConnection[]` and a `Map` of each connection's own credential (via `getCredentialForConnection`) — never a second, independently-maintained health number.
