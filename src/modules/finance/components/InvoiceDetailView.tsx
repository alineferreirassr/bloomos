"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createInvoiceNote,
  getClientById,
  getContract,
  getEventById,
  getInvoiceById,
  getInvoiceNextAction,
  getNotesByInvoiceId,
  getPayments,
  getTimelineByInvoiceId,
  togglePinNote,
} from "@/lib/data";
import type { Invoice } from "@/types/invoice";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Payment } from "@/types/payment";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { formatEventDate } from "@/modules/events/dateFormat";
import { formatMoney } from "@/lib/money";
import { isInvoiceTerminal } from "@/core/workflows/invoiceWorkflow";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { PaymentTypeBadge } from "@/modules/finance/components/PaymentTypeBadge";
import { InvoiceActions } from "@/modules/finance/components/InvoiceActions";
import { DocumentsSummarySection } from "@/modules/documents/components/DocumentsSummarySection";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      invoice: Invoice;
      client: Client | null;
      event: Event | null;
      contract: Contract | null;
      payments: Payment[];
      notes: Note[];
      timeline: TimelineActivity[];
      nextAction: string | null;
    };

async function loadInvoiceDetail(invoiceId: string): Promise<LoadState> {
  try {
    const invoice = await getInvoiceById(invoiceId);
    const [client, event, contract, payments, notes, timeline, nextAction] = await Promise.all([
      getClientById(invoice.client_id).catch(() => null),
      invoice.event_id ? getEventById(invoice.event_id).catch(() => null) : Promise.resolve(null),
      invoice.contract_id ? getContract(invoice.contract_id).catch(() => null) : Promise.resolve(null),
      getPayments({ invoiceId }),
      getNotesByInvoiceId(invoiceId),
      getTimelineByInvoiceId(invoiceId),
      getInvoiceNextAction(invoiceId),
    ]);

    return { status: "ready", invoice, client, event, contract, payments, notes, timeline, nextAction };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function InvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadInvoiceDetail(invoiceId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const refetch = () => {
    loadInvoiceDetail(invoiceId).then(setState);
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
    return <ErrorState message="This invoice could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this invoice." onRetry={refetch} />;
  }

  const { invoice, client, event, contract, payments, notes, timeline, nextAction } = state;
  const notesReadOnly = isInvoiceTerminal(invoice.status);
  const hasUnresolvedDepositApplication = payments.some(
    (payment) =>
      payment.payment_type === "adjustment" &&
      payment.reference?.startsWith("deposit_application_of:") &&
      PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status),
  );
  const isPartiallyVoided = invoice.status === "voided" && invoice.paid_minor > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finance/invoices" className="text-sm text-accent hover:underline">
          ← Back to Invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{invoice.title}</h2>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        {isPartiallyVoided ? (
          <p className="mt-1 text-sm text-text-muted">
            This invoice was partially cancelled — {formatMoney(invoice.paid_minor, invoice.currency)} was already
            settled and retained; the unpaid remainder was cancelled.
          </p>
        ) : null}
        <p className="mt-1 text-sm text-text-muted">
          {invoice.invoice_number}
          {client ? (
            <>
              {" · "}
              <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                {client.first_name} {client.last_name}
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
        <p className="mt-1 text-sm text-text">
          {formatMoney(invoice.total_minor, invoice.currency)}
          <span className="text-text-muted"> · Paid {formatMoney(invoice.paid_minor, invoice.currency)}</span>
          <span className="text-text-muted"> · Balance {formatMoney(invoice.balance_minor, invoice.currency)}</span>
        </p>

        <div className="mt-4">
          <InvoiceActions
            invoice={invoice}
            onChanged={refetch}
            hasUnresolvedDepositApplication={hasUnresolvedDepositApplication}
          />
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
            <h3 className="font-serif text-[17px] font-semibold text-text">Commercial Summary</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Invoice number" value={invoice.invoice_number} />
              <Field label="Status" value={<InvoiceStatusBadge status={invoice.status} />} />
              <Field label="Created" value={new Date(invoice.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(invoice.updated_at).toLocaleDateString()} />
              <Field label="Description" value={invoice.description} />
            </dl>
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
                <Field label="Phone" value={client.phone} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Client not found.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Event</h3>
            {event ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Title"
                  value={
                    <Link href={`/events/${event.id}`} className="text-accent hover:underline">
                      {event.title}
                    </Link>
                  }
                />
                <Field label="Event date" value={formatEventDate(event.event_date)} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No linked event — this invoice stands on its own.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Contract</h3>
            {contract ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Contract number"
                  value={
                    <Link href={`/contracts/${contract.id}`} className="text-accent hover:underline">
                      {contract.contract_number}
                    </Link>
                  }
                />
                <Field label="Title" value={contract.title} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No linked contract — this invoice stands on its own.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Dates</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Issue date" value={formatEventDate(invoice.issue_date)} />
              <Field label="Due date" value={formatEventDate(invoice.due_date)} />
              <Field label="Sent" value={invoice.sent_at ? new Date(invoice.sent_at).toLocaleString() : null} />
              <Field label="Viewed" value={invoice.viewed_at ? new Date(invoice.viewed_at).toLocaleString() : null} />
              <Field label="Paid" value={invoice.paid_at ? new Date(invoice.paid_at).toLocaleString() : null} />
              <Field label="Overdue" value={invoice.overdue_at ? new Date(invoice.overdue_at).toLocaleString() : null} />
              <Field label="Voided" value={invoice.voided_at ? new Date(invoice.voided_at).toLocaleString() : null} />
              <Field label="Archived" value={invoice.archived_at ? new Date(invoice.archived_at).toLocaleString() : null} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Financial Terms</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Subtotal" value={formatMoney(invoice.subtotal_minor, invoice.currency)} />
              <Field label="Tax" value={formatMoney(invoice.tax_minor, invoice.currency)} />
              <Field label="Discount" value={formatMoney(invoice.discount_minor, invoice.currency)} />
              <Field label="Total" value={formatMoney(invoice.total_minor, invoice.currency)} />
              <Field label="Paid" value={formatMoney(invoice.paid_minor, invoice.currency)} />
              <Field label="Balance" value={formatMoney(invoice.balance_minor, invoice.currency)} />
              <Field label="Currency" value={invoice.currency} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Payment History</h3>
            {payments.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No payments recorded against this invoice yet.</p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="payment-history-list">
                {payments.map((payment) => (
                  <li key={payment.id}>
                    <Link
                      href={`/finance/payments/${payment.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text">
                          {formatMoney(payment.amount_minor, payment.currency)}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {formatEventDate(payment.transaction_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <PaymentTypeBadge type={payment.payment_type} />
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={invoice.workspace_id}
                ownerType="invoice"
                ownerId={invoice.id}
                notes={notes}
                onCreateNote={(input) => createInvoiceNote(invoice.id, input)}
                onTogglePin={togglePinNote}
                readOnly={notesReadOnly}
                onNotesChanged={refetch}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <DocumentsSummarySection
            ownerType="invoice"
            ownerId={invoice.id}
            newDocumentParams={{ invoiceId: invoice.id, clientId: invoice.client_id }}
          />

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
              <li>Invoice PDF export</li>
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
