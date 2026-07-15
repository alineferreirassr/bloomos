"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createPaymentNote,
  getClientById,
  getContract,
  getEventById,
  getInvoiceById,
  getNotesByPaymentId,
  getPaymentById,
  getPaymentNextAction,
  getPaymentRefundableAmount,
  getTimelineByPaymentId,
  togglePinNote,
} from "@/lib/data";
import type { Payment } from "@/types/payment";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { formatEventDate } from "@/modules/events/dateFormat";
import { formatMoney, subtractMinor } from "@/lib/money";
import { isPaymentFinal } from "@/core/workflows/paymentWorkflow";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";
import { PaymentMethodBadge } from "@/modules/finance/components/PaymentMethodBadge";
import { PaymentActions } from "@/modules/finance/components/PaymentActions";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      payment: Payment;
      client: Client | null;
      invoice: Invoice | null;
      event: Event | null;
      contract: Contract | null;
      refundableMinor: number;
      notes: Note[];
      timeline: TimelineActivity[];
      nextAction: string | null;
    };

async function loadPaymentDetail(paymentId: string): Promise<LoadState> {
  try {
    const payment = await getPaymentById(paymentId);
    const [client, invoice, event, contract, refundableMinor, notes, timeline, nextAction] = await Promise.all([
      getClientById(payment.client_id).catch(() => null),
      payment.invoice_id ? getInvoiceById(payment.invoice_id).catch(() => null) : Promise.resolve(null),
      payment.event_id ? getEventById(payment.event_id).catch(() => null) : Promise.resolve(null),
      payment.contract_id ? getContract(payment.contract_id).catch(() => null) : Promise.resolve(null),
      getPaymentRefundableAmount(paymentId),
      getNotesByPaymentId(paymentId),
      getTimelineByPaymentId(paymentId),
      getPaymentNextAction(paymentId),
    ]);

    return {
      status: "ready",
      payment,
      client,
      invoice,
      event,
      contract,
      refundableMinor,
      notes,
      timeline,
      nextAction,
    };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function PaymentDetailView({ paymentId }: { paymentId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPaymentDetail(paymentId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  const refetch = () => {
    loadPaymentDetail(paymentId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This payment could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this payment." onRetry={refetch} />;
  }

  const { payment, client, invoice, event, contract, refundableMinor, notes, timeline, nextAction } = state;
  const notesReadOnly = isPaymentFinal(payment.status);
  const refundedSoFarMinor = subtractMinor(payment.amount_minor, refundableMinor);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finance/payments" className="text-sm text-accent hover:underline">
          ← Back to Payments
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">
            {formatMoney(payment.amount_minor, payment.currency)}
          </h2>
          <PaymentTypeBadge type={payment.payment_type} />
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {client ? (
            <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
              {client.first_name} {client.last_name}
            </Link>
          ) : (
            "No client"
          )}
          {invoice ? (
            <>
              {" · "}
              <Link href={`/finance/invoices/${invoice.id}`} className="text-accent hover:underline">
                {invoice.invoice_number}
              </Link>
            </>
          ) : null}
          {event ? (
            <>
              {" · "}
              <Link href={`/events/${event.id}`} className="text-accent hover:underline">
                {event.title}
              </Link>
            </>
          ) : null}
          {contract ? (
            <>
              {" · "}
              <Link href={`/contracts/${contract.id}`} className="text-accent hover:underline">
                {contract.contract_number}
              </Link>
            </>
          ) : null}
        </p>

        <div className="mt-4">
          <PaymentActions payment={payment} onChanged={refetch} />
        </div>
      </div>

      {nextAction ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Next recommended action</p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Payment Details</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Amount" value={formatMoney(payment.amount_minor, payment.currency)} />
              <Field label="Type" value={<PaymentTypeBadge type={payment.payment_type} />} />
              <Field label="Method" value={<PaymentMethodBadge method={payment.payment_method} />} />
              <Field label="Status" value={<PaymentStatusBadge status={payment.status} />} />
              <Field label="Transaction date" value={formatEventDate(payment.transaction_date)} />
              <Field label="Reference" value={payment.reference} />
              <Field label="Received" value={payment.received_at ? new Date(payment.received_at).toLocaleString() : null} />
              <Field label="Failed" value={payment.failed_at ? new Date(payment.failed_at).toLocaleString() : null} />
              <Field label="Refunded" value={payment.refunded_at ? new Date(payment.refunded_at).toLocaleString() : null} />
            </dl>
            {payment.status === "partially_refunded" || payment.status === "refunded" ? (
              <div className="mt-3 rounded-md border border-border px-3 py-2">
                <p className="text-xs text-text-muted">
                  {payment.status === "refunded" ? "Fully refunded" : "Partially refunded"} —{" "}
                  {formatMoney(refundedSoFarMinor, payment.currency)} refunded of{" "}
                  {formatMoney(payment.amount_minor, payment.currency)}
                  {refundableMinor > 0 ? `, ${formatMoney(refundableMinor, payment.currency)} still refundable` : ""}
                </p>
              </div>
            ) : null}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Client</h3>
            {client ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Name"
                  value={
                    <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                      {client.first_name} {client.last_name}
                    </Link>
                  }
                />
                <Field label="Email" value={client.email} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Client not found.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Invoice</h3>
            {invoice ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Invoice number"
                  value={
                    <Link href={`/finance/invoices/${invoice.id}`} className="text-accent hover:underline">
                      {invoice.invoice_number}
                    </Link>
                  }
                />
                <Field label="Balance" value={formatMoney(invoice.balance_minor, invoice.currency)} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No linked invoice — this payment stands on its own.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={payment.workspace_id}
                ownerType="payment"
                ownerId={payment.id}
                notes={notes}
                onCreateNote={(input) => createPaymentNote(payment.id, input)}
                onTogglePin={togglePinNote}
                readOnly={notesReadOnly}
                onNotesChanged={refetch}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
            <div className="mt-3">
              <Timeline activities={timeline} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Future Integrations</h3>
            <p className="mt-2 text-xs text-text-muted">Not built yet — reserved for upcoming modules.</p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-muted">
              <li>Receipt upload &amp; payment confirmation</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
