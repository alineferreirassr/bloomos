# Enterprise Integration Platform

v2 Checkpoint 22 — infrastructure only. Every Non-Goal from the checkpoint's own spec holds throughout this document and the code it describes: no real OAuth handshake, no real Stripe/Google/Slack/HubSpot/OpenAI/Anthropic/Twilio/Microsoft/DocuSign/etc. account is ever contacted, no production credential is ever generated. This is the reusable platform a *future* checkpoint would plug a real provider into — see each section's "Known limitation" for exactly where that future work picks up.

## Why this checkpoint, and what it reuses

Three prior checkpoints already built adjacent infrastructure this platform deliberately extends rather than duplicates:

- **Checkpoint 16 (Public API)** — `ApiScope`, and `lib/api/apiKeyToken.ts`'s hash-only credential discipline (`key_hash`/`key_prefix`, secret shown once).
- **Checkpoint 17 (Webhooks)** — `WebhookEventType`, the Retry Engine's exponential-backoff formula, and Delivery History/Replay/Dead Letter status.
- **Checkpoint 18 (Marketplace)** — `ConnectorDefinition`/`ConnectorInstallation`, and the "derive health from real signals" philosophy (`checkConnectorHealth`).

The single most load-bearing reuse decision: the Provider Registry reuses the Marketplace's **exact connector ids** for the 4 services both registries know about — `stripe`, `slack`, `google-calendar`, `google-drive` — never a second, colliding id for the same real-world service. See `docs/provider-registry.md`.

## Architecture

```
core/integrations/
  types.ts                 — every shared type (see below)
  providerRegistry.ts       — Map<id, ProviderDefinition>, Step 2
  sdk.ts                    — abstract capability interfaces, Step 3 (no implementations)
  providerFactory.ts        — seam for a future real SDK implementation
  connectionStateMachine.ts — 9-state transition table, Step 5
  credentialManager.ts      — Step 4 (+ EncryptionProvider abstraction)
  oauthEngine.ts             — Step 6 (state/PKCE bookkeeping, no real handshake)
  retryEngine.ts             — Step 10 (shared backoff primitive)
  queueEngine.ts             — Step 8 (in-process job queue)
  eventBus.ts                 — Step 9 (internal pub/sub, bridges to Webhooks)
  healthMonitor.ts            — Step 11 (derived health snapshot)
  auditCenter.ts               — Step 12 (wraps the Core Audit Log)
  syncEngine.ts                 — Step 13 (sync runs/checkpoints/conflicts)
  integrationManager.ts          — Step 1, the orchestration layer every caller uses

modules/integrations/
  providers/*.ts                — 16 built-in ProviderDefinitions, one file per category group
  registerBuiltinProviders.ts    — idempotent loader
  getIntegrationsConsoleData.ts  — Developer Console's Integrations+Diagnostics aggregate
  getIntegrationsDashboardData.ts — /integrations page's own aggregate
  manageIntegrationConnectionsActions.ts — install/transition/uninstall Server Actions
  components/
    IntegrationsConfigTab.tsx      — Configuration Center (Step 14)
    IntegrationsDiagnosticsTab.tsx — Developer Center diagnostics (Step 15)
    IntegrationsDashboardView.tsx  — Integration Dashboard (Step 16)
```

## Domain types (`core/integrations/types.ts`)

