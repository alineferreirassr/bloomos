"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWebhookEndpointById } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { getWebhookDeliveryById, listWebhookDeliveriesForWorkspace } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { deliverWithRetry } from "@/core/webhooks/retryEngine";
import { listDeadLetterDeliveries } from "@/core/webhooks/deadLetterQueue";
import { getLogger } from "@/core/observability/logger";
import type { WebhookDelivery } from "@/types/webhookDelivery";

const GENERIC_ACCESS_ERROR = "The Developer Console isn't available. You may not have access to it.";

export type ManageWebhookDeliveriesResult<T> = { success: true; data: T } | { success: false; error: string };

export async function listWebhookDeliveriesAction(): Promise<ManageWebhookDeliveriesResult<WebhookDelivery[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  return { success: true, data: listWebhookDeliveriesForWorkspace(session.workspace.id) };
}

/**
 * Checkpoint 17, Step 9 — Replay. Resends the *literal* `request_body`
 * bytes the original delivery stored (never a freshly rebuilt envelope —
 * see `types/webhookDelivery.ts`'s own doc comment), through the same
 * Dispatcher/Retry Engine, producing a brand-new `WebhookDelivery` record
 * linked back via `replayed_from_delivery_id`. The original record is
 * never mutated — history is append-only.
 */
export async function replayWebhookDeliveryAction(deliveryId: string): Promise<ManageWebhookDeliveriesResult<{ deliveryId: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const original = getWebhookDeliveryById(deliveryId);
  if (!original || original.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const endpoint = getWebhookEndpointById(original.endpoint_id);
  if (!endpoint) return { success: false, error: "This delivery's Webhook Endpoint no longer exists." };

  getLogger().info("Webhook delivery replay requested", { workspaceId: session.workspace.id, originalDeliveryId: deliveryId, endpointId: endpoint.id });

  const replayed = await deliverWithRetry({
    endpoint,
    envelope: { id: original.event_id, event: original.event_type },
    body: original.request_body,
    replayedFromDeliveryId: deliveryId,
    isTest: original.is_test,
  });

  return { success: true, data: { deliveryId: replayed.id } };
}

/**
 * v2 Checkpoint 22, Step 7 — bulk Replay for the whole Dead Letter Queue,
 * one operator action instead of clicking Replay per row. Reuses
 * `replayWebhookDeliveryAction` for each delivery rather than
 * re-implementing the same auth check and `deliverWithRetry` call — one
 * delivery's replay failing never stops the rest from being attempted.
 */
export async function replayAllDeadLetterDeliveriesAction(): Promise<ManageWebhookDeliveriesResult<{ replayedCount: number; failedCount: number }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const deadLetterDeliveries = listDeadLetterDeliveries(session.workspace.id);
  let replayedCount = 0;
  let failedCount = 0;
  for (const delivery of deadLetterDeliveries) {
    const result = await replayWebhookDeliveryAction(delivery.id);
    if (result.success) replayedCount += 1;
    else failedCount += 1;
  }

  return { success: true, data: { replayedCount, failedCount } };
}
