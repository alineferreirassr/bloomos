import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CHECKLIST_STATUS_LABELS, type ChecklistStatus } from "@/core/enums/checklistStatus";

/* Same 3-tone convention as EventStatusBadge: completed -> tag-accent,
   cancelled -> tag-neutral, every other in-progress status -> tag-outline. */
const STATUS_TONES: Record<ChecklistStatus, BadgeTone> = {
  pending: "outline",
  in_progress: "outline",
  blocked: "outline",
  completed: "accent",
  cancelled: "neutral",
};

export function ChecklistStatusBadge({ status }: { status: ChecklistStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{CHECKLIST_STATUS_LABELS[status]}</Badge>;
}
