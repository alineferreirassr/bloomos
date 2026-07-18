"use client";

import { useEffect, useState } from "react";
import { getClientPortalInvoiceById } from "@/lib/data";
import type { ClientPortalInvoiceWithPayments } from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PAYMENT_METHOD_LABELS } from "@/core/enums/paymentMethod";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; invoice: ClientPortalInvoiceWithPayments };

export function ClientPortalInvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchInvoice = () =>
    getClientPortalInvoiceById(invoiceId)
      .then((invoice) => setState({ status: "ready", invoice }))
      .catch((err) => setState({ status: err instanceof NotFoundError ? "not-found" : "error" }));

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "not-found") return <ErrorState message="This invoice could not be found." />;
  if (state.status === "error") return <ErrorState message="Could not load this invoice." onRetry={fetchInvoice} />;

  const { invoice } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{invoice.title}</h1>
        <InvoiceStatusBadge status={invoice.status} />
      </div>
      <p className="text-sm text-text-muted">{invoice.invoice_number}</p>

      <Card>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Issue date" value={invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : null} />
          <Field label="Due date" value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : null} />
          <Field label="Subtotal" value={formatMoney(invoice.subtotal_minor, invoice.currency)} />
          <Field label="Tax" value={formatMoney(invoice.tax_minor, invoice.currency)} />
          <Field label="Discount" value={formatMoney(invoice.discount_minor, invoice.currency)} />
          <Field label="Total" value={formatMoney(invoice.total_minor, invoice.currency)} />
          <Field label="Paid" value={formatMoney(invoice.paid_minor, invoice.currency)} />
          <Field label="Balance due" value={formatMoney(invoice.balance_minor, invoice.currency)} />
        </dl>
      </Card>

      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Payment History</h3>
        {invoice.payments.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <p className="text-text">{formatMoney(payment.amount_minor, payment.currency)}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(payment.transaction_date).toLocaleDateString()} · {PAYMENT_METHOD_LABELS[payment.payment_method]}
                  </p>
                </div>
                <PaymentStatusBadge status={payment.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
