import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { NOTE_PRIORITY_LABELS, type NotePriority } from "@/core/enums/notePriority";

const PRIORITY_TONES: Record<NotePriority, BadgeTone> = {
  low: "neutral",
  normal: "accent",
  high: "warning",
  critical: "danger",
};

export function NotePriorityBadge({ priority }: { priority: NotePriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{NOTE_PRIORITY_LABELS[priority]}</Badge>;
}
