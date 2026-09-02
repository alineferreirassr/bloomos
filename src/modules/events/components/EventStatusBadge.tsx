import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EVENT_STATUS_LABELS, type EventStatus } from "@/core/enums/eventStatus";

/* Relationships/CRM visual pass's restrained semantic system, carried into
   Events: completed (a won outcome) -> success (a real distinct hue, not the
   rose brand accent), cancelled/archived (terminal/inactive) -> neutral,
   every other in-progress status -> outline. */
const STATUS_TONES: Record<EventStatus, BadgeTone> = {
  draft: "outline",
  inquiry: "outline",
  awaiting_contract: "outline",
  awaiting_deposit: "outline",
  confirmed: "outline",
  planning: "outline",
  ready: "outline",
  in_progress: "outline",
  completed: "success",
  cancelled: "neutral",
  archived: "neutral",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{EVENT_STATUS_LABELS[status]}</Badge>;
}
