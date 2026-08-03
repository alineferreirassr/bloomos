export const PAYMENT_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "partially_refunded",
  "refunded",
  "cancelled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  succeeded: "Succeeded",
  failed: "Failed",
  partially_refunded: "Partially Refunded",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/**
 * Only a `succeeded` Payment (whole or partially refunded — the net amount
 * still collected counts) contributes to an Invoice's paid_minor total.
 * `pending`/`processing` haven't cleared yet; `failed`/`cancelled` never
 * will. See lib/data/index.ts's applyPaymentToInvoice for where this is
 * enforced.
 */
export const PAYMENT_STATUSES_COUNTING_TOWARD_PAID: PaymentStatus[] = [
  "succeeded",
  "partially_refunded",
  "refunded",
];

/** Statuses with nothing left to do — no further transition is legal from any of these. */
export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = ["failed", "refunded", "cancelled"];
