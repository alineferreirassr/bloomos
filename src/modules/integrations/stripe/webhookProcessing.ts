import type Stripe from "stripe";
import { createPayment, getInvoiceById, getPayments, markPaymentFailed, markPaymentSucceeded, refundPayment as refundBloomPayment } from "@/lib/data";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { publishIntegrationEvent } from "@/core/integrations/eventBus";
import { getCoreAuditLogService } from "@/core/audit";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import type { PaymentType } from "@/core/enums/paymentType";
import type { Payment } from "@/types/payment";
import type { IntegrationEventType } from "@/core/integrations/types";
import type { AutomationTriggerType } from "@/types/automation";

/**
 * The Stripe webhook processing core (v2 Checkpoint 23, Steps 8/10/11/12/15).
 * Every "money moved" handler follows the same shape: update BloomOS's
 * own `Payment`/`Invoice` records through the *existing*, already-tested
 * Finance repository functions (never a second, parallel bookkeeping
 * path), then fan out to the Event Bus and Automation Engine from the
 * *resulting* BloomOS state — never straight from the raw Stripe
 * payload. CRM integration (Step 12) needs no new code here at all:
 * `createPayment`/`markPaymentSucceeded`/`markPaymentFailed`/
 * `refundPayment` already call `recordTimelineActivity` internally.
 *
 * Idempotency: a successful Checkout payment fires *both*
 * `checkout.session.completed` and `payment_intent.succeeded` — both
 * carry the same real `payment_intent` id (metadata is copied onto the
 * PaymentIntent at session-creation time specifically so this holds).
 * `findExistingPaymentByReference` is checked before ever creating a new
 * `Payment` row, so processing the same real payment twice (whether from
 * Stripe's own dual events or a redelivered webhook) never double-books
 * it.
 */

interface BloomMetadata {
  workspaceId: string;
  clientId: string;
  invoiceId: string | null;
  eventId: string | null;
  paymentType: PaymentType;
}

function readBloomMetadata(metadata: Stripe.Metadata | null | undefined): BloomMetadata | null {
  if (!metadata?.bloomos_workspace_id || !metadata.bloomos_client_id || !metadata.bloomos_payment_type) return null;
  return {
    workspaceId: metadata.bloomos_workspace_id,
    clientId: metadata.bloomos_client_id,
    invoiceId: metadata.bloomos_invoice_id || null,
    eventId: metadata.bloomos_event_id || null,
    paymentType: metadata.bloomos_payment_type as PaymentType,
  };
}

async function findExistingPaymentByReference(workspaceId: string, clientId: string, reference: string): Promise<Payment | null> {
  const payments = await getPayments({ clientId });
  return payments.find((payment) => payment.workspace_id === workspaceId && payment.reference === reference) ?? null;
}

const DEPOSIT_TRIGGER: Record<string, AutomationTriggerType> = {
  deposit: "deposit.paid",
  final_payment: "balance.paid",
  full_payment: "balance.paid",
  installment: "balance.paid",
};

