import type { WebhookEventType } from "@/types/webhookEvent";

/**
 * Checkpoint 17, Step 8 — Delivery History. One record per
 * (event, endpoint) delivery attempt-sequence — updated in place as the
 * Retry Engine (Step 5) works through attempts, never one row per
 * attempt, matching the spec's own "Attempts" field (a running count, not
 * a list of child rows). `request_body` stores the exact bytes sent, so
 * Replay (Step 9) resends the literal original payload rather than a
 * freshly re-serialized one — the same "replay resends what actually
 * happened" semantics Stripe/GitHub's own webhook replay already use.
 */
export const WEBHOOK_DELIVERY_STATUSES = ["pending", "retrying", "success", "failed", "dead_letter"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

export interface WebhookDelivery {
  id: string;
  workspace_id: string;
  endpoint_id: string;
  event_id: string;
  event_type: WebhookEventType | "webhook.test";
  status: WebhookDeliveryStatus;
  attempts: number;
  max_attempts: number;
  last_status_code: number | null;
  last_duration_ms: number | null;
  last_error: string | null;
  request_headers: Record<string, string>;
  request_body: string;
  response_headers: Record<string, string> | null;
  response_body_excerpt: string | null;
  created_at: string;
  updated_at: string;
  next_retry_at: string | null;
  /** Set on a delivery created by clicking "Replay" — points at the original delivery it resent. `null` for every ordinary, event-triggered delivery. */
  replayed_from_delivery_id: string | null;
  /** Set for a Developer Console "Test delivery" — a synthetic ping, never a real business event, kept in the same history so it's visible/debuggable but distinguishable from real traffic. */
  is_test: boolean;
}

export interface WebhookDeliverySummary {
  totalDeliveries: number;
  successCount: number;
  failureCount: number;
  deadLetterCount: number;
  totalRetries: number;
  replayCount: number;
  averageDurationMs: number;
  byEndpoint: { endpointId: string; count: number; failureCount: number }[];
}
