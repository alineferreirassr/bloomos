import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DOCUMENT_STATUS_LABELS, type DocumentStatus } from "@/core/enums/documentStatus";

const STATUS_TONES: Record<DocumentStatus, BadgeTone> = {
  draft: "outline",
  active: "accent",
  superseded: "neutral",
  expired: "danger",
  archived: "neutral",
  deleted: "danger",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>;
}
