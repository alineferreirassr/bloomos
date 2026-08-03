import type { WebhookEventType } from "@/types/webhookEvent";
import type { AutomationTriggerType } from "@/types/automation";

/**
 * v2 Checkpoint 23 — the exact seam `sdk.ts`'s own `WebhookProvider.mapInboundEvent`
 * doc comment anticipated: *"a future Stripe implementation maps
 * `payment_intent.succeeded` to `invoice.paid`."* This is that mapping,
 * from Stripe's own real `event.type` strings to BloomOS's internal
 * `WebhookEventType` (outbound) vocabulary — used both by
 * `StripeProvider.mapInboundEvent()` (the generic SDK contract) and
 * directly by the webhook route handler for the richer, dual dispatch
 * (Automation trigger + outbound webhook) a payment event needs.
 */
export const STRIPE_EVENT_TO_WEBHOOK_EVENT: Record<string, WebhookEventType> = {
  "checkout.session.completed": "payment.succeeded",
  "payment_intent.succeeded": "payment.succeeded",
  "payment_intent.payment_failed": "payment.failed",
  "invoice.paid": "invoice.paid",
  "invoice.payment_failed": "payment.failed",
  "charge.refunded": "payment.refunded",
  "customer.updated": "client.updated",
};

/** The exact real Stripe `event.type` strings this checkpoint's webhook handler subscribes to and processes — the spec's own Step 10 list. */
export const HANDLED_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "customer.updated",
  "customer.deleted",
] as const;
export type HandledStripeEventType = (typeof HANDLED_STRIPE_EVENT_TYPES)[number];

/** Which internal Automation trigger, if any, a handled Stripe event should dispatch — resolved per-event by the webhook processor once it knows the `PaymentType` (deposit vs. balance) from BloomOS's own `Payment` record, since Stripe itself has no concept of "deposit". `null` for events that update state but never fire a trigger (e.g. `customer.updated`). */
export const STRIPE_EVENT_BASE_TRIGGER: Partial<Record<HandledStripeEventType, AutomationTriggerType>> = {
  "payment_intent.payment_failed": "payment.failed",
  "invoice.payment_failed": "payment.failed",
  "charge.refunded": "refund.issued",
};

export function mapStripeEventToWebhookEvent(stripeEventType: string): WebhookEventType | null {
  return STRIPE_EVENT_TO_WEBHOOK_EVENT[stripeEventType] ?? null;
}
