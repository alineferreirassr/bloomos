import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ACCOUNTING_PERIOD_STATUS_LABELS, type AccountingPeriodStatus } from "@/core/enums/accountingPeriodStatus";

const STATUS_TONES: Record<AccountingPeriodStatus, BadgeTone> = {
  open: "accent",
  closed: "warning",
  locked: "danger",
};

export function AccountingPeriodStatusBadge({ status }: { status: AccountingPeriodStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{ACCOUNTING_PERIOD_STATUS_LABELS[status]}</Badge>;
}
