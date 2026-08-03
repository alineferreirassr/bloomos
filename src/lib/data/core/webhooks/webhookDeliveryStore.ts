import { generateId, nowIso } from "@/lib/data/utils";
import type { WebhookDelivery, WebhookDeliverySummary } from "@/types/webhookDelivery";

/**
 * Checkpoint 17, Step 8 — Delivery History. Mock-only, same rationale as
 * `webhookEndpointStore.ts`. A plain top-level `let` is safe for the same
 * reason — every write (the Dispatcher/Retry Engine) and every read (the
 * Developer Console's Deliveries tab) happen from Server Actions, never a
 * Route Handler.
 */
let deliveries: WebhookDelivery[] = [];

export function resetWebhookDeliveryStore(): void {
  deliveries = [];
}

export interface CreateWebhookDeliveryInput {
  workspace_id: string;
  endpoint_id: string;
  event_id: string;
  event_type: WebhookDelivery["event_type"];
  max_attempts: number;
  request_headers: Record<string, string>;
  request_body: string;
  replayed_from_delivery_id?: string | null;
  is_test?: boolean;
}

export function createWebhookDelivery(input: CreateWebhookDeliveryInput): WebhookDelivery {
  const now = nowIso();
  const delivery: WebhookDelivery = {
    id: generateId("webhook-delivery"),
    workspace_id: input.workspace_id,
    endpoint_id: input.endpoint_id,
    event_id: input.event_id,
    event_type: input.event_type,
    status: "pending",
    attempts: 0,
    max_attempts: input.max_attempts,
    last_status_code: null,
    last_duration_ms: null,
    last_error: null,
    request_headers: input.request_headers,
    request_body: input.request_body,
    response_headers: null,
    response_body_excerpt: null,
    created_at: now,
    updated_at: now,
    next_retry_at: null,
    replayed_from_delivery_id: input.replayed_from_delivery_id ?? null,
    is_test: input.is_test ?? false,
  };
  deliveries = [...deliveries, delivery];
  return delivery;
}

export function updateWebhookDelivery(id: string, patch: Partial<WebhookDelivery>): WebhookDelivery | null {
  const existing = deliveries.find((delivery) => delivery.id === id);
  if (!existing) return null;
  const updated: WebhookDelivery = { ...existing, ...patch, updated_at: nowIso() };
  deliveries = deliveries.map((delivery) => (delivery.id === id ? updated : delivery));
  return updated;
}

export function getWebhookDeliveryById(id: string): WebhookDelivery | null {
  return deliveries.find((delivery) => delivery.id === id) ?? null;
}

export function listWebhookDeliveriesForEndpoint(endpointId: string, limit = 50): WebhookDelivery[] {
  return deliveries
    .filter((delivery) => delivery.endpoint_id === endpointId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function listWebhookDeliveriesForWorkspace(workspaceId: string, limit = 200): WebhookDelivery[] {
  return deliveries
    .filter((delivery) => delivery.workspace_id === workspaceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/** Aggregates the same records the list functions above return — never a second, independently-maintained counter that could drift from the raw log, matching `apiUsageStore.ts`'s own `summarizeApiUsage()` precedent. */
export function summarizeWebhookDeliveries(workspaceId: string): WebhookDeliverySummary {
  const records = deliveries.filter((delivery) => delivery.workspace_id === workspaceId);
  const successCount = records.filter((delivery) => delivery.status === "success").length;
  const failureCount = records.filter((delivery) => delivery.status === "failed").length;
  const deadLetterCount = records.filter((delivery) => delivery.status === "dead_letter").length;
  const totalRetries = records.reduce((sum, delivery) => sum + Math.max(0, delivery.attempts - 1), 0);
  const replayCount = records.filter((delivery) => delivery.replayed_from_delivery_id !== null).length;
  const durations = records.map((delivery) => delivery.last_duration_ms).filter((value): value is number => value !== null);
  const averageDurationMs = durations.length === 0 ? 0 : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);

  const byEndpointMap = new Map<string, { endpointId: string; count: number; failureCount: number }>();
  for (const delivery of records) {
    const existing = byEndpointMap.get(delivery.endpoint_id) ?? { endpointId: delivery.endpoint_id, count: 0, failureCount: 0 };
    existing.count += 1;
    if (delivery.status === "failed" || delivery.status === "dead_letter") existing.failureCount += 1;
    byEndpointMap.set(delivery.endpoint_id, existing);
  }

  return {
    totalDeliveries: records.length,
    successCount,
    failureCount,
    deadLetterCount,
    totalRetries,
    replayCount,
    averageDurationMs,
    byEndpoint: [...byEndpointMap.values()].sort((a, b) => b.count - a.count),
  };
}
