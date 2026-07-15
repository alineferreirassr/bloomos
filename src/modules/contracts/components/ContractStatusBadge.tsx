import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/core/enums/contractStatus";

/* Same 3-tone convention as EventStatusBadge: signed/completed (won) ->
   tag-accent, expired/cancelled/archived/declined (terminal/inactive) ->
   tag-neutral, every other in-progress status -> tag-outline. */
const STATUS_TONES: Record<ContractStatus, BadgeTone> = {
  draft: "outline",
  review: "outline",
  ready: "outline",
  sent: "outline",
  viewed: "outline",
  signed: "accent",
  completed: "accent",
  expired: "neutral",
  cancelled: "neutral",
  archived: "neutral",
  declined: "neutral",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}
