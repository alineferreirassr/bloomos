"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createDocumentNote,
  getClientById,
  getContract,
  getContractExhibitsByContractId,
  getDocumentById,
  getDocumentFolderById,
  getDocumentNextAction,
  getDocumentVersions,
  getEventById,
  getExpenseById,
  getInvoiceById,
  getNotesByDocumentId,
  getPaymentById,
  getTimelineByDocumentId,
  togglePinNote,
} from "@/lib/data";
import type { Document } from "@/types/document";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { DocumentVisibilityBadge } from "@/modules/documents/components/DocumentVisibilityBadge";
import { DocumentActions } from "@/modules/documents/components/DocumentActions";
import { DocumentVersionHistorySection } from "@/modules/documents/components/DocumentVersionHistorySection";
import { formatBytes, formatDocumentDate } from "@/modules/documents/mappers";
import { OWNER_TYPE_LABELS } from "@/modules/documents/components/DocumentFilters";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      document: Document;
      ownerLabel: string;
      ownerHref: string | null;
      folder: DocumentFolder | null;
      versions: Document[];
      client: Client | null;
      event: Event | null;
      contract: Contract | null;
      exhibit: ContractExhibit | null;
      invoice: Invoice | null;
      payment: Payment | null;
      expense: Expense | null;
      notes: Note[];
      timeline: TimelineActivity[];
      nextAction: string | null;
    };

async function resolveOwner(document: Document): Promise<{ label: string; href: string | null }> {
  try {
    switch (document.owner_type) {
      case "client": {
        const client = await getClientById(document.owner_id);
        return { label: `${client.first_name} ${client.last_name}`, href: `/clients/${client.id}` };
      }
      case "event": {
        const event = await getEventById(document.owner_id);
        return { label: event.title, href: `/events/${event.id}` };
      }
      case "contract": {
        const contract = await getContract(document.owner_id);
        return { label: contract.contract_number, href: `/contracts/${contract.id}` };
      }
      case "invoice": {
        const invoice = await getInvoiceById(document.owner_id);
        return { label: invoice.invoice_number, href: `/finance/invoices/${invoice.id}` };
      }
      case "payment": {
        const payment = await getPaymentById(document.owner_id);
        return { label: payment.reference ?? `Payment on ${payment.transaction_date}`, href: `/finance/payments/${payment.id}` };
      }
      case "expense": {
        const expense = await getExpenseById(document.owner_id);
        return { label: expense.description, href: `/finance/expenses/${expense.id}` };
      }
      case "workspace":
      default:
        return { label: "Workspace (Amoré Bloom)", href: null };
    }
  } catch {
    return { label: OWNER_TYPE_LABELS[document.owner_type], href: null };
  }
}

