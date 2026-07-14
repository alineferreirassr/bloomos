import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/core/enums/leadStatus";

const STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  new: "neutral",
  contacted: "accent",
  welcome_guide_sent: "accent",
  consultation_scheduled: "accent",
  qualified: "success",
  proposal_sent: "success",
  converted: "success",
  lost: "danger",
  archived: "neutral",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}
