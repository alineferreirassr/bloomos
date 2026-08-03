import { delay } from "@/lib/data/utils";
import { dispatchWebhookDelivery } from "@/core/webhooks/dispatcher";
import { createWebhookDelivery, updateWebhookDelivery } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { touchWebhookEndpointLastDelivery } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { getLogger } from "@/core/observability/logger";
import { computeBackoffDelayMs as computeSharedBackoffDelayMs } from "@/core/integrations/retryEngine";
import type { WebhookEndpoint } from "@/types/webhookEndpoint";
import type { WebhookEventEnvelope } from "@/types/webhookEvent";
import type { WebhookDelivery, WebhookDeliveryStatus } from "@/types/webhookDelivery";

/**
 * Checkpoint 17, Step 5 — the Retry Engine. Exponential backoff (1s, 2s,
 * 4s, 8s — capped at 60s), a fixed attempt ceiling, and a real terminal
 * `dead_letter` status once every attempt is exhausted — the spec's own
 * "final failure state." The "dead-letter placeholder" is this: today,
 * reaching `dead_letter` only sets the status and logs an error — no
 * separate dead-letter queue/table a future retry-from-DLQ flow could
 * read from exists yet (a real one only needs to read
 * `listWebhookDeliveriesForWorkspace().filter(d => d.status ===
 * "dead_letter")`, which already works — "placeholder" describes the
 * *policy*, not a missing capability).
 *
 * v2 Checkpoint 22, Step 10 — `computeBackoffDelayMs` below now delegates
 * its arithmetic to `core/integrations/retryEngine.ts`, the one shared
 * backoff primitive every retrying subsystem in this codebase (Webhooks,
 * Automation, the new Queue/Sync engines) now uses. The formula and every
 * constant below are unchanged (1s base, 60s cap, no jitter) — this
 * retrofit is a pure delegation, not a behavior change, so this file's
 * own existing test suite passes without modification.
 */
export const MAX_DELIVERY_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

export function computeBackoffDelayMs(attempt: number): number {
  return computeSharedBackoffDelayMs(attempt, { baseDelayMs: BASE_BACKOFF_MS, maxDelayMs: MAX_BACKOFF_MS, maxAttempts: MAX_DELIVERY_ATTEMPTS, jitter: false });
}

export interface DeliverWithRetryParams {
  endpoint: WebhookEndpoint;
  envelope: Pick<WebhookEventEnvelope, "id" | "event">;
  /** Pre-serialized JSON — Replay (Step 9) passes the literal stored `request_body` back in, never a re-built envelope, so the signature verifies exactly the same way twice. */
  body: string;
  replayedFromDeliveryId?: string | null;
  isTest?: boolean;
}

/**
 * Runs the whole attempt sequence for one (event, endpoint) delivery,
 * entirely in-process — the caller (`publisher.ts`) never awaits this
 * before returning, so a slow or failing external endpoint never blocks
 * the application request that triggered the event. Never a durable job
 * queue or cron (explicit Non-Goal: "Real background workers") — every
 * retry's backoff delay is a real, in-memory `setTimeout` inside this
 * same async function's own lifetime. If the Node process restarts
 * mid-backoff, an in-flight retry sequence is lost — a known, documented
 * limitation of the mock-only phase, not silently glossed over.
 */
export async function deliverWithRetry(params: DeliverWithRetryParams): Promise<WebhookDelivery> {
  const { endpoint, envelope, body } = params;

  let delivery = createWebhookDelivery({
    workspace_id: endpoint.workspace_id,
    endpoint_id: endpoint.id,
    event_id: envelope.id,
    event_type: envelope.event,
    max_attempts: MAX_DELIVERY_ATTEMPTS,
    request_headers: {},
    request_body: body,
    replayed_from_delivery_id: params.replayedFromDeliveryId ?? null,
    is_test: params.isTest ?? false,
  });

  let attempt = 0;
  let succeeded = false;

  while (attempt < MAX_DELIVERY_ATTEMPTS && !succeeded) {
    attempt += 1;
    const result = await dispatchWebhookDelivery(endpoint, envelope, body);
    succeeded = result.success;

    const nextStatus: WebhookDeliveryStatus = succeeded ? "success" : attempt < MAX_DELIVERY_ATTEMPTS ? "retrying" : "dead_letter";
    const updated = updateWebhookDelivery(delivery.id, {
      status: nextStatus,
      attempts: attempt,
      last_status_code: result.statusCode,
      last_duration_ms: result.durationMs,
      last_error: result.error,
      request_headers: result.requestHeaders,
      response_headers: result.responseHeaders,
      response_body_excerpt: result.responseBodyExcerpt,
      next_retry_at: nextStatus === "retrying" ? new Date(Date.now() + computeBackoffDelayMs(attempt)).toISOString() : null,
    });
    if (updated) delivery = updated;

    const logLevel = succeeded ? "info" : "warn";
    getLogger()[logLevel](succeeded ? "Webhook delivered" : "Webhook delivery attempt failed", {
      endpointId: endpoint.id,
      workspaceId: endpoint.workspace_id,
      eventType: envelope.event,
      deliveryId: delivery.id,
      attempt,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      error: result.error ?? undefined,
    });

    if (!succeeded && attempt < MAX_DELIVERY_ATTEMPTS) {
      await delay(computeBackoffDelayMs(attempt));
    }
  }

  touchWebhookEndpointLastDelivery(endpoint.id, succeeded ? "success" : "failed");
  if (!succeeded) {
    getLogger().error("Webhook delivery exhausted every retry — moved to dead letter", {
      endpointId: endpoint.id,
      workspaceId: endpoint.workspace_id,
      eventType: envelope.event,
      deliveryId: delivery.id,
      attempts: attempt,
    });
  }

  return delivery;
}
