import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { EventHealthStatus } from "@/core/workflows/eventHealth";

const HEALTH_TONES: Record<EventHealthStatus, BadgeTone> = {
  ready: "success",
  waiting: "warning",
  blocked: "danger",
};

const HEALTH_LABELS: Record<EventHealthStatus, string> = {
  ready: "Ready",
  waiting: "Needs attention",
  blocked: "Blocked",
};

/** Compact card-sized rendering of getEventHealthStatus()'s output — the full score/factor breakdown belongs on EventHealthCard (Event Detail), not a Kanban card. */
export function OperationalHealthBadge({ status }: { status: EventHealthStatus }) {
  return <Badge tone={HEALTH_TONES[status]}>{HEALTH_LABELS[status]}</Badge>;
}
