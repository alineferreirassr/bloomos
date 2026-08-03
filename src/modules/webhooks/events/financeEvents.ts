import { registerWebhookEvent } from "@/core/webhooks/eventRegistry";
import type { WebhookPayloadSchema } from "@/types/webhookEvent";

const INVOICE_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    client_id: { type: "string" },
    status: { type: "string" },
    total_minor: { type: "integer" },
    balance_minor: { type: "integer" },
    currency: { type: "string" },
    issue_date: { type: "string" },
    due_date: { type: ["string", "null"] },
  },
};

const RECEIPT_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    invoice_id: { type: "string" },
    client_id: { type: "string" },
    title: { type: "string" },
    generated_at: { type: "string" },
  },
};

const PAYMENT_PAYLOAD_SCHEMA: WebhookPayloadSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    client_id: { type: "string" },
    invoice_id: { type: ["string", "null"] },
    status: { type: "string" },
    amount_minor: { type: "integer" },
    currency: { type: "string" },
    payment_method: { type: "string" },
  },
};

let registered = false;

/** Checkpoint 17, Step 6 — Finance's own 3 built-in events. v2 Checkpoint 23 adds 3 more, fired from the real Stripe webhook handler once BloomOS's own Payment record already reflects the change. */
export function registerFinanceWebhookEvents(): void {
  if (registered) return;
  registerWebhookEvent({ type: "invoice.created", category: "finance", name: "Invoice Created", description: "A new Invoice was issued.", version: 1, payloadSchema: INVOICE_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "invoice.paid", category: "finance", name: "Invoice Paid", description: "An Invoice's balance reached zero.", version: 1, payloadSchema: INVOICE_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "receipt.created", category: "finance", name: "Receipt Created", description: "A Receipt was generated for a payment.", version: 1, payloadSchema: RECEIPT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "payment.succeeded", category: "finance", name: "Payment Succeeded", description: "A Payment cleared successfully.", version: 1, payloadSchema: PAYMENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "payment.failed", category: "finance", name: "Payment Failed", description: "A Payment attempt failed.", version: 1, payloadSchema: PAYMENT_PAYLOAD_SCHEMA });
  registerWebhookEvent({ type: "payment.refunded", category: "finance", name: "Payment Refunded", description: "A Payment was fully or partially refunded.", version: 1, payloadSchema: PAYMENT_PAYLOAD_SCHEMA });
  registered = true;
}
