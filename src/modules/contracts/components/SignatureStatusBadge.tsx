import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { SIGNATURE_STATUS_LABELS, type SignatureStatus } from "@/core/enums/signatureStatus";

/* Same restrained semantic system as ContractStatusBadge: signed ->
   success, declined/expired/cancelled -> neutral, everything still in
   progress (including partially_signed) -> outline. */
const SIGNATURE_TONES: Record<SignatureStatus, BadgeTone> = {
  unsigned: "outline",
  sent: "outline",
  viewed: "outline",
  partially_signed: "outline",
  signed: "success",
  declined: "neutral",
  expired: "neutral",
  cancelled: "neutral",
};

export function SignatureStatusBadge({ status }: { status: SignatureStatus }) {
  return <Badge tone={SIGNATURE_TONES[status]}>{SIGNATURE_STATUS_LABELS[status]}</Badge>;
}
