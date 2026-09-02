import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/core/enums/contractStatus";

/* Relationships/CRM visual pass — restrained semantic system: signed/
   completed (won) -> success (a real distinct hue), expired/cancelled/
   archived/declined (terminal/inactive) -> neutral, every other
   in-progress status -> outline. Rose stays reserved for brand moments,
   not status. */
const STATUS_TONES: Record<ContractStatus, BadgeTone> = {
  draft: "outline",
  review: "outline",
  ready: "outline",
  sent: "outline",
  viewed: "outline",
  signed: "success",
  completed: "success",
  expired: "neutral",
  cancelled: "neutral",
  archived: "neutral",
  declined: "neutral",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}
