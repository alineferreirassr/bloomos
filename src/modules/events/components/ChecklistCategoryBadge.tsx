import { Badge } from "@/components/ui/Badge";
import { CHECKLIST_CATEGORY_LABELS, type ChecklistCategory } from "@/core/enums/checklistCategory";

/* Neutral only — category is informational grouping, not a state to draw
   attention to (status and priority already carry that signal). */
export function ChecklistCategoryBadge({ category }: { category: ChecklistCategory }) {
  return <Badge tone="neutral">{CHECKLIST_CATEGORY_LABELS[category]}</Badge>;
}