- **`ProviderDefinition`** — the registry entry: id, category, capabilities, `requiredPermission`/`requiredApiScopes` (declared, never enforced against a real request), `subscribedWebhookEvents`, and an optional `oauth` metadata block.
- **`IntegrationConnection`** — a new, parallel entity to Marketplace's `ConnectorInstallation`; never a modification of it. Carries `state` (see the state machine), `credential_id`, `failure_count`/`retry_count`.
- **`IntegrationCredential`** — never a plaintext secret or token. `api_key` kind stores only `key_hash`/`key_prefix` (mirrors `ApiKey` exactly); `oauth_token` kind stores only `access_token_ref`/`refresh_token_ref`, opaque references into `EncryptionProvider`.
- **`RetryPolicy`** / **`QueueJob`** / **`IntegrationEventEnvelope`** / **`IntegrationHealthSnapshot`** / **`SyncRun`**/**`SyncConflict`** — see each engine's own doc for the type in context.

## The Connection State Machine (Step 5)

9 states (`disconnected`/`connecting`/`connected`/`expired`/`refreshing`/`failed`/`disabled`/`reconnecting`/`unknown`), 12 events, one pure lookup table (`core/integrations/connectionStateMachine.ts`). A genuine superset of Marketplace's own `ConnectorHealthStatus` (5 values, a *derived* on-demand read) — built alongside it, not replacing it. `canTransition(state, event)` is the only door: `integrationManager.applyConnectionEvent()` calls it before ever mutating a connection's `state`, so an illegal transition throws rather than silently corrupting the record.

## The Integration Manager (Step 1)

`core/integrations/integrationManager.ts` is the one orchestration layer — `installProvider()`, `applyConnectionEvent()`, `uninstallConnection()`, `getConnectionHealth()`. No call site reaches into `connectionStore.ts` or the state machine directly. `uninstallConnection()` revokes the connection's own credential before removing it — the same "never leave an orphaned, still-valid credential behind" discipline `uninstallConnector` (Checkpoint 18) already established.

## Credentials Manager (Step 4)

`core/integrations/credentialManager.ts`. `api_key`-kind credentials mirror `lib/api/apiKeyToken.ts` exactly — a 256-bit random secret, SHA-256 hash stored, the real secret returned to the caller exactly once. `oauth_token`-kind credentials have no prior-checkpoint precedent to mirror, so this introduces `EncryptionProvider` — an interface a future checkpoint points at a real KMS/Vault. Its default, `InMemoryEncryptionProvider`, is an honest mock: it does not encrypt anything, it just keeps the value out of the `IntegrationCredential` record itself, behind an opaque `secretRef`.

## OAuth Engine (Step 6)

`core/integrations/oauthEngine.ts` — the handshake *shape*, built entirely from `ProviderDefinition.oauth` metadata, never a provider-specific line of code. Generates a real CSRF `state` and a real PKCE verifier/challenge (`crypto.subtle`), builds the exact authorization URL a browser would be redirected to, and never sends it anywhere. `completeAuthorization()` accepts the token values a real callback route would already hold and does only local bookkeeping (validate the pending request, mint a credential, report the state transition). See `docs/oauth-engine.md`.

## Webhook Engine extensions (Step 7)

Checkpoint 17 already built a real Dead Letter status, Delivery History, Replay, and delivery Metrics — this checkpoint's own research found all four already fully live. What Step 7 adds: a formalized `listDeadLetterDeliveries()` read (`core/webhooks/deadLetterQueue.ts`) and a bulk "Replay all" action, plus a Dead-Letter-only filter in the Developer Console's Deliveries tab. See `docs/webhook-engine.md`.

## Queue Engine (Step 8)

`core/integrations/queueEngine.ts` — an in-process job queue (`enqueueJob`/`claimNextJob`/`completeJob`/`failJob`), the same explicit non-durability scope `deliverWithRetry` (Checkpoint 17) already documented: a plain in-memory array, not a real background worker or durable broker (Non-Goal: "Real background workers"). `claimNextJob` is what a future worker loop would call; nothing in this checkpoint runs that loop automatically. See `docs/queue-engine.md`.

## Event Bus (Step 9)

`core/integrations/eventBus.ts` — internal, in-process pub/sub, a deliberate *superset* vocabulary from `WebhookEventType`. Bridges to `publishWebhookEvent` only where a same-named webhook event genuinely exists today (`invoice.paid`, `proposal.accepted`, `client.created`); `event.completed`/`inventory.reserved`/`vendor.assigned` stay internal-only until a future checkpoint adds a matching webhook catalog entry. See `docs/event-bus.md`.

## Retry Engine (Step 10)

`core/integrations/retryEngine.ts` — the one shared backoff primitive. Both `core/webhooks/retryEngine.ts` and `core/automation/actionRunner.ts` now delegate their arithmetic to it; Webhooks' own sequence is byte-for-byte unchanged (a pure delegation), and Automation's own prior "reserved for a future checkpoint" retry-delay gap is now closed. See `docs/retry-engine.md`.

## Health Monitor (Step 11)

`core/integrations/healthMonitor.ts` — a pure, on-demand health read, same "derive from real signals" philosophy as `checkConnectorHealth`. `latency_ms`/`quota_used`/`quota_limit`/`rate_limited` are honestly `null`/`false` this checkpoint — no real request is ever made, so there's nothing real to measure.

## Audit Center (Step 12)

`core/integrations/auditCenter.ts` wraps `getCoreAuditLogService()` — never a second audit store. Two new `EntityType` values, `integration_connection` and `integration_credential` (`core/enums/entityType.ts`), let every install/transition/uninstall/rotate/revoke get a real, append-only audit entry.

## Synchronization Engine (Step 13)

`core/integrations/syncEngine.ts` — sync run lifecycle (`running`→`succeeded`/`failed`/`conflict`), a per-connection cursor (`SyncCheckpoint`), and last-write-wins conflict resolution comparing two timestamps. A real bidirectional-merge strategy is out of scope for this phase.

## UI surfaces

- **Configuration Center** (Step 14) — a new "Integrations" tab on `/developer`. Install a provider (creates a `disconnected` connection, no real handshake), then walk it through the state machine by hand via the buttons `listAvailableActions()` says are legal right now.
- **Developer Center diagnostics** (Step 15) — a new "Diagnostics" tab on `/developer`. Read-only: connection health, Queue Engine jobs, Sync Engine runs/conflicts, and the Audit Center's own trail.
- **Integration Dashboard** (Step 16) — a new page, `/integrations`, mirroring the Operations Dashboard's (Checkpoint 21) self-fetching, workspace-wide read pattern. All mutation stays on the Developer Console; this page is read-only.

## Permissions

Every admin action gates on `workspace.manage` — the same permission every other admin surface in this checkpoint's own research confirmed is the established precedent (Public API Keys, Webhooks, Marketplace, Settings). No new granular permission was invented.

## Known limitations

- No real provider is ever connected — every "Connect"/"Refresh" action is local state-machine bookkeeping, never a real HTTP call.
- `InMemoryEncryptionProvider` is not real encryption; it's a seam for a future real KMS/Vault-backed provider.
- The Queue Engine has no automatic worker loop — `claimNextJob()` exists, nothing calls it on a timer.
- An in-flight OAuth pending authorization or a job's backoff delay is lost on process restart — the same "mock-only phase" limitation `deliverWithRetry` already documented for Webhooks.
- Sync conflict resolution is last-write-wins only; no bidirectional merge.

## v2 Checkpoint 43 additions

Checkpoint 43 ("External Integrations Platform") does not rebuild this platform — it plugs 5 real, `fetch`-based provider adapters into the seams this checkpoint already left open (`providerFactory.ts`'s registration seam, `sdk.ts`'s capability interfaces, `credentialManager.ts`'s `provider_secret` kind from Checkpoint 23). See `docs/stripe-integration.md` (verified/extended), `docs/calendar-integration.md`, `docs/email-integration.md`, `docs/sms-integration.md`, `docs/signature-integration.md`, and `docs/storage-integration.md` for each adapter; `docs/integration-health.md` and `docs/integration-analytics.md` for the two new derived-read engines; `docs/integration-permissions.md` for the 13 new granular `integrations.*` permissions; and `docs/integration-security.md` for the secret-redaction and honest-disclosure discipline every new adapter follows. `docs/v2-checkpoint-43.md` is the full scope-classification and final report for this delta.

A genuinely new type, `SignatureProvider` (`core/integrations/sdk.ts`), was added because no prior checkpoint had an e-signature capability shape; `PROVIDER_CAPABILITIES` gained `"signature"` to match. `ProviderFactoryFn`'s param type widened from `{secret?}` to `{secret?, accessToken?}` since 3 of the 5 new adapters authenticate with an OAuth access token, not a provider secret — an additive widening, not a breaking change to Stripe's existing factory.
