import { Badge } from "@/components/ui/Badge";
import { SERVICE_STATUS_LABELS, type ServiceStatus } from "@/core/enums/serviceStatus";
import { SERVICE_STATUS_TONES } from "@/modules/services/components/statusTones";

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const tone = SERVICE_STATUS_TONES[status];
  const label = SERVICE_STATUS_LABELS[status];
  // TypeScript guarantees exhaustiveness at every real call site — this
  // guard exists for the one path it can't cover: a value that arrives
  // already cast to ServiceStatus (e.g. straight off an untrusted row)
  // without ever having been validated. Throwing surfaces that immediately
  // instead of silently rendering a blank badge.
  if (!tone || !label) throw new Error(`ServiceStatusBadge received an unknown status: "${status}"`);
  return <Badge tone={tone}>{label}</Badge>;
}
