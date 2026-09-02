import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CHECKLIST_STATUS_LABELS, type ChecklistStatus } from "@/core/enums/checklistStatus";

/* Same restrained system as EventStatusBadge: completed -> success,
   cancelled -> neutral, blocked is a genuine attention state -> warning,
   everything else still moving -> outline. */
const STATUS_TONES: Record<ChecklistStatus, BadgeTone> = {
  pending: "outline",
  in_progress: "outline",
  blocked: "warning",
  completed: "success",
  cancelled: "neutral",
};

export function ChecklistStatusBadge({ status }: { status: ChecklistStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{CHECKLIST_STATUS_LABELS[status]}</Badge>;
}
