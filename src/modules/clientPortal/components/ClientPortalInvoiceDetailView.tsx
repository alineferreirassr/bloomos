"use client";

import { useEffect, useState } from "react";
import { getClientPortalInvoiceById, logClientPortalActivityForCurrentSession } from "@/lib/data";
import { getClientPortalReceiptForInvoice } from "@/modules/clientPortal/getClientPortalReceiptAction";
import { createClientPortalBalanceCheckoutAction, createClientPortalDepositCheckoutAction, getClientPortalInvoicePdfAction } from "@/modules/integrations/stripe/clientPortalPaymentActions";
import type { ClientPortalInvoiceWithPayments } from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PAYMENT_METHOD_LABELS } from "@/core/enums/paymentMethod";
import { ClientPortalInvoiceDocumentSection } from "@/modules/clientPortal/components/ClientPortalInvoiceDocumentSection";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; invoice: ClientPortalInvoiceWithPayments };

export function ClientPortalInvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [receiptState, setReceiptState] = useState<{ loading: boolean; text: string | null; error: string | null }>({ loading: false, text: null, error: null });
  const [depositAmount, setDepositAmount] = useState("");
  const [payState, setPayState] = useState<{ busy: "deposit" | "balance" | null; error: string | null }>({ busy: null, error: null });
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);

  const fetchInvoice = () =>
    getClientPortalInvoiceById(invoiceId)
      .then((invoice) => setState({ status: "ready", invoice }))
      .catch((err) => setState({ status: err instanceof NotFoundError ? "not-found" : "error" }));

  useEffect(() => {
    fetchInvoice();
    logClientPortalActivityForCurrentSession("invoice_viewed", invoiceId);
    getClientPortalInvoicePdfAction(invoiceId).then((result) => {
      if (result.success) setInvoicePdfUrl(result.url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  async function handleViewReceipt() {
    setReceiptState({ loading: true, text: null, error: null });
    const result = await getClientPortalReceiptForInvoice(invoiceId);
    if (!result.success) {
      setReceiptState({ loading: false, text: null, error: result.error });
      return;
    }
    setReceiptState({ loading: false, text: result.text ?? "No receipt has been generated for this invoice yet.", error: null });
  }

  async function handlePayDeposit() {
    const amountMinor = Math.round(Number(depositAmount) * 100);
    setPayState({ busy: "deposit", error: null });
    const origin = window.location.origin;
    const result = await createClientPortalDepositCheckoutAction(invoiceId, amountMinor, `${origin}${window.location.pathname}?payment=success`, `${origin}${window.location.pathname}?payment=cancelled`);
    if (!result.success) {
      setPayState({ busy: null, error: result.error });
      return;
    }
    window.location.href = result.url;
  }

  async function handlePayBalance() {
    setPayState({ busy: "balance", error: null });
    const origin = window.location.origin;
    const result = await createClientPortalBalanceCheckoutAction(invoiceId, `${origin}${window.location.pathname}?payment=success`, `${origin}${window.location.pathname}?payment=cancelled`);
    if (!result.success) {
      setPayState({ busy: null, error: result.error });
      return;
    }
    window.location.href = result.url;
  }

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

      {invoice.balance_minor > 0 ? (
        <Card>
          <h3 className="font-serif text-[15px] font-semibold text-text">Make a Payment</h3>
          <p className="mt-1 text-xs text-text-muted">Securely pay through Stripe — your card details are never seen by BloomOS.</p>

          {payState.error ? (
            <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">
              {payState.error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <FormField label={`Deposit amount (${invoice.currency.toUpperCase()})`} htmlFor="deposit-amount">
              <Input id="deposit-amount" type="number" min="1" step="0.01" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="0.00" className="w-32" />
            </FormField>
            <Button type="button" variant="secondary" disabled={payState.busy !== null || !depositAmount} onClick={handlePayDeposit}>
              {payState.busy === "deposit" ? "Redirecting…" : "Pay Deposit"}
            </Button>
            <Button type="button" disabled={payState.busy !== null} onClick={handlePayBalance}>
              {payState.busy === "balance" ? "Redirecting…" : `Pay Remaining Balance (${formatMoney(invoice.balance_minor, invoice.currency)})`}
            </Button>
          </div>
        </Card>
      ) : null}

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

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-[15px] font-semibold text-text">Receipt</h3>
          <div className="flex gap-2">
            {invoicePdfUrl ? (
              <Button type="button" variant="secondary" onClick={() => window.open(invoicePdfUrl, "_blank", "noopener,noreferrer")}>
                Download Invoice (PDF)
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={handleViewReceipt} disabled={receiptState.loading}>
              {receiptState.loading ? "Loading…" : "View Receipt"}
            </Button>
          </div>
        </div>
        {receiptState.error ? (
          <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
            {receiptState.error}
          </p>
        ) : receiptState.text ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border bg-text/5 p-3 text-xs text-text">{receiptState.text}</pre>
        ) : null}
      </Card>

      <ClientPortalInvoiceDocumentSection invoiceId={invoice.id} />
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
