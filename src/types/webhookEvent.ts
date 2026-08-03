/**
 * Checkpoint 17, Step 6 — the Webhooks Platform's own closed event catalog.
 * Deliberately a separate union from `AutomationTriggerType`
 * (`core/enums`/`types/automation.ts`): an Automation Trigger fires an
 * internal rule engine (conditions, approvals, typed Actions); a Webhook
 * Event notifies an external system over HTTP. Two different subscribers
 * to the same underlying business moment, not the same concept reused —
 * a few names coincide (`client.created`, `invoice.paid`, …) because the
 * business moment is the same, not because one type is derived from the
 * other. See `core/webhooks/publisher.ts` for where both get fired from
 * the same call site.
 */
export const WEBHOOK_EVENT_CATEGORIES = ["crm", "finance", "documents", "workflow", "portal", "analytics"] as const;
export type WebhookEventCategory = (typeof WEBHOOK_EVENT_CATEGORIES)[number];

export const WEBHOOK_EVENT_TYPES = [
  "client.created",
  "client.updated",
  "event.created",
  "proposal.accepted",
  "invoice.created",
  "invoice.paid",
  "receipt.created",
  "document.generated",
  "document.published",
  "template.published",
  "workflow.published",
  "workflow.simulated",
  "portal.login",
  "checklist.completed",
  "document.downloaded",
  "proposal.viewed",
  "executive.summary.generated",
  // v2 Checkpoint 23 — Stripe Payments Platform. Fired from the real
  // Stripe inbound webhook handler once BloomOS's own Payment record has
  // already been updated, never straight from the raw Stripe payload.
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** A lightweight JSON-Schema-shaped description of a payload — reused directly by the OpenAPI `webhooks` section (Step 12), never a second, hand-duplicated schema. */
export type WebhookPayloadSchema = Record<string, unknown>;

/** Step 1's own "future deprecation" — a declared intent, not a working sunset mechanism this checkpoint enforces (no event is deprecated yet). A future checkpoint could filter `listWebhookEvents()` results or annotate the Developer Console's event picker once one is. */
export interface WebhookEventDeprecation {
  since: string;
  replacement?: WebhookEventType;
  note: string;
}

export interface WebhookEventDefinition {
  type: WebhookEventType;
  category: WebhookEventCategory;
  name: string;
  description: string;
  /** The payload's own schema version — starts at 1, bumped only on a breaking payload shape change. Carried into every envelope this event produces (`WebhookEventEnvelope.version`), so a subscriber can branch on it. */
  version: number;
  payloadSchema: WebhookPayloadSchema;
  deprecated?: WebhookEventDeprecation;
}

/**
 * Checkpoint 17, Step 7 — the one envelope shape every webhook delivery's
 * JSON body has, regardless of event type. `resource` names *what*
 * changed (never the full record — that's `payload`'s job), so a
 * subscriber can route on `event`/`resource.type` without parsing the
 * whole body. `metadata` is small, free-form string tags (e.g.
 * `{source: "system"}`) — never a place for anything `payload` itself
 * should already carry.
 */
export interface WebhookEventEnvelope<TPayload = unknown> {
  id: string;
  timestamp: string;
  workspace: string;
  version: number;
  event: WebhookEventType | "webhook.test";
  resource: { type: string; id: string };
  metadata: Record<string, string>;
  payload: TPayload;
}