async function loadDocumentDetail(documentId: string): Promise<LoadState> {
  try {
    const document = await getDocumentById(documentId);
    const [owner, folder, versions, client, event, contract, invoice, payment, expense, notes, timeline, nextAction] =
      await Promise.all([
        resolveOwner(document),
        document.folder_id ? getDocumentFolderById(document.folder_id).catch(() => null) : Promise.resolve(null),
        getDocumentVersions(document.id),
        document.client_id ? getClientById(document.client_id).catch(() => null) : Promise.resolve(null),
        document.event_id ? getEventById(document.event_id).catch(() => null) : Promise.resolve(null),
        document.contract_id ? getContract(document.contract_id).catch(() => null) : Promise.resolve(null),
        document.invoice_id ? getInvoiceById(document.invoice_id).catch(() => null) : Promise.resolve(null),
        document.payment_id ? getPaymentById(document.payment_id).catch(() => null) : Promise.resolve(null),
        document.expense_id ? getExpenseById(document.expense_id).catch(() => null) : Promise.resolve(null),
        getNotesByDocumentId(document.id),
        getTimelineByDocumentId(document.id),
        getDocumentNextAction(document.id),
      ]);

    let exhibit: ContractExhibit | null = null;
    if (document.contract_exhibit_id && document.contract_id) {
      const exhibits = await getContractExhibitsByContractId(document.contract_id);
      exhibit = exhibits.find((x) => x.id === document.contract_exhibit_id) ?? null;
    }

    return {
      status: "ready",
      document,
      ownerLabel: owner.label,
      ownerHref: owner.href,
      folder,
      versions,
      client,
      event,
      contract,
      exhibit,
      invoice,
      payment,
      expense,
      notes,
      timeline,
      nextAction,
    };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function DocumentDetailView({ documentId }: { documentId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadDocumentDetail(documentId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const refetch = () => {
    loadDocumentDetail(documentId).then(setState);
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
    return <ErrorState message="This document could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this document." onRetry={refetch} />;
  }

  const { document, ownerLabel, ownerHref, folder, versions, client, event, contract, exhibit, invoice, payment, expense, notes, timeline, nextAction } =
    state;
  const notesReadOnly = document.status === "deleted";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/documents" className="text-sm text-accent hover:underline">
          ← Back to Documents
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{document.title}</h2>
          <DocumentStatusBadge status={document.status} />
          <DocumentCategoryBadge category={document.category} />
          <DocumentVisibilityBadge visibility={document.visibility} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {document.file_name ?? "No file attached"} · v{document.version}
          {document.is_latest_version ? "" : " (superseded)"}
          {" · "}
          {ownerHref ? (
            <Link href={ownerHref} className="text-accent hover:underline">
              {ownerLabel}
            </Link>
          ) : (
            ownerLabel
          )}
        </p>

        <div className="mt-4">
          <DocumentActions document={document} onChanged={refetch} />
        </div>
      </div>

      {document.status === "deleted" ? (
        <Card className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">
            This document has been soft-deleted and is read-only. It is never physically removed — version history
            and Timeline remain intact, and it can be restored.
          </p>
        </Card>
      ) : null}

      {nextAction ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Next recommended action</p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">File Metadata</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Title" value={document.title} />
              <Field label="Description" value={document.description} />
              <Field label="Original file name" value={document.original_file_name} />
              <Field label="Normalized file name" value={document.file_name} />
              <Field label="Extension" value={document.file_extension?.toUpperCase() ?? null} />
              <Field label="MIME type" value={document.mime_type} />
              <Field label="Size" value={document.size_bytes !== null ? formatBytes(document.size_bytes) : null} />
              <Field label="Checksum" value={document.checksum} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">File</h3>
            <p className="mt-1 text-xs text-text-muted">
              The physical file is a MediaAsset in the Shared Media Library, linked via media_asset_id — this Document
              record carries business metadata only.
            </p>
            {document.media_asset_id ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Storage provider" value={document.storage_provider} />
                <Field label="Bucket" value={document.storage_bucket} />
                <Field label="Path" value={<code className="text-xs">{document.storage_path}</code>} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-text-muted">No file attached to this version yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Owner &amp; Folder</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Owner type" value={OWNER_TYPE_LABELS[document.owner_type]} />
              <Field
                label="Owner"
                value={ownerHref ? <Link href={ownerHref} className="text-accent hover:underline">{ownerLabel}</Link> : ownerLabel}
              />
              <Field
                label="Folder"
                value={
                  folder ? (
                    <Link href={`/documents/folders/${folder.id}`} className="text-accent hover:underline">
                      {folder.name}
                    </Link>
                  ) : (
                    "Unfiled"
                  )
                }
              />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Cross-Module References</h3>
            {!client && !event && !contract && !exhibit && !invoice && !payment && !expense ? (
              <p className="mt-2 text-sm text-text-muted">No cross-module references set.</p>
            ) : (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {client ? (
                  <Field label="Client" value={<Link href={`/clients/${client.id}`} className="text-accent hover:underline">{client.first_name} {client.last_name}</Link>} />
                ) : null}
                {event ? (
                  <Field label="Event" value={<Link href={`/events/${event.id}`} className="text-accent hover:underline">{event.title}</Link>} />
                ) : null}
                {contract ? (
                  <Field label="Contract" value={<Link href={`/contracts/${contract.id}`} className="text-accent hover:underline">{contract.contract_number}</Link>} />
                ) : null}
                {exhibit ? <Field label="Contract Exhibit" value={exhibit.title} /> : null}
                {invoice ? (
                  <Field label="Invoice" value={<Link href={`/finance/invoices/${invoice.id}`} className="text-accent hover:underline">{invoice.invoice_number}</Link>} />
                ) : null}
                {payment ? (
                  <Field label="Payment" value={<Link href={`/finance/payments/${payment.id}`} className="text-accent hover:underline">{payment.reference ?? `Payment on ${payment.transaction_date}`}</Link>} />
                ) : null}
                {expense ? (
                  <Field label="Expense" value={<Link href={`/finance/expenses/${expense.id}`} className="text-accent hover:underline">{expense.description}</Link>} />
                ) : null}
              </dl>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Dates</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Uploaded" value={new Date(document.uploaded_at).toLocaleString()} />
              <Field label="Expires" value={formatDocumentDate(document.expires_at)} />
              <Field label="Archived" value={document.archived_at ? new Date(document.archived_at).toLocaleString() : null} />
              <Field label="Deleted" value={document.deleted_at ? new Date(document.deleted_at).toLocaleString() : null} />
              <Field label="Created" value={new Date(document.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(document.updated_at).toLocaleDateString()} />
            </dl>
          </Card>

          <DocumentVersionHistorySection versions={versions} />

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={document.workspace_id}
                ownerType="document"
                ownerId={document.id}
                notes={notes}
                onCreateNote={(input) => createDocumentNote(document.id, input)}
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
            <p className="mt-2 text-xs text-text-muted">Not built yet — reserved for upcoming phases.</p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-muted">
              <li>Real file upload (Supabase Storage)</li>
              <li>Signed, time-limited download URLs</li>
              <li>Client Portal / Team Portal access</li>
              <li>OCR, PDF generation, e-signature</li>
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
