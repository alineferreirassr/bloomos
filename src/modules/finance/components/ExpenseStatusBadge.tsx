import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EXPENSE_STATUS_LABELS, type ExpenseStatus } from "@/core/enums/expenseStatus";

const STATUS_TONES: Record<ExpenseStatus, BadgeTone> = {
  planned: "outline",
  approved: "outline",
  due: "outline",
  paid: "accent",
  reimbursed: "accent",
  cancelled: "neutral",
  archived: "neutral",
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>;
}
