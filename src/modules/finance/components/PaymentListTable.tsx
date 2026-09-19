import Link from "next/link";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";
import { PaymentMethodBadge } from "@/modules/finance/components/PaymentMethodBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { PaymentListRow } from "@/modules/finance/components/PaymentsListView";
import { getFullName } from "@/lib/personName";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

export function PaymentListTable({ rows }: { rows: PaymentListRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            {["Date", "Client", "Invoice", "Event", "Type", "Method", "Status", "Amount", "Reference"].map(
              (heading) => (
                <TableHeaderCell key={heading} className="whitespace-nowrap">
                  {heading}
                </TableHeaderCell>
              ),
            )}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ payment, client, event, invoice }) => (
            <TableRow key={payment.id}>
              <TableCell className="whitespace-nowrap">
                <Link href={`/finance/payments/${payment.id}`} className="font-medium text-text hover:text-accent">
                  {formatEventDate(payment.transaction_date)}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {invoice ? invoice.invoice_number : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </TableCell>
              <TableCell>
                <PaymentTypeBadge type={payment.payment_type} reference={payment.reference} />
              </TableCell>
              <TableCell>
                <PaymentMethodBadge method={payment.payment_method} />
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={payment.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium text-text">
                {formatMoney(payment.amount_minor, payment.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {payment.reference ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
