import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";

/* Relationships/CRM visual pass — restrained semantic system: every
   in-progress stage stays "outline" (a single calm in-progress tone, not
   one color per stage), converted uses "success" (a won outcome is a
   semantic success state, not the rose brand accent — rose stays reserved
   for brand moments, not status), lost/archived stay "neutral". */
const STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  new: "outline",
  contacted: "outline",
  welcome_guide_sent: "outline",
  consultation_scheduled: "outline",
  qualified: "outline",
  proposal_sent: "outline",
  waiting_decision: "outline",
  converted: "success",
  lost: "neutral",
  archived: "neutral",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}
