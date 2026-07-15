import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { SIGNATURE_STATUS_LABELS, type SignatureStatus } from "@/core/enums/signatureStatus";

/* Same 3-tone convention as ContractStatusBadge: signed -> tag-accent,
   declined/expired/cancelled -> tag-neutral, everything still in progress
   (including partially_signed) -> tag-outline. */
const SIGNATURE_TONES: Record<SignatureStatus, BadgeTone> = {
  unsigned: "outline",
  sent: "outline",
  viewed: "outline",
  partially_signed: "outline",
  signed: "accent",
  declined: "neutral",
  expired: "neutral",
  cancelled: "neutral",
};

export function SignatureStatusBadge({ status }: { status: SignatureStatus }) {
  return <Badge tone={SIGNATURE_TONES[status]}>{SIGNATURE_STATUS_LABELS[status]}</Badge>;
}
