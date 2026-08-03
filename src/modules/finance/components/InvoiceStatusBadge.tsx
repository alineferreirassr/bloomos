import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/core/enums/invoiceStatus";

/* Same 3(+danger)-tone convention as ContractStatusBadge: paid (won) -> accent,
   overdue -> danger (the one status that needs to visually stand out), voided/
   archived (terminal/inactive) -> neutral, every other in-progress status -> outline. */
const STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  draft: "outline",
  issued: "outline",
  sent: "outline",
  viewed: "outline",
  partially_paid: "outline",
  paid: "accent",
  overdue: "danger",
  voided: "neutral",
  archived: "neutral",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
