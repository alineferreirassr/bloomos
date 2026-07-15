import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/core/enums/paymentStatus";

const STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  pending: "outline",
  processing: "outline",
  succeeded: "accent",
  failed: "danger",
  partially_refunded: "warning",
  refunded: "neutral",
  cancelled: "neutral",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
