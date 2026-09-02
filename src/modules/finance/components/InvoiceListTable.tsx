import Link from "next/link";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { InvoiceListRow } from "@/modules/finance/components/InvoicesListView";
import { getFullName } from "@/lib/personName";

export function InvoiceListTable({ rows }: { rows: InvoiceListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            {[
              "Invoice number",
              "Client",
              "Event",
              "Contract",
              "Status",
              "Issue date",
              "Due date",
              "Total",
              "Paid",
              "Balance",
              "Next action",
            ].map((heading) => (
              <th
                key={heading}
                className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ invoice, client, event, contract, nextAction }) => (
            <tr key={invoice.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4 whitespace-nowrap">
                <Link href={`/finance/invoices/${invoice.id}`} className="font-medium text-text hover:text-accent">
                  {invoice.invoice_number}
                </Link>
                <div className="text-xs text-text-muted">{invoice.title}</div>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {contract ? contract.contract_number : "—"}
              </td>
              <td className="px-5 py-4">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatEventDate(invoice.issue_date)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatEventDate(invoice.due_date)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatMoney(invoice.total_minor, invoice.currency)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatMoney(invoice.paid_minor, invoice.currency)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap font-medium text-text">
                {formatMoney(invoice.balance_minor, invoice.currency)}
              </td>
              <td className="px-5 py-4 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
