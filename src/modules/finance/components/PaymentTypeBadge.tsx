import { Badge } from "@/components/ui/Badge";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/core/enums/paymentType";

interface PaymentTypeBadgeProps {
  type: PaymentType;
  /**
   * Finance F2.1C-E-C-B: a Customer Deposit Application reversal is stored
   * as an ordinary payment_type "refund" row (reusing
   * recompute_invoice_balance's only existing subtraction mechanism — see
   * reverseDepositApplication's own doc comment) even though it is not a
   * Cash refund. Passing the row's own reference lets this badge tell the
   * two apart without widening the shared PaymentType enum for one display
   * case.
   */
  reference?: string | null;
}

/** A label, not a lifecycle state — one neutral tone throughout, except refund which is worth visually flagging. */
export function PaymentTypeBadge({ type, reference }: PaymentTypeBadgeProps) {
  if (type === "refund" && reference?.startsWith("deposit_application_reversal_of:")) {
    return <Badge tone="neutral">Deposit Reversal</Badge>;
  }
  return <Badge tone={type === "refund" ? "danger" : "neutral"}>{PAYMENT_TYPE_LABELS[type]}</Badge>;
}
