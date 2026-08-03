import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EVENT_STATUS_LABELS, type EventStatus } from "@/core/enums/eventStatus";

/* Same 3-tone convention as LeadStatusBadge/ClientStatusBadge: completed (won) ->
   tag-accent, cancelled/archived (terminal/inactive) -> tag-neutral, every other
   in-progress status -> tag-outline. */
const STATUS_TONES: Record<EventStatus, BadgeTone> = {
  draft: "outline",
  inquiry: "outline",
  awaiting_contract: "outline",
  awaiting_deposit: "outline",
  confirmed: "outline",
  planning: "outline",
  ready: "outline",
  in_progress: "outline",
  completed: "accent",
  cancelled: "neutral",
  archived: "neutral",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{EVENT_STATUS_LABELS[status]}</Badge>;
}
