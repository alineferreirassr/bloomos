import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EVENT_PRIORITY_LABELS, type EventPriority } from "@/core/enums/eventPriority";

/* No separate warning/danger palette exists in the approved system (see
   docs/design-system.md), so priority is expressed within the same 3-tone
   scale: low/normal recede (tag-neutral), high/urgent draw attention without
   a fill (tag-outline), critical stands out most (tag-accent). */
const PRIORITY_TONES: Record<EventPriority, BadgeTone> = {
  low: "neutral",
  normal: "neutral",
  high: "outline",
  urgent: "outline",
  critical: "accent",
};

export function EventPriorityBadge({ priority }: { priority: EventPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{EVENT_PRIORITY_LABELS[priority]}</Badge>;
}
