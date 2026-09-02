import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { InvoiceListRow } from "@/modules/finance/components/InvoicesListView";
import { getFullName } from "@/lib/personName";

export function InvoiceListCards({ rows }: { rows: InvoiceListRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ invoice, client, event, nextAction }) => (
        <Link key={invoice.id} href={`/finance/invoices/${invoice.id}`} className="block">
          <LuxuryCard className="transition-transform duration-150 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">{invoice.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{invoice.invoice_number}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {client ? getFullName(client) : "No client"}
                  {event ? ` · ${event.title}` : ""}
                </p>
              </div>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="font-medium text-text">{formatMoney(invoice.balance_minor, invoice.currency)} due</span>
              <span>of {formatMoney(invoice.total_minor, invoice.currency)}</span>
              {invoice.due_date ? <span>Due {formatEventDate(invoice.due_date)}</span> : null}
            </div>
            {nextAction ? <p className="mt-2 text-xs text-accent">{nextAction}</p> : null}
          </LuxuryCard>
        </Link>
      ))}
    </div>
  );
}
