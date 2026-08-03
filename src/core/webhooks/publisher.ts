import { getLogger } from "@/core/observability/logger";
import { registerBuiltinWebhookEvents } from "@/modules/webhooks/registerBuiltinWebhookEvents";
import { buildWebhookEventEnvelope, type BuildWebhookEventEnvelopeParams } from "@/core/webhooks/payloadBuilder";
import { listWebhookEndpointsForWorkspace } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { deliverWithRetry } from "@/core/webhooks/retryEngine";

registerBuiltinWebhookEvents();

/**
 * Checkpoint 17 — the Event Publisher, the one function every business
 * action calls to notify external subscribers. "Never block application
 * requests" (Step 4) and "Never execute business logic inside webhook
 * delivery" (the checkpoint's own objective) are both enforced here:
 * this function never `await`s a delivery to completion, and it never
 * does anything *but* fan the event out — no conditions, no side effects
 * on BloomOS's own data, unlike `dispatchAutomationTrigger()`
 * (Checkpoint 9), which is a genuinely different concern (an internal
 * rule engine) and is never called from here.
 *
 * Every call site (see the `publishWebhookEvent(...)` calls scattered
 * across CRM/Finance/Documents/Workflow/Portal/Analytics Server Actions)
 * can call this unguarded — it never throws back into the caller; any
 * failure (unknown event type, no endpoints, a delivery error) is caught
 * and logged here, exactly the same "a dispatch failure never fails the
 * business action that triggered it" discipline every existing
 * `dispatchAutomationTrigger()` call site already follows.
 */
export function publishWebhookEvent<TPayload>(params: BuildWebhookEventEnvelopeParams<TPayload>): void {
  let envelope;
  try {
    envelope = buildWebhookEventEnvelope(params);
  } catch (error) {
    getLogger().error("Webhook event publish failed — could not build envelope", {
      eventType: params.type,
      workspaceId: params.workspaceId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return;
  }

  const body = JSON.stringify(envelope);
  const endpoints = listWebhookEndpointsForWorkspace(params.workspaceId).filter(
    (endpoint) => endpoint.status === "enabled" && endpoint.subscribed_events.includes(params.type),
  );

  if (endpoints.length === 0) return;

  getLogger().info("Webhook event published", { eventType: params.type, workspaceId: params.workspaceId, subscriberCount: endpoints.length });

  for (const endpoint of endpoints) {
    deliverWithRetry({ endpoint, envelope, body }).catch((error: unknown) => {
      getLogger().error("Webhook delivery pipeline threw unexpectedly", {
        endpointId: endpoint.id,
        workspaceId: params.workspaceId,
        eventType: params.type,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }
}
