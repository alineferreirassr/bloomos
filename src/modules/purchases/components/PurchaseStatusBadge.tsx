import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "@/core/enums/purchaseStatus";

const STATUS_TONES: Record<PurchaseStatus, BadgeTone> = {
  draft: "neutral",
  submitted: "outline",
  partially_received: "warning",
  fully_received: "success",
  cancelled: "danger",
  archived: "neutral",
};

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{PURCHASE_STATUS_LABELS[status]}</Badge>;
}
