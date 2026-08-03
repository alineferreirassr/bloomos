import type { WebhookEventType } from "@/types/webhookEvent";

export const WEBHOOK_ENDPOINT_STATUSES = ["enabled", "disabled"] as const;
export type WebhookEndpointStatus = (typeof WEBHOOK_ENDPOINT_STATUSES)[number];

/**
 * Checkpoint 17, Step 2 — a Workspace's own outbound webhook subscription.
 *
 * Unlike `ApiKey.key_hash` (Checkpoint 16), `secret` is stored as-is, not
 * hashed — a deliberate, necessary asymmetry. An API Key authenticates an
 * *incoming* request: BloomOS only ever needs to compare a presented
 * secret's hash against a stored hash, never recover the original value.
 * A Webhook Secret signs an *outgoing* request: BloomOS itself must
 * compute `HMAC-SHA256(secret, ...)` at delivery time, which is
 * impossible from a one-way hash alone. This mock store keeps the secret
 * in plaintext for exactly that reason; a production deployment would
 * store it in an encrypted-at-rest column or a secrets manager, never
 * plaintext in a database — see docs/webhooks.md's own Security section.
 * The Developer Console still only ever *displays* it once, at creation
 * or rotation, the same "shown once" UX `ApiKeyWithSecret` established,
 * even though the value remains server-side for signing every delivery.
 */
export interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  url: string;
  description: string | null;
  secret: string;
  secret_prefix: string;
  subscribed_events: WebhookEventType[];
  status: WebhookEndpointStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  rotated_at: string | null;
  last_delivery_at: string | null;
  last_delivery_status: "success" | "failed" | null;
}

/** The public, browser-safe projection — every list/read surface returns this, never the raw `WebhookEndpoint` with its live secret. */
export type PublicWebhookEndpoint = Omit<WebhookEndpoint, "secret">;

/** Returned exactly once, at creation or rotation — the only moment the real secret is ever sent to the browser. */
export interface WebhookEndpointWithSecret {
  endpoint: PublicWebhookEndpoint;
  secret: string;
}

export interface CreateWebhookEndpointInput {
  url: string;
  description: string;
  subscribed_events: WebhookEventType[];
}
