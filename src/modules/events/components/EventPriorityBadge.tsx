import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EVENT_PRIORITY_LABELS, type EventPriority } from "@/core/enums/eventPriority";

/* Relationships/CRM visual pass's restrained semantic system: low/normal
   recede (neutral), high draws attention without alarm (outline), urgent is
   a genuine warning state (warning), critical is the most severe (danger).
   Rose (accent) is reserved for brand moments, never priority. */
const PRIORITY_TONES: Record<EventPriority, BadgeTone> = {
  low: "neutral",
  normal: "neutral",
  high: "outline",
  urgent: "warning",
  critical: "danger",
};

export function EventPriorityBadge({ priority }: { priority: EventPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{EVENT_PRIORITY_LABELS[priority]}</Badge>;
}
