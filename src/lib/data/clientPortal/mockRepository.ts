import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Document } from "@/types/document";
import type {
  ClientPortalEvent,
  ClientPortalContract,
  ClientPortalInvoice,
  ClientPortalInvoiceWithPayments,
  ClientPortalPayment,
  ClientPortalDocument,
  ClientPortalOverview,
} from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { isContractClosed } from "@/core/workflows/contractWorkflow";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { readInvoices } from "@/lib/data/mock/invoicesStore";
import { readPayments } from "@/lib/data/mock/paymentsStore";
import { readDocuments } from "@/lib/data/mock/documentsStore";
import { mockClientAccessRepository } from "@/lib/data/clientAccess/mockRepository";
import { getClientDocumentApproval } from "@/lib/data/clientPortal/clientDocumentApprovalStore";
import { aggregateClientPortalTimeline } from "@/lib/data/clientPortal/timelineAggregator";
import type { ClientPortalRepository } from "@/lib/data/clientPortal/repository";
import type { ClientPortalTimelineEntry } from "@/types/clientPortalTimeline";
import { getFullName } from "@/lib/personName";

/** Mock mode has no real per-session identity — the seeded current client account (see clientAccountsStore.ts) stands in for "the signed-in client," the same precedent as MOCK_CURRENT_MEMBER_ID/MOCK_CURRENT_CLIENT_ACCOUNT_ID. */
async function currentClientId(): Promise<string> {
  const account = await mockClientAccessRepository.getCurrentClientAccount();
  if (!account) throw new NotFoundError("No active client account.");
  return account.client_id;
}

/** The signed-in client's own account id — distinct from `currentClientId()`'s CRM `client_id` — needed for anything scoped to the *account* (Activity, Approvals, Messages, Notifications), not the underlying Client record. */
async function currentClientAccountId(): Promise<string> {
  const account = await mockClientAccessRepository.getCurrentClientAccount();
  if (!account) throw new NotFoundError("No active client account.");
  return account.id;
}

function toClientPortalEvent(e: Event): ClientPortalEvent {
  return {
    id: e.id,
    client_id: e.client_id,
    title: e.title,
    event_type: e.event_type,
    status: e.status,
    event_date: e.event_date,
    start_time: e.start_time,
    end_time: e.end_time,
    timezone: e.timezone,
    location_name: e.location_name,
    city: e.city,
    state: e.state,
    guest_count: e.guest_count,
    package_name: e.package_name,
    theme: e.theme,
    color_palette: e.color_palette,
    created_at: e.created_at,
    updated_at: e.updated_at,
    completed_at: e.completed_at,
  };
}

