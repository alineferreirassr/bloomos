import { Badge } from "@/components/ui/Badge";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/core/enums/expenseCategory";

/** A label, not a lifecycle state — one neutral tone across all 22 categories. */
export function ExpenseCategoryBadge({ category }: { category: ExpenseCategory }) {
  return <Badge tone="neutral">{EXPENSE_CATEGORY_LABELS[category]}</Badge>;
}
