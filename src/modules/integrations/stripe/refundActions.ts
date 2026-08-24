"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPaymentById, refundPayment as refundBloomPayment } from "@/lib/data";
import { getStripeConnectionForWorkspace, getStripeProviderForWorkspace } from "@/core/integrations/providers/stripe/stripeClient";
import { getCoreAuditLogService } from "@/core/audit";
import type Stripe from "stripe";

const GENERIC_ACCESS_ERROR = "Refunds aren't available. You may not have access to this.";

export type RefundStripePaymentResult = { success: true; data: { stripeRefundId: string; status: string; bloomosRefundPaymentId: string } } | { success: false; error: string };

/** Real Stripe reasons only — never a free string passed straight to the API. */
const STRIPE_REFUND_REASONS = ["duplicate", "fraudulent", "requested_by_customer"] as const;
export type StripeRefundReason = (typeof STRIPE_REFUND_REASONS)[number];

/**
 * Refund Center (v2 Checkpoint 23, Step 9). Full or partial, with a real
 * reason and free-text notes, and a real audit trail. Never bypasses the
 * Finance module's own `refundPayment()` — the same function every
 * manual refund already uses, so the resulting BloomOS `Payment` row,
 * Invoice balance recompute (`applyPaymentToInvoice`), and Timeline entry
 * ("payment_refunded") are byte-for-byte the existing, already-tested
 * path, not a second, parallel refund bookkeeping mechanism.
 */
export async function refundStripePaymentAction(paymentId: string, amountMinor: number, reason?: StripeRefundReason, notes?: string): Promise<RefundStripePaymentResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("finance.refund")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const payment = await getPaymentById(paymentId).catch(() => null);
  if (!payment || payment.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (payment.payment_method !== "stripe") return { success: false, error: "This payment wasn't made through Stripe." };
  if (!payment.reference) return { success: false, error: "This payment has no Stripe reference to refund against." };
  if (reason && !STRIPE_REFUND_REASONS.includes(reason)) return { success: false, error: `"${reason}" isn't a reason Stripe accepts.` };

  const connection = getStripeConnectionForWorkspace(session.workspace.id);
  if (!connection) return { success: false, error: "This workspace has no Stripe connection." };

  let refund: Stripe.Refund;
  try {
    const provider = await getStripeProviderForWorkspace(session.workspace.id);
    refund = await provider.createRefund({ paymentIntentId: payment.reference, amountMinor, reason, metadata: { bloomos_payment_id: payment.id, notes: notes ?? "" } });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Stripe rejected this refund." };
  }

  // p_refund_payment_id is now a required, caller-supplied idempotency key
  // (Finance F2.1C-C-IDEMPOTENCY). This action has no retryable client
  // concept yet, so a fresh id per invocation preserves the exact behavior
  // it already had before the correction — same reasoning as
  // receivePurchaseItem's established p_receipt_event_id call site.
  const bloomResult = await refundBloomPayment(paymentId, amountMinor, crypto.randomUUID());
  if (!bloomResult.success) return { success: false, error: bloomResult.error };

  await getCoreAuditLogService().recordAuditEvent(session.workspace.id, {
    actor: session.membership.id,
    action: "payment.refunded",
    ownerType: "payment",
    ownerId: paymentId,
    before: { status: payment.status, amount_minor: payment.amount_minor },
    after: { stripe_refund_id: refund.id, refunded_amount_minor: amountMinor, reason: reason ?? null, notes: notes ?? null, stripe_connection_id: connection.id },
  });

  return { success: true, data: { stripeRefundId: refund.id, status: refund.status ?? "unknown", bloomosRefundPaymentId: bloomResult.data.id } };
}