async function dispatchPaymentEvent(type: IntegrationEventType, triggerType: AutomationTriggerType | null, workspaceId: string, payment: Payment): Promise<void> {
  publishIntegrationEvent({
    type,
    workspaceId,
    resourceId: payment.id,
    payload: { id: payment.id, client_id: payment.client_id, invoice_id: payment.invoice_id, status: payment.status, amount_minor: payment.amount_minor, currency: payment.currency, payment_method: payment.payment_method },
  });

  const facts: Record<string, string | number | boolean | null> = {
    paymentId: payment.id,
    invoiceId: payment.invoice_id,
    clientId: payment.client_id,
    eventId: payment.event_id,
    amountMinor: payment.amount_minor,
    currency: payment.currency,
    paymentType: payment.payment_type,
  };

  await dispatchAutomationTrigger(
    { type: "payment.received", workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts },
    { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
  ).catch((error: unknown) => getLogger().error("payment.received trigger dispatch failed", { workspaceId, error: error instanceof Error ? error.message : "Unknown error" }));

  if (triggerType) {
    await dispatchAutomationTrigger(
      { type: triggerType, workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts },
      { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
    ).catch((error: unknown) => getLogger().error(`${triggerType} trigger dispatch failed`, { workspaceId, error: error instanceof Error ? error.message : "Unknown error" }));
  }

  if (payment.invoice_id) {
    const invoice = await getInvoiceById(payment.invoice_id).catch(() => null);
    if (invoice?.status === "paid") {
      await dispatchAutomationTrigger(
        { type: "invoice.paid", workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts: { invoiceId: invoice.id, clientId: invoice.client_id, totalMinor: invoice.total_minor } },
        { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
      ).catch((error: unknown) => getLogger().error("invoice.paid trigger dispatch failed", { workspaceId, error: error instanceof Error ? error.message : "Unknown error" }));
    }
  }
}

async function handleMoneyReceived(paymentIntentId: string, amountMinor: number, currency: string, meta: BloomMetadata): Promise<Payment> {
  const existing = await findExistingPaymentByReference(meta.workspaceId, meta.clientId, paymentIntentId);
  if (existing) {
    if (existing.status === "succeeded") return existing;
    const succeeded = await markPaymentSucceeded(existing.id);
    if (!succeeded.success) throw new Error(succeeded.error);
    return succeeded.data;
  }

  const created = await createPayment({
    invoice_id: meta.invoiceId,
    client_id: meta.clientId,
    event_id: meta.eventId,
    contract_id: null,
    payment_type: meta.paymentType,
    amount_minor: amountMinor,
    currency,
    payment_method: "stripe",
    reference: paymentIntentId,
    transaction_date: clockNow().toISOString().slice(0, 10),
    notes: `Received via Stripe (${paymentIntentId}).`,
  });
  if (!created.success) throw new Error(created.error);

  const succeeded = await markPaymentSucceeded(created.data.id);
  if (!succeeded.success) throw new Error(succeeded.error);
  return succeeded.data;
}

async function handleMoneyFailed(paymentIntentId: string, amountMinor: number, currency: string, meta: BloomMetadata): Promise<Payment> {
  const existing = await findExistingPaymentByReference(meta.workspaceId, meta.clientId, paymentIntentId);
  if (existing) {
    if (existing.status === "failed") return existing;
    const failedExisting = await markPaymentFailed(existing.id);
    return failedExisting.success ? failedExisting.data : existing;
  }

  const created = await createPayment({
    invoice_id: meta.invoiceId,
    client_id: meta.clientId,
    event_id: meta.eventId,
    contract_id: null,
    payment_type: meta.paymentType,
    amount_minor: amountMinor,
    currency,
    payment_method: "stripe",
    reference: paymentIntentId,
    transaction_date: clockNow().toISOString().slice(0, 10),
    notes: `Failed via Stripe (${paymentIntentId}).`,
  });
  if (!created.success) throw new Error(created.error);
  const failed = await markPaymentFailed(created.data.id);
  if (!failed.success) throw new Error(failed.error);
  return failed.data;
}

export interface ProcessStripeWebhookEventResult {
  handled: boolean;
  summary: string;
}

export async function processStripeWebhookEvent(workspaceId: string, connectionId: string, event: Stripe.Event): Promise<ProcessStripeWebhookEventResult> {
  const logContext = { workspaceId, connectionId, eventId: event.id, eventType: event.type };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = readBloomMetadata(session.metadata);
      if (!meta || session.payment_status !== "paid" || typeof session.payment_intent !== "string") {
        getLogger().warn("checkout.session.completed missing BloomOS metadata or not paid — ignored", logContext);
        return { handled: false, summary: "No BloomOS metadata or session not paid." };
      }
      const payment = await handleMoneyReceived(session.payment_intent, session.amount_total ?? 0, session.currency ?? "usd", meta);
      await dispatchPaymentEvent("payment.succeeded", DEPOSIT_TRIGGER[meta.paymentType] ?? null, meta.workspaceId, payment);
      return { handled: true, summary: `Payment ${payment.id} recorded succeeded.` };
    }

    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const meta = readBloomMetadata(intent.metadata);
      if (!meta) {
        getLogger().warn("payment_intent.succeeded missing BloomOS metadata — ignored", logContext);
        return { handled: false, summary: "No BloomOS metadata." };
      }
      const payment = await handleMoneyReceived(intent.id, intent.amount_received || intent.amount, intent.currency, meta);
      await dispatchPaymentEvent("payment.succeeded", DEPOSIT_TRIGGER[meta.paymentType] ?? null, meta.workspaceId, payment);
      return { handled: true, summary: `Payment ${payment.id} recorded succeeded.` };
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const meta = readBloomMetadata(intent.metadata);
      if (!meta) {
        getLogger().warn("payment_intent.payment_failed missing BloomOS metadata — ignored", logContext);
        return { handled: false, summary: "No BloomOS metadata." };
      }
      const payment = await handleMoneyFailed(intent.id, intent.amount, intent.currency, meta);
      await dispatchPaymentEvent("payment.failed", "payment.failed", meta.workspaceId, payment);
      return { handled: true, summary: `Payment ${payment.id} recorded failed.` };
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const meta = readBloomMetadata(invoice.metadata);
      const paymentIntentId = typeof invoice.payments?.data?.[0]?.payment?.payment_intent === "string" ? invoice.payments.data[0].payment.payment_intent : invoice.id;
      if (!meta || !paymentIntentId) {
        getLogger().warn("invoice.paid missing BloomOS metadata — ignored", logContext);
        return { handled: false, summary: "No BloomOS metadata." };
      }
      const payment = await handleMoneyReceived(paymentIntentId, invoice.amount_paid, invoice.currency, meta);
      await dispatchPaymentEvent("payment.succeeded", DEPOSIT_TRIGGER[meta.paymentType] ?? null, meta.workspaceId, payment);
      return { handled: true, summary: `Payment ${payment.id} recorded succeeded from Stripe Invoice.` };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const meta = readBloomMetadata(invoice.metadata);
      if (!meta) {
        getLogger().warn("invoice.payment_failed missing BloomOS metadata — ignored", logContext);
        return { handled: false, summary: "No BloomOS metadata." };
      }
      const payment = await handleMoneyFailed(invoice.id ?? event.id, invoice.amount_due, invoice.currency, meta);
      await dispatchPaymentEvent("payment.failed", "payment.failed", meta.workspaceId, payment);
      return { handled: true, summary: `Payment ${payment.id} recorded failed from Stripe Invoice.` };
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (!paymentIntentId) {
        getLogger().warn("charge.refunded has no payment_intent — ignored", logContext);
        return { handled: false, summary: "No payment_intent on charge." };
      }
      const payments = await getPayments({});
      const original = payments.find((payment) => payment.workspace_id === workspaceId && payment.reference === paymentIntentId);
      if (!original) {
        getLogger().warn("charge.refunded references an unknown payment — ignored", logContext);
        return { handled: false, summary: "No matching BloomOS payment found." };
      }
      // Already reconciled by our own Refund Center (Step 9) — a webhook is only a backstop for a refund issued directly in the Stripe Dashboard.
      if (original.status === "refunded" || original.status === "partially_refunded") {
        return { handled: true, summary: `Payment ${original.id} already reconciled — no-op.` };
      }
      // p_refund_payment_id is now a required, caller-supplied idempotency key
      // (Finance F2.1C-C-IDEMPOTENCY). This handler has no existing webhook-
      // event dedup of its own to derive a stable key from, so a fresh id
      // per invocation preserves the exact behavior this call already had
      // before the correction (each processed webhook delivery is its own
      // distinct refund attempt) — same reasoning as receivePurchaseItem's
      // established p_receipt_event_id call site.
      const result = await refundBloomPayment(original.id, charge.amount_refunded, crypto.randomUUID());
      if (!result.success) throw new Error(result.error);
      await dispatchPaymentEvent("payment.refunded", "refund.issued", workspaceId, result.data);
      return { handled: true, summary: `Payment ${original.id} refunded from a real Stripe Dashboard refund.` };
    }

    case "customer.updated":
    case "customer.deleted": {
      // Informational only — BloomOS's own Client record stays the source of truth; never written back to from Stripe.
      await getCoreAuditLogService().recordAuditEvent(workspaceId, {
        actor: "stripe-webhook",
        action: `stripe.${event.type}`,
        ownerType: "integration_connection",
        ownerId: connectionId,
        before: null,
        after: { stripe_event_id: event.id, object_id: (event.data.object as { id?: string }).id ?? null },
      });
      return { handled: true, summary: `${event.type} acknowledged (informational only).` };
    }

    default:
      getLogger().info("Unhandled Stripe event type received", logContext);
      return { handled: false, summary: `Unhandled event type: ${event.type}.` };
  }
}
