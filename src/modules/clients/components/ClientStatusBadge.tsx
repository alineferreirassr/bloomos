import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/core/enums/clientStatus";

/* Same 3-tone system as LeadStatusBadge: outline for an active/ongoing
   relationship, neutral for inactive/past/archived. */
const STATUS_TONES: Record<ClientStatus, BadgeTone> = {
  active: "outline",
  planning: "outline",
  past_client: "neutral",
  inactive: "neutral",
  archived: "neutral",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{CLIENT_STATUS_LABELS[status]}</Badge>;
}
