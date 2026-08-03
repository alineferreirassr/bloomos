import type { Permission } from "@/core/enums/permission";
import type { ApiScope } from "@/types/apiScope";
import type { WebhookEventType } from "@/types/webhookEvent";

/**
 * v2 Checkpoint 22 — the Enterprise Integration Platform's own shared
 * types. This is infrastructure only: no real provider is connected, no
 * real OAuth handshake happens, no real HTTP call leaves BloomOS. Every
 * type here exists so a *future* checkpoint can plug in a real provider
 * with "minimal implementation effort" (the spec's own success
 * criterion), by implementing the SDK interfaces (`sdk.ts`) and
 * registering a `ProviderDefinition` — never by touching this file again.
 */

// ---------------------------------------------------------------------------
// Provider Registry (Step 2)
// ---------------------------------------------------------------------------

export const PROVIDER_CATEGORIES = [
  "payments",
  "calendar",
  "storage",
  "messaging",
  "communication",
  "accounting",
  "esignature",
  "ai",
  "social",
  "productivity",
  "crm",
  "automation",
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

/**
 * Which abstract SDK interface (`sdk.ts`) a provider implements — how the
 * Integration Manager knows what capabilities to expect from it without
 * inspecting provider-specific code. A provider may implement more than
 * one (e.g. a payments provider that's also a webhook source).
 */
export const PROVIDER_CAPABILITIES = [
  "oauth",
  "webhook",
  "storage",
  "messaging",
  "calendar",
  "payment",
  "ai_services",
  "accounting",
  "communication",
  // v2 Checkpoint 43 — External Integrations Platform. Backs the new
  // `SignatureProvider` SDK interface (`sdk.ts`); `docusign` (registered
  // Checkpoint 22) is the first provider to declare it.
  "signature",
] as const;
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export interface ProviderDefinition {
  /** Reuses the exact `ConnectorDefinition.id` for any of the 4 providers the Marketplace (Checkpoint 18) already registers (`stripe`, `slack`, `google-calendar`, `google-drive`) — never a second, colliding id for the same real-world service. */
  id: string;
  name: string;
  category: ProviderCategory;
  /** A plain string name, resolved by the UI — never a component reference, matching `ConnectorDefinition.icon`'s own precedent. */
  icon: string;
  version: number;
  capabilities: ProviderCapability[];
  description: string;
  requiredPermission: Permission;
  /** Declared, never enforced by a real call — this platform never reaches a real provider. */
  requiredApiScopes: ApiScope[];
  /** Metadata only, same discipline as `ConnectorDefinition.subscribedWebhookEvents` — does not create a live subscription by itself. */
  subscribedWebhookEvents: WebhookEventType[];
  /** Present only for `capabilities.includes("oauth")` providers — the endpoint shape the generic OAuth Engine would use for a real handshake. Never called in this checkpoint. */
  oauth?: ProviderOAuthMetadata;
}

export interface ProviderOAuthMetadata {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  defaultScopes: string[];
  supportsPkce: boolean;
}

// ---------------------------------------------------------------------------
// Connection State Machine (Step 5)
// ---------------------------------------------------------------------------

export const CONNECTION_STATES = [
  "disconnected",
  "connecting",
  "connected",
  "expired",
  "refreshing",
  "failed",
  "disabled",
  "reconnecting",
  "unknown",
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const CONNECTION_STATE_LABELS: Record<ConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  expired: "Expired",
  refreshing: "Refreshing",
  failed: "Failed",
  disabled: "Disabled",
  reconnecting: "Reconnecting",
  unknown: "Unknown",
};

export const CONNECTION_EVENTS = [
  "connect_requested",
  "connect_succeeded",
  "connect_failed",
  "token_expired",
  "refresh_requested",
  "refresh_succeeded",
  "refresh_failed",
  "disable_requested",
  "enable_requested",
  "reconnect_requested",
  "health_check_failed",
  "health_check_unknown",
] as const;
export type ConnectionEvent = (typeof CONNECTION_EVENTS)[number];

// ---------------------------------------------------------------------------
// Integration Connection + Manager (Step 1)
// ---------------------------------------------------------------------------

export interface IntegrationConnection {
  id: string;
  workspace_id: string;
  provider_id: string;
  state: ConnectionState;
  /** Free-form, declared by the provider's own `configSchema`-equivalent — same "no live validation against a real provider" scope as `ConnectorInstallation.config`. */
  config: Record<string, string | number | boolean>;
  credential_id: string | null;
  capabilities: ProviderCapability[];
  version: number;
  installed_by: string;
  created_at: string;
  updated_at: string;
  last_state_change_at: string;
  last_health_check_at: string | null;
  last_sync_at: string | null;
  failure_count: number;
  retry_count: number;
}

export interface ConnectionStateTransition {
  id: string;
  connection_id: string;
  from_state: ConnectionState;
  to_state: ConnectionState;
  event: ConnectionEvent;
  occurred_at: string;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Credentials Manager (Step 4)
// ---------------------------------------------------------------------------

export const CREDENTIAL_KINDS = ["api_key", "oauth_token", "provider_secret"] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

/**
 * Never a plaintext secret. An `api_key`-kind credential stores only a
 * hash (mirroring `lib/api/apiKeyToken.ts`'s own `key_hash`-only
 * discipline exactly) — the real secret is returned to the caller once,
 * at creation time, and never persisted. An `oauth_token`-kind credential
 * stores only a `secretRef` — a reference into the `EncryptionProvider`
 * abstraction (`credentialManager.ts`), never the token itself in this
 * record. Real BloomOS retrieves the token by calling
 * `EncryptionProvider.decrypt(secretRef)`, never by reading a plaintext
 * column.
 *
 * v2 Checkpoint 23 — `provider_secret` is the third kind: a static
 * third-party secret the *workspace* pastes in directly (e.g. a Stripe
 * secret key), as opposed to a token BloomOS itself issues (`api_key`)
 * or negotiates via a real OAuth handshake (`oauth_token`). Unlike
 * `api_key`, this secret must be retrievable — BloomOS needs the real
 * value on every outbound call to the provider's API — so it reuses the
 * exact same `access_token_ref`/`EncryptionProvider` storage shape
 * `oauth_token` already established, never a new plaintext column.
 */
export interface IntegrationCredential {
  id: string;
  workspace_id: string;
  connection_id: string;
  kind: CredentialKind;
  /** `api_key` kind only — mirrors `ApiKey.key_hash`/`key_prefix` exactly. */
  key_hash: string | null;
  key_prefix: string | null;
  /** `oauth_token` kind only — an opaque reference the `EncryptionProvider` resolves; never the token itself. */
  access_token_ref: string | null;
  refresh_token_ref: string | null;
  scopes: string[];
  expires_at: string | null;
  rotated_at: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Retry Engine (Step 10) — the one shared backoff primitive
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  /** When true, adds up to ±20% random jitter to each computed delay — off by default so existing callers (Webhooks) keep their exact, deterministic, already-tested sequence. */
  jitter?: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  maxAttempts: 5,
  jitter: false,
};

export interface RetryAttemptRecord {
  attempt: number;
  occurred_at: string;
  succeeded: boolean;
  delayMs: number | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Queue Engine (Step 8)
// ---------------------------------------------------------------------------

export const QUEUE_JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled", "delayed"] as const;
export type QueueJobStatus = (typeof QUEUE_JOB_STATUSES)[number];

export const QUEUE_JOB_PRIORITIES = ["low", "normal", "high"] as const;
export type QueueJobPriority = (typeof QUEUE_JOB_PRIORITIES)[number];

export interface QueueJob {
  id: string;
  workspace_id: string;
  queue: string;
  kind: string;
  payload: Record<string, unknown>;
  status: QueueJobStatus;
  priority: QueueJobPriority;
  attempts: number;
  max_attempts: number;
  available_at: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

// ---------------------------------------------------------------------------
// Event Bus (Step 9)
// ---------------------------------------------------------------------------

/**
 * Internal, in-process pub/sub — distinct from `WebhookEventType`
 * (external HTTP delivery). A superset: every `IntegrationEventType` that
 * has a same-named `WebhookEventType` is also forwarded to
 * `publishWebhookEvent` by `eventBus.ts`'s own bridge, so external
 * subscribers still receive it; an `IntegrationEventType` with no webhook
 * counterpart (e.g. `inventory.reserved`, `vendor.assigned` — genuinely
 * new business moments this checkpoint's own spec names) stays internal
 * until a future checkpoint adds a matching webhook catalog entry.
 */
export const INTEGRATION_EVENT_TYPES = [
  "invoice.paid",
  "proposal.accepted",
  "event.completed",
  "inventory.reserved",
  "vendor.assigned",
  "client.created",
  // v2 Checkpoint 23 — Stripe Payments Platform. All 3 have a same-named
  // WebhookEventType (`types/webhookEvent.ts`), so `bridgesToWebhook()`
  // forwards them to real external subscribers automatically.
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  // v2 Checkpoint 43 — External Integrations Platform. Provider-delivery
  // moments a Workflow trigger node (see `docs/integration-workflow.md`)
  // can react to. None has a same-named `WebhookEventType` yet, so
  // `bridgesToWebhook()` correctly keeps these internal-only.
  "calendar.event_changed",
  "email.delivered",
  "email.bounced",
  "sms.delivered",
  "sms.failed",
  "signature.completed",
  "signature.declined",
  "storage.file_synced",
  "connection.failed",
] as const;
export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number];

export interface IntegrationEventEnvelope<TPayload = unknown> {
  id: string;
  type: IntegrationEventType;
  workspace_id: string;
  occurred_at: string;
  payload: TPayload;
}

export type IntegrationEventHandler<TPayload = unknown> = (envelope: IntegrationEventEnvelope<TPayload>) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Health Monitor (Step 11)
// ---------------------------------------------------------------------------

export interface IntegrationHealthSnapshot {
  connection_id: string;
  provider_id: string;
  state: ConnectionState;
  latency_ms: number | null;
  failure_count: number;
  retry_count: number;
  quota_used: number | null;
  quota_limit: number | null;
  rate_limited: boolean;
  token_expires_at: string | null;
  last_sync_at: string | null;
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Synchronization Engine (Step 13)
// ---------------------------------------------------------------------------

export const SYNC_MODES = ["incremental", "full"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

export const SYNC_RUN_STATUSES = ["running", "succeeded", "failed", "conflict"] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

export interface SyncCheckpoint {
  id: string;
  connection_id: string;
  cursor: string | null;
  last_synced_at: string | null;
  updated_at: string;
}

export interface SyncConflict {
  id: string;
  connection_id: string;
  entity_ref: string;
  local_updated_at: string;
  remote_updated_at: string;
  /** The one supported strategy this phase — last-write-wins by comparing timestamps. A real bidirectional-merge strategy is out of scope; see docs/integration-platform.md's Known Limitations. */
  resolution: "local_wins" | "remote_wins" | "unresolved";
  detected_at: string;
  resolved_at: string | null;
}

export interface SyncRun {
  id: string;
  connection_id: string;
  mode: SyncMode;
  status: SyncRunStatus;
  records_processed: number;
  conflicts_detected: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// v2 Checkpoint 43 — External Integrations Platform additions.
//
// The checkpoint's own spec names 19 domain types (`IntegrationProvider`,
// `IntegrationConnection`, ... `IntegrationRecommendation`). Naming map —
// reused vs. genuinely new:
//
//   IntegrationProvider          -> ProviderDefinition (above, unchanged)
//   IntegrationConnection        -> IntegrationConnection (above, unchanged)
//   IntegrationCredentialReference -> IntegrationCredential (above, unchanged)
//   IntegrationCapability        -> ProviderCapability (above, unchanged)
//   IntegrationScope             -> ApiScope (Checkpoint 16, unchanged) for
//                                    internal permissioning; new
//                                    IntegrationOAuthScopeGrant below for the
//                                    *external* OAuth scopes a connection
//                                    actually holds — a distinct concept.
//   IntegrationStatus            -> ConnectionState (above, unchanged)
//   IntegrationHealth            -> IntegrationHealthSnapshot (above,
//                                    unchanged) — extended by
//                                    integrationHealthEngine.ts's own
//                                    higher-level `IntegrationsHealthReport`
//                                    (types/integrationsHealth.ts), the same
//                                    "per-connection snapshot -> workspace
//                                    report" shape Reporting/Search/
//                                    Notification Health already use.
//   IntegrationEvent              -> IntegrationEventEnvelope (above)
//   IntegrationWebhook             -> reuses Checkpoint 17's real
//                                    `WebhookEndpoint`/`WebhookDelivery`
//                                    entities per-connection; no new raw
//                                    entity (never a second webhook store).
//   IntegrationSyncJob             -> SyncRun (above, unchanged)
//   IntegrationSyncCursor           -> SyncCheckpoint (above, unchanged)
//   IntegrationMapping               -> IntegrationMapping (new, below)
//   IntegrationError                 -> IntegrationErrorRecord (new, below)
//   IntegrationRetry                  -> RetryPolicy/RetryAttemptRecord (above)
//   IntegrationAudit                   -> reuses the Core Audit Log via
//                                        auditCenter.ts; no new raw entity.
//   IntegrationAnalytics                -> computed by
//                                        integrationAnalyticsEngine.ts
//                                        (types/integrationsAnalytics.ts) —
//                                        pure derivation, not a stored type.
//   IntegrationSnapshot                  -> IntegrationSnapshot (new, below)
//   IntegrationRecommendation             -> IntegrationRecommendation (new,
//                                        below)
//
// Two genuinely new concepts this checkpoint introduces that no prior
// checkpoint had a shape for at all: an `IntegrationAccount` (which real
// external account/identity a connection is bound to — a Google email
// address, a Twilio Account SID, a specific Stripe account — distinct from
// the connection's own lifecycle state) and `IntegrationMapping` (the
// external-id <-> internal-entity link every sync-capable provider needs:
// a Google Calendar event id mapped to a BloomOS Event, a Drive file id
// mapped to a MediaAsset, a DocuSign envelope id mapped to a Contract).
// ---------------------------------------------------------------------------

/**
 * The real external identity a connection is bound to, once connected —
 * separate from `IntegrationConnection.state` (lifecycle) and
 * `IntegrationCredential` (the secret itself). Lets the UI show "connected
 * as jordan@amorebloom.com" / "Stripe account acct_..." without ever
 * exposing a token.
 */
export interface IntegrationAccount {
  id: string;
  connection_id: string;
  workspace_id: string;
  /** The provider's own account/identity id — never a BloomOS id. */
  external_account_id: string;
  /** Human-readable label shown in the Connection Center, e.g. an email address or account name. Never a secret. */
  display_label: string;
  environment: "sandbox" | "production";
  connected_at: string;
  connected_by: string;
}

/**
 * Which OAuth scopes a connection actually holds, as granted by the
 * provider at token-exchange time — distinct from `ProviderDefinition.
 * oauth.defaultScopes` (what BloomOS *requests*). Lets Integration Health's
 * `missing scope` check compare requested vs. granted honestly.
 */
export interface IntegrationOAuthScopeGrant {
  connection_id: string;
  requested_scopes: string[];
  granted_scopes: string[];
  granted_at: string;
}

/**
 * The external-id <-> internal-entity link every sync-capable provider
 * needs. One row per synced object. `internal_entity_type` reuses the
 * shared `EntityType` enum (Checkpoint 2) — never a parallel entity-kind
 * vocabulary.
 */
export interface IntegrationMapping {
  id: string;
  workspace_id: string;
  connection_id: string;
  provider_id: string;
  external_id: string;
  internal_entity_type: string;
  internal_entity_id: string;
  /** Which side is authoritative for this mapped object — see docs/integration-sync.md's one-way-vs-two-way disclosure per provider. BloomOS is the source of truth for every provider this checkpoint ships; `external_owns` is declared for completeness but unused. */
  source_of_truth: "bloomos_owns" | "external_owns";
  last_synced_at: string | null;
  created_at: string;
}

export const INTEGRATION_ERROR_CATEGORIES = ["auth", "rate_limit", "validation", "not_found", "network", "provider_unavailable", "unknown"] as const;
export type IntegrationErrorCategory = (typeof INTEGRATION_ERROR_CATEGORIES)[number];

/**
 * A structured, sanitized record of a failed provider call — never the raw
 * error object (which could carry a secret in a header/URL). Every adapter
 * in this checkpoint constructs this via `sanitizeIntegrationError()`
 * (`core/integrations/errorSanitizer.ts`) rather than serializing a caught
 * exception directly.
 */
export interface IntegrationErrorRecord {
  id: string;
  connection_id: string;
  provider_id: string;
  category: IntegrationErrorCategory;
  /** Redacted — see `errorSanitizer.ts`. Never contains a token, secret, card number, or full request/response body. */
  message: string;
  occurred_at: string;
  retryable: boolean;
}

/**
 * An immutable point-in-time capture of a connection's computed health +
 * analytics — the same "structurally immutable, no update/delete export"
 * discipline `lib/data/core/reporting/snapshotsStore.ts` established.
 */
export interface IntegrationSnapshot {
  id: string;
  workspace_id: string;
  generated_at: string;
  generated_by: string;
  health: IntegrationHealthSnapshotSummary;
  connection_count: number;
  active_connection_count: number;
}

export interface IntegrationHealthSnapshotSummary {
  overall_score: number;
  category_scores: Record<string, number>;
}

export const INTEGRATION_RECOMMENDATION_SEVERITIES = ["info", "warning", "critical"] as const;
export type IntegrationRecommendationSeverity = (typeof INTEGRATION_RECOMMENDATION_SEVERITIES)[number];

/**
 * Feeds `integrationExecutiveIntegration.ts`'s recommendation source for
 * Executive Decisions — the same "a healthy workspace contributes zero
 * findings" pattern every other domain's own recommendation source uses.
 */
export interface IntegrationRecommendation {
  id: string;
  connection_id: string | null;
  provider_id: string | null;
  severity: IntegrationRecommendationSeverity;
  title: string;
  description: string;
  action_hint: string | null;
}
