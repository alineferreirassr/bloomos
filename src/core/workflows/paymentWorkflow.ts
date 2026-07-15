import {
  PAYMENT_STATUSES,
  TERMINAL_PAYMENT_STATUSES,
  PAYMENT_STATUSES_COUNTING_TOWARD_PAID,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/core/enums/paymentStatus";

export { PAYMENT_STATUSES, TERMINAL_PAYMENT_STATUSES, PAYMENT_STATUSES_COUNTING_TOWARD_PAID, PAYMENT_STATUS_LABELS };
export type { PaymentStatus };

/**
 * The canonical Payment lifecycle. `succeeded` is deliberately not
 * "terminal" — it can still move to `partially_refunded` or `refunded`
 * (see refundPayment in lib/data/index.ts), the same way a signed Contract
 * can still be cancelled. `pending`/`processing` are the only statuses
 * assigned outside their own dedicated action (on createPayment, depending
 * on `payment_method` — see the data layer).
 */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["processing", "succeeded", "failed", "cancelled"],
  processing: ["succeeded", "failed", "cancelled"],
  succeeded: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return false;
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Every status `from` can legally move to right now (empty once final). */
export function getNextPaymentStatuses(from: PaymentStatus): PaymentStatus[] {
  return PAYMENT_TRANSITIONS[from];
}

/** True once a Payment has nothing left to do — failed/refunded/cancelled. `succeeded`/`partially_refunded` are excluded: both remain refundable. */
export function isPaymentFinal(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

/** True for a Payment that has collected money and hasn't been fully refunded yet — the set refundPayment (lib/data/index.ts) will accept. */
export function isPaymentRefundable(status: PaymentStatus): boolean {
  return status === "succeeded" || status === "partially_refunded";
}

interface PaymentForNextAction {
  status: PaymentStatus;
}

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Payment — mirrors getContractNextRecommendedAction/
 * getInvoiceNextRecommendedAction. A settled Payment (succeeded,
 * partially_refunded, refunded, cancelled) needs no further action and gets
 * no suggestion; only the two still-moving statuses (pending, processing)
 * and the one that needs human follow-up (failed) get one.
 */
export function getPaymentNextRecommendedAction(payment: PaymentForNextAction): string | null {
  switch (payment.status) {
    case "pending":
      return "Confirm this payment, or mark it as processing";
    case "processing":
      return "Mark this payment succeeded once confirmed, or failed if it doesn't clear";
    case "failed":
      return "This payment failed — record a new payment attempt or follow up with the client";
    default:
      return null;
  }
}
