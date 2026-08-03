import { listWebhookDeliveriesForWorkspace } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import type { WebhookDelivery } from "@/types/webhookDelivery";

/**
 * The Dead Letter Queue read (v2 Checkpoint 22, Step 7 — "Extend Webhook
 * Engine"). Never a second store: `dead_letter` has been a real, terminal
 * `WebhookDelivery.status` since Checkpoint 17's own Retry Engine (see
 * `core/webhooks/retryEngine.ts`'s own doc comment — "a real terminal
 * `dead_letter` status once every attempt is exhausted"), and Replay
 * (`replayWebhookDeliveryAction`) already existed to resend one. What
 * didn't exist is a dedicated *queue* read — every prior caller filtered
 * the full delivery history table by eye. This is that filter, formalized
 * into its own function so the Developer Console's Dead Letter Queue view
 * and a future Integration Dashboard card both read the exact same list.
 */
export function listDeadLetterDeliveries(workspaceId: string): WebhookDelivery[] {
  return listWebhookDeliveriesForWorkspace(workspaceId).filter((delivery) => delivery.status === "dead_letter");
}
