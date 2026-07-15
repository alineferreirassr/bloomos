import { Badge } from "@/components/ui/Badge";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/core/enums/paymentMethod";

/** A label, not a lifecycle state — one neutral tone throughout. */
export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return <Badge tone="neutral">{PAYMENT_METHOD_LABELS[method]}</Badge>;
}
