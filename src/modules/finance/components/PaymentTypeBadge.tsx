import { Badge } from "@/components/ui/Badge";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/core/enums/paymentType";

/** A label, not a lifecycle state — one neutral tone throughout, except refund which is worth visually flagging. */
export function PaymentTypeBadge({ type }: { type: PaymentType }) {
  return <Badge tone={type === "refund" ? "danger" : "neutral"}>{PAYMENT_TYPE_LABELS[type]}</Badge>;
}
