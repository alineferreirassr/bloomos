import Link from "next/link";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";
import { PaymentMethodBadge } from "@/modules/finance/components/PaymentMethodBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { PaymentListRow } from "@/modules/finance/components/PaymentsListView";

export function PaymentListTable({ rows }: { rows: PaymentListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {["Date", "Client", "Invoice", "Event", "Type", "Method", "Status", "Amount", "Reference"].map(
              (heading) => (
                <th
                  key={heading}
                  className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ payment, client, event, invoice }) => (
            <tr key={payment.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap">
                <Link href={`/finance/payments/${payment.id}`} className="font-medium text-text hover:text-accent">
                  {formatEventDate(payment.transaction_date)}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {client ? `${client.first_name} ${client.last_name}` : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {invoice ? invoice.invoice_number : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <PaymentTypeBadge type={payment.payment_type} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <PaymentMethodBadge method={payment.payment_method} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <PaymentStatusBadge status={payment.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap font-medium text-text">
                {formatMoney(payment.amount_minor, payment.currency)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {payment.reference ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