function toClientPortalContract(c: Contract): ClientPortalContract {
  return {
    id: c.id,
    client_id: c.client_id,
    event_id: c.event_id,
    contract_number: c.contract_number,
    title: c.title,
    description: c.description,
    status: c.status,
    signature_status: c.signature_status,
    effective_date: c.effective_date,
    expiration_date: c.expiration_date,
    sent_at: c.sent_at,
    viewed_at: c.viewed_at,
    signed_at: c.signed_at,
    total_value: c.total_value,
    deposit_required: c.deposit_required,
    deposit_amount: c.deposit_amount,
    remaining_balance: c.remaining_balance,
    currency: c.currency,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

function toClientPortalInvoice(i: Invoice): ClientPortalInvoice {
  return {
    id: i.id,
    client_id: i.client_id,
    event_id: i.event_id,
    contract_id: i.contract_id,
    invoice_number: i.invoice_number,
    title: i.title,
    description: i.description,
    status: i.status,
    issue_date: i.issue_date,
    due_date: i.due_date,
    subtotal_minor: i.subtotal_minor,
    tax_minor: i.tax_minor,
    discount_minor: i.discount_minor,
    total_minor: i.total_minor,
    paid_minor: i.paid_minor,
    balance_minor: i.balance_minor,
    currency: i.currency,
    sent_at: i.sent_at,
    viewed_at: i.viewed_at,
    paid_at: i.paid_at,
    overdue_at: i.overdue_at,
    created_at: i.created_at,
    updated_at: i.updated_at,
  };
}

function toClientPortalPayment(p: Payment): ClientPortalPayment {
  return {
    id: p.id,
    invoice_id: p.invoice_id,
    payment_type: p.payment_type,
    status: p.status,
    amount_minor: p.amount_minor,
    currency: p.currency,
    payment_method: p.payment_method,
    transaction_date: p.transaction_date,
    received_at: p.received_at,
    refunded_at: p.refunded_at,
    created_at: p.created_at,
  };
}

function toClientPortalDocument(d: Document, clientAccountId: string): ClientPortalDocument {
  const approval = getClientDocumentApproval(d.id, clientAccountId);
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    status: d.status,
    file_name: d.file_name,
    original_file_name: d.original_file_name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
    version: d.version,
    is_latest_version: d.is_latest_version,
    hasFile: d.media_asset_id !== null,
    uploaded_at: d.uploaded_at,
    expires_at: d.expires_at,
    created_at: d.created_at,
    updated_at: d.updated_at,
    approvalStatus: approval?.status ?? "pending",
    approvalComment: approval?.comment ?? null,
  };
}

/**
 * Mirrors the new documents_select_client_account RLS predicate exactly,
 * so mock mode and Supabase mode behave identically, plus one additional
 * application-layer rule RLS doesn't express: only the latest version in
 * a chain is client-visible — "no access to superseded versions unless
 * current business rules explicitly permit it," and no such permission
 * exists yet (see docs/permissions.md's Client Portal MVP section).
 */
function isClientVisibleDocument(d: Document, clientId: string): boolean {
  return (
    d.client_id === clientId &&
    (d.visibility === "client" || d.visibility === "client_and_team") &&
    d.status !== "deleted" &&
    d.is_latest_version
  );
}

async function getClientPortalEvents(): Promise<ClientPortalEvent[]> {
  const clientId = await currentClientId();
  return readEvents()
    .filter((e) => e.client_id === clientId && !e.archived_at)
    .map(toClientPortalEvent);
}

async function getClientPortalEventById(id: string): Promise<ClientPortalEvent> {
  const clientId = await currentClientId();
  const event = readEvents().find((e) => e.id === id && e.client_id === clientId);
  if (!event) throw new NotFoundError(`Event ${id} was not found`);
  return toClientPortalEvent(event);
}

async function getClientPortalContracts(): Promise<ClientPortalContract[]> {
  const clientId = await currentClientId();
  return readContracts()
    .filter((c) => c.client_id === clientId && c.status !== "archived")
    .map(toClientPortalContract);
}

async function getClientPortalContractById(id: string): Promise<ClientPortalContract> {
  const clientId = await currentClientId();
  const contract = readContracts().find((c) => c.id === id && c.client_id === clientId);
  if (!contract) throw new NotFoundError(`Contract ${id} was not found`);
  return toClientPortalContract(contract);
}

async function getClientPortalInvoices(): Promise<ClientPortalInvoice[]> {
  const clientId = await currentClientId();
  return readInvoices()
    .filter((i) => i.client_id === clientId && !i.archived_at && !i.voided_at)
    .map(toClientPortalInvoice);
}

async function getClientPortalInvoiceById(id: string): Promise<ClientPortalInvoiceWithPayments> {
  const clientId = await currentClientId();
  const invoice = readInvoices().find((i) => i.id === id && i.client_id === clientId);
  if (!invoice) throw new NotFoundError(`Invoice ${id} was not found`);
  const payments = readPayments()
    .filter((p) => p.invoice_id === id && p.client_id === clientId)
    .map(toClientPortalPayment);
  return { ...toClientPortalInvoice(invoice), payments };
}

async function getClientPortalDocuments(): Promise<ClientPortalDocument[]> {
  const clientId = await currentClientId();
  const clientAccountId = await currentClientAccountId();
  return [...readDocuments()]
    .filter((d) => isClientVisibleDocument(d, clientId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((d) => toClientPortalDocument(d, clientAccountId));
}

async function getClientPortalDocumentById(id: string): Promise<ClientPortalDocument> {
  const clientId = await currentClientId();
  const clientAccountId = await currentClientAccountId();
  const document = readDocuments().find((d) => d.id === id && isClientVisibleDocument(d, clientId));
  if (!document) throw new NotFoundError(`Document ${id} was not found`);
  return toClientPortalDocument(document, clientAccountId);
}

/** Mock mode has no real Storage — returns a clearly-fake placeholder URL, mirroring the existing Media Library mock repository's own "mock mode never has real signed URLs" precedent. */
async function getClientPortalDocumentDownloadUrl(id: string): Promise<DataResult<string>> {
  const clientId = await currentClientId();
  const document = readDocuments().find((d) => d.id === id && isClientVisibleDocument(d, clientId));
  if (!document) return fail("This document is not available.");
  if (!document.media_asset_id) return fail("This document has no file attached.");
  return ok(`mock://client-portal-download/${document.media_asset_id}`);
}

async function getClientPortalOverview(): Promise<ClientPortalOverview> {
  const clientId = await currentClientId();
  const clientAccountId = await currentClientAccountId();
  const client = readClients().find((c) => c.id === clientId);
  const events = readEvents().filter((e) => e.client_id === clientId && !e.archived_at);
  const contracts = readContracts().filter((c) => c.client_id === clientId && c.status !== "archived");
  const invoices = readInvoices().filter((i) => i.client_id === clientId && !i.archived_at && !i.voided_at);
  const documents = readDocuments().filter((d) => isClientVisibleDocument(d, clientId));

  const now = Date.now();
  const upcoming = events
    .filter((e) => e.event_date && new Date(e.event_date).getTime() >= now && e.status !== "cancelled")
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))[0];

  const contractsInProgress = contracts.filter((c) => !isContractClosed(c.status)).length;

  const totalOutstandingBalanceMinor = invoices.reduce((sum, i) => sum + i.balance_minor, 0);

  const dueInvoices = invoices
    .filter((i) => i.balance_minor > 0 && i.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const nextDue = dueInvoices[0];

  const recentDocuments = [...documents]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((d) => toClientPortalDocument(d, clientAccountId));

  let nextRecommendedAction: string | null = null;
  if (nextDue) {
    nextRecommendedAction = `A payment of ${(nextDue.balance_minor / 100).toFixed(2)} ${nextDue.currency} is due${nextDue.due_date ? ` on ${new Date(nextDue.due_date).toLocaleDateString()}` : ""}.`;
  } else if (upcoming) {
    nextRecommendedAction = `Your event "${upcoming.title}" is coming up${upcoming.event_date ? ` on ${new Date(upcoming.event_date).toLocaleDateString()}` : ""}.`;
  }

  return {
    clientName: client ? getFullName(client).trim() : "",
    upcomingEvent: upcoming ? toClientPortalEvent(upcoming) : null,
    contractsInProgress,
    totalOutstandingBalanceMinor,
    currency: invoices[0]?.currency ?? "USD",
    nextPaymentDue: nextDue
      ? { invoiceId: nextDue.id, invoiceNumber: nextDue.invoice_number, dueDate: nextDue.due_date, balanceMinor: nextDue.balance_minor }
      : null,
    recentDocuments,
    nextRecommendedAction,
  };
}

async function getClientPortalTimeline(): Promise<ClientPortalTimelineEntry[]> {
  const account = await mockClientAccessRepository.getCurrentClientAccount();
  if (!account) throw new NotFoundError("No active client account.");

  const [events, contracts, invoices, documents] = await Promise.all([
    getClientPortalEvents(),
    getClientPortalContracts(),
    getClientPortalInvoices(),
    getClientPortalDocuments(),
  ]);
  const invoicesWithPayments = await Promise.all(invoices.map((invoice) => getClientPortalInvoiceById(invoice.id)));

  return aggregateClientPortalTimeline({ workspaceId: account.workspace_id, events, contracts, invoicesWithPayments, documents });
}

/**
 * Checkpoint 16, Step 9 — the Public API's own entry point into the same
 * Timeline aggregate, for an explicit `clientAccountId` rather than "the
 * current session's" account. Reuses every mapper this file already
 * defines (`toClientPortalEvent` etc.) and the same `aggregateClientPortalTimeline`
 * — only the account resolution differs. Rejects an account from a
 * different Workspace as not-found, never distinguishing "wrong workspace"
 * from "doesn't exist" (same boundary-leak rule `getClientPortalDocumentById`
 * already follows for cross-client documents).
 */
export async function getClientPortalTimelineForAccount(workspaceId: string, clientAccountId: string): Promise<ClientPortalTimelineEntry[]> {
  const account = await mockClientAccessRepository.getClientAccountById(clientAccountId);
  if (account.workspace_id !== workspaceId) throw new NotFoundError(`Client account ${clientAccountId} was not found`);
  const clientId = account.client_id;

  const events = readEvents().filter((e) => e.client_id === clientId && !e.archived_at).map(toClientPortalEvent);
  const contracts = readContracts().filter((c) => c.client_id === clientId && c.status !== "archived").map(toClientPortalContract);
  const rawInvoices = readInvoices().filter((i) => i.client_id === clientId && !i.archived_at && !i.voided_at);
  const invoicesWithPayments = rawInvoices.map((invoice) => ({
    ...toClientPortalInvoice(invoice),
    payments: readPayments().filter((p) => p.invoice_id === invoice.id && p.client_id === clientId).map(toClientPortalPayment),
  }));
  const documents = [...readDocuments()].filter((d) => isClientVisibleDocument(d, clientId)).map((d) => toClientPortalDocument(d, clientAccountId));

  return aggregateClientPortalTimeline({ workspaceId, events, contracts, invoicesWithPayments, documents });
}

export const mockClientPortalRepository: ClientPortalRepository = {
  getClientPortalOverview,
  getClientPortalEvents,
  getClientPortalEventById,
  getClientPortalContracts,
  getClientPortalContractById,
  getClientPortalInvoices,
  getClientPortalInvoiceById,
  getClientPortalDocuments,
  getClientPortalDocumentById,
  getClientPortalDocumentDownloadUrl,
  getClientPortalTimeline,
};
