import Link from "next/link";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";
import { PaymentMethodBadge } from "@/modules/finance/components/PaymentMethodBadge";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { PaymentListRow } from "@/modules/finance/components/PaymentsListView";
import { getFullName } from "@/lib/personName";

export function PaymentListTable({ rows }: { rows: PaymentListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            {["Date", "Client", "Invoice", "Event", "Type", "Method", "Status", "Amount", "Reference"].map(
              (heading) => (
                <th
                  key={heading}
                  className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ payment, client, event, invoice }) => (
            <tr key={payment.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4 whitespace-nowrap">
                <Link href={`/finance/payments/${payment.id}`} className="font-medium text-text hover:text-accent">
                  {formatEventDate(payment.transaction_date)}
                </Link>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {client ? getFullName(client) : "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {invoice ? invoice.invoice_number : "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {event ? event.title : "—"}
              </td>
              <td className="px-5 py-4">
                <PaymentTypeBadge type={payment.payment_type} reference={payment.reference} />
              </td>
              <td className="px-5 py-4">
                <PaymentMethodBadge method={payment.payment_method} />
              </td>
              <td className="px-5 py-4">
                <PaymentStatusBadge status={payment.status} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap font-medium text-text">
                {formatMoney(payment.amount_minor, payment.currency)}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {payment.reference ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
