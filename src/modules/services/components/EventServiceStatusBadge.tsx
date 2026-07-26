import { Badge } from "@/components/ui/Badge";
import { EVENT_SERVICE_STATUS_LABELS, type EventServiceStatus } from "@/core/enums/eventServiceStatus";
import { EVENT_SERVICE_STATUS_TONES } from "@/modules/services/components/statusTones";

export function EventServiceStatusBadge({ status }: { status: EventServiceStatus }) {
  const tone = EVENT_SERVICE_STATUS_TONES[status];
  const label = EVENT_SERVICE_STATUS_LABELS[status];
  if (!tone || !label) throw new Error(`EventServiceStatusBadge received an unknown status: "${status}"`);
  return <Badge tone={tone}>{label}</Badge>;
}
