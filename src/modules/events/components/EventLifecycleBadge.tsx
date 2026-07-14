import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EVENT_LIFECYCLE_STAGE_LABELS, type EventLifecycleStage } from "@/core/enums/eventLifecycleStage";

/* Same 3-tone convention as the status badge: closed (done) -> tag-neutral,
   every other in-progress stage -> tag-outline. No "won" concept applies to
   lifecycle stage, so tag-accent is unused here. */
const LIFECYCLE_TONES: Record<EventLifecycleStage, BadgeTone> = {
  intake: "outline",
  proposal: "outline",
  booking: "outline",
  planning: "outline",
  preparation: "outline",
  setup: "outline",
  execution: "outline",
  live_event: "outline",
  breakdown: "outline",
  post_event: "outline",
  closed: "neutral",
};

export function EventLifecycleBadge({ stage }: { stage: EventLifecycleStage }) {
  return <Badge tone={LIFECYCLE_TONES[stage]}>{EVENT_LIFECYCLE_STAGE_LABELS[stage]}</Badge>;
}
