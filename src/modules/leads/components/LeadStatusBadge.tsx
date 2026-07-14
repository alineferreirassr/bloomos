import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";

/* Matches the approved Leads.dc.html mapping exactly: converted -> tag-accent
   (won), lost -> tag-neutral, every other in-progress stage -> tag-outline.
   archived groups with lost as a terminal/inactive tone. */
const STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  new: "outline",
  contacted: "outline",
  welcome_guide_sent: "outline",
  consultation_scheduled: "outline",
  qualified: "outline",
  proposal_sent: "outline",
  converted: "accent",
  lost: "neutral",
  archived: "neutral",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}
