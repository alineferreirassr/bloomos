import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { PaymentListRow } from "@/modules/finance/components/PaymentsListView";
import { getFullName } from "@/lib/personName";

export function PaymentListCards({ rows }: { rows: PaymentListRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ payment, client, event, invoice }) => (
        <Link key={payment.id} href={`/finance/payments/${payment.id}`} className="block">
          <Card className="transition-colors duration-150 hover:border-accent/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">
                  {formatMoney(payment.amount_minor, payment.currency)}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{formatEventDate(payment.transaction_date)}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {client ? getFullName(client) : "No client"}
                  {event ? ` · ${event.title}` : ""}
                  {invoice ? ` · ${invoice.invoice_number}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <PaymentTypeBadge type={payment.payment_type} />
                <PaymentStatusBadge status={payment.status} />
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
