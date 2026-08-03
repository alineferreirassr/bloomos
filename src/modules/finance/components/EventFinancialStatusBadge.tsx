import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EVENT_FINANCIAL_STATUS_LABELS, type EventFinancialStatus } from "@/modules/finance/eventFinancialStatus";

const STATUS_TONES: Record<EventFinancialStatus, BadgeTone> = {
  no_contract: "neutral",
  awaiting_invoice: "outline",
  awaiting_deposit: "warning",
  deposit_partial: "warning",
  deposit_paid: "outline",
  balance_due: "outline",
  paid_in_full: "accent",
  overdue: "danger",
  refunded: "neutral",
  cancelled: "neutral",
};

export function EventFinancialStatusBadge({ status }: { status: EventFinancialStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{EVENT_FINANCIAL_STATUS_LABELS[status]}</Badge>;
}
