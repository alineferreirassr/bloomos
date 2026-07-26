import Link from "next/link";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { InvoiceListRow } from "@/modules/finance/components/InvoicesListView";
import { getFullName } from "@/lib/personName";

export function InvoiceListTable({ rows }: { rows: InvoiceListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
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
                className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ invoice, client, event, contract, nextAction }) => (
            <tr key={invoice.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                <Link href={`/finance/invoices/${invoice.id}`} className="font-medium text-text hover:text-accent">
                  {invoice.invoice_number}
                </Link>
                <div className="text-xs text-text-muted">{invoice.title}</div>
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {contract ? contract.contract_number : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatEventDate(invoice.issue_date)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatEventDate(invoice.due_date)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatMoney(invoice.total_minor, invoice.currency)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatMoney(invoice.paid_minor, invoice.currency)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium text-text">
                {formatMoney(invoice.balance_minor, invoice.currency)}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
