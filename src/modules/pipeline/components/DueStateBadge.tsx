import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DUE_STATE_LABELS, type DueState } from "@/core/workflows/dueState";

const DUE_STATE_TONES: Record<Exclude<DueState, null>, BadgeTone> = {
  overdue: "danger",
  due_today: "warning",
  due_tomorrow: "outline",
};

/** Renders nothing when there's no due-state — color is never the only signal (label text always accompanies the tone). */
export function DueStateBadge({ dueState }: { dueState: DueState }) {
  if (!dueState) return null;
  return <Badge tone={DUE_STATE_TONES[dueState]}>{DUE_STATE_LABELS[dueState]}</Badge>;
}
