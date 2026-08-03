import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { POSTING_STATUS_LABELS, type PostingStatus } from "@/core/enums/postingStatus";

const STATUS_TONES: Record<PostingStatus, BadgeTone> = {
  pending: "outline",
  posted: "accent",
  failed: "danger",
  reversed: "neutral",
};

export function PostingStatusBadge({ status }: { status: PostingStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{POSTING_STATUS_LABELS[status]}</Badge>;
}
