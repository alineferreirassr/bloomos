import { Badge } from "@/components/ui/Badge";
import { SCHEDULE_CATEGORY_LABELS, type ScheduleCategory } from "@/core/enums/scheduleCategory";

/* Neutral only — category is informational grouping, not a state to draw
   attention to (status already carries that signal). Same convention as
   ChecklistCategoryBadge. */
export function ScheduleCategoryBadge({ category }: { category: ScheduleCategory }) {
  return <Badge tone="neutral">{SCHEDULE_CATEGORY_LABELS[category]}</Badge>;
}
