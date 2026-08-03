import { generateId, nowIso } from "@/lib/data/utils";
import { getLogger } from "@/core/observability/logger";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@/types/webhookEvent";
import type { IntegrationEventEnvelope, IntegrationEventHandler, IntegrationEventType } from "@/core/integrations/types";

/**
 * The Event Bus (v2 Checkpoint 22, Step 9) — internal, in-process
 * pub/sub, the "every module communicates through" backbone the spec
 * names. Deliberately a *superset* vocabulary from `WebhookEventType`
 * (Checkpoint 17): this checkpoint's own research found only 11 of 17
 * catalogued webhook events ever actually fire from a real call site, and
 * of the 6 example events this spec names (`invoice.paid`,
 * `proposal.accepted`, `event.completed`, `inventory.reserved`,
 * `vendor.assigned`, `client.created`), only 2 (`invoice.paid`,
 * `proposal.accepted`) have a same-named `WebhookEventType` today —
 * `event.completed` has no webhook equivalent at all (only
 * `event.created` exists). `publishIntegrationEvent` bridges to
 * `publishWebhookEvent` only for the events that genuinely have a
 * matching external catalog entry (`bridgesToWebhook`), so external
 * subscribers keep receiving exactly what they already do — it never
 * fabricates a webhook event that doesn't exist in Checkpoint 17's own
 * closed catalog.
 */

const subscribers = new Map<IntegrationEventType, Set<IntegrationEventHandler>>();

export function resetEventBus(): void {
  subscribers.clear();
}

/** Whether `type` also exists in the Webhook Platform's own closed catalog — the one condition under which `publishIntegrationEvent` also calls `publishWebhookEvent`. */
export function bridgesToWebhook(type: IntegrationEventType): boolean {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(type);
}

/** Returns an unsubscribe function — the same ergonomic every DOM/React event API uses, so a caller never has to keep the original handler reference around just to remove it later. */
export function subscribeToIntegrationEvent<TPayload = unknown>(type: IntegrationEventType, handler: IntegrationEventHandler<TPayload>): () => void {
  const set = subscribers.get(type) ?? new Set();
  set.add(handler as IntegrationEventHandler);
  subscribers.set(type, set);
  return () => {
    set.delete(handler as IntegrationEventHandler);
  };
}

export interface PublishIntegrationEventParams<TPayload> {
  type: IntegrationEventType;
  workspaceId: string;
  /** The specific entity this event is about (e.g. an Invoice id for `invoice.paid`) — only required when `bridgesToWebhook(type)`, since only the webhook bridge's own envelope needs a `resource`. */
  resourceId?: string;
  payload: TPayload;
}

/**
 * Fans an event out to every internal subscriber, entirely in-process
 * and never blocking the caller — the same "never block application
 * requests" discipline `publishWebhookEvent` already established. A
 * handler that throws is caught and logged here, never propagated back
 * to the publisher, so one broken subscriber can never break another or
 * the business action that triggered the event.
 */
export function publishIntegrationEvent<TPayload>(params: PublishIntegrationEventParams<TPayload>): void {
  const envelope: IntegrationEventEnvelope<TPayload> = {
    id: generateId("intevt"),
    type: params.type,
    workspace_id: params.workspaceId,
    occurred_at: nowIso(),
    payload: params.payload,
  };

  const handlers = subscribers.get(params.type);
  if (handlers) {
    for (const handler of handlers) {
      try {
        void Promise.resolve(handler(envelope)).catch((error: unknown) => {
          getLogger().error("Integration event handler rejected", { eventType: params.type, workspaceId: params.workspaceId, error: error instanceof Error ? error.message : "Unknown error" });
        });
      } catch (error) {
        getLogger().error("Integration event handler threw synchronously", { eventType: params.type, workspaceId: params.workspaceId, error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  }

  if (bridgesToWebhook(params.type)) {
    publishWebhookEvent({
      type: params.type as WebhookEventType,
      workspaceId: params.workspaceId,
      resource: { type: params.type.split(".")[0], id: params.resourceId ?? params.workspaceId },
      payload: params.payload,
      metadata: { source: "integration-event-bus" },
    });
  }
}
