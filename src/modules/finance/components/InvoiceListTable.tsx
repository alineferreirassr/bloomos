import Link from "next/link";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { InvoiceListRow } from "@/modules/finance/components/InvoicesListView";
import { getFullName } from "@/lib/personName";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

export function InvoiceListTable({ rows }: { rows: InvoiceListRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
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
              <TableHeaderCell key={heading} className="whitespace-nowrap">
                {heading}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ invoice, client, event, contract, nextAction }) => (
            <TableRow key={invoice.id}>
              <TableCell className="whitespace-nowrap">
                <Link href={`/finance/invoices/${invoice.id}`} className="font-medium text-text hover:text-accent">
                  {invoice.invoice_number}
                </Link>
                <div className="text-xs text-text-muted">{invoice.title}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {contract ? contract.contract_number : "—"}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatEventDate(invoice.issue_date)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatEventDate(invoice.due_date)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatMoney(invoice.total_minor, invoice.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatMoney(invoice.paid_minor, invoice.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium text-text">
                {formatMoney(invoice.balance_minor, invoice.currency)}
              </TableCell>
              <TableCell className="text-text-muted">{nextAction ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
