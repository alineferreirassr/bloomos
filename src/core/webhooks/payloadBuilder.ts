import { generateId, nowIso } from "@/lib/data/utils";
import { getWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookEventEnvelope, WebhookEventType } from "@/types/webhookEvent";

/**
 * Checkpoint 17, Step 7 — the one place every webhook delivery's JSON
 * body gets assembled. Deliberately dumb: it never reads a raw internal
 * record itself, only wraps whatever `payload` its caller already
 * prepared — "Never expose internal-only data" is enforced by callers
 * passing an already-redacted shape (the exact same `toApiClient()`/
 * `toApiEvent()` mappers the Public API already uses, per
 * `core/api/mappers.ts` — Checkpoint 16), not by this function trying to
 * re-derive redaction rules a second time.
 */
export class UnknownWebhookEventError extends Error {
  constructor(type: string) {
    super(`No Webhook Event is registered for "${type}".`);
    this.name = "UnknownWebhookEventError";
  }
}

export interface BuildWebhookEventEnvelopeParams<TPayload> {
  type: WebhookEventType;
  workspaceId: string;
  resource: { type: string; id: string };
  payload: TPayload;
  metadata?: Record<string, string>;
}

export function buildWebhookEventEnvelope<TPayload>(params: BuildWebhookEventEnvelopeParams<TPayload>): WebhookEventEnvelope<TPayload> {
  const definition = getWebhookEvent(params.type);
  if (!definition) throw new UnknownWebhookEventError(params.type);

  return {
    id: generateId("whevt"),
    timestamp: nowIso(),
    workspace: params.workspaceId,
    version: definition.version,
    event: params.type,
    resource: params.resource,
    metadata: params.metadata ?? {},
    payload: params.payload,
  };
}

/** Checkpoint 17, Step 9 — the synthetic envelope a Developer Console "Test delivery" click sends. `event: "webhook.test"` deliberately never appears in `WEBHOOK_EVENT_TYPES` (Step 6's own closed catalog) — it's a delivery-pipeline smoke test, never a real business event a subscriber should filter on. */
export function buildTestWebhookEventEnvelope(workspaceId: string): WebhookEventEnvelope<{ message: string }> {
  return {
    id: generateId("whevt"),
    timestamp: nowIso(),
    workspace: workspaceId,
    version: 1,
    event: "webhook.test",
    resource: { type: "webhook", id: "test" },
    metadata: { source: "developer-console" },
    payload: { message: "This is a test delivery from BloomOS." },
  };
}
