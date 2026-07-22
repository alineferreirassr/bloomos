import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { VENDOR_STATUS_LABELS, type VendorStatus } from "@/core/enums/vendorStatus";

/* Same 2-tone convention as ClientStatusBadge/LeadStatusBadge: outline for active, neutral for inactive. */
const STATUS_TONES: Record<VendorStatus, BadgeTone> = {
  active: "outline",
  inactive: "neutral",
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{VENDOR_STATUS_LABELS[status]}</Badge>;
}
