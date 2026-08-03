import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "@/core/enums/scheduleStatus";

/* Same 3-tone convention as ChecklistStatusBadge/EventStatusBadge: completed
   -> tag-accent, cancelled -> tag-neutral, every other in-progress status
   (including delayed, which is a warning-shaped state but has no separate
   palette in the approved system) -> tag-outline. */
const STATUS_TONES: Record<ScheduleStatus, BadgeTone> = {
  planned: "outline",
  confirmed: "outline",
  delayed: "outline",
  completed: "accent",
  cancelled: "neutral",
};

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{SCHEDULE_STATUS_LABELS[status]}</Badge>;
}
