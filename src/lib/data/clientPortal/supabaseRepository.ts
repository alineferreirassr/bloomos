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
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { supabaseClientAccessRepository } from "@/lib/data/clientAccess/supabaseRepository";
import { getClientDocumentApproval } from "@/lib/data/clientPortal/clientDocumentApprovalStore";
import { aggregateClientPortalTimeline } from "@/lib/data/clientPortal/timelineAggregator";
import type { ClientPortalRepository } from "@/lib/data/clientPortal/repository";
import type { ClientPortalTimelineEntry } from "@/types/clientPortalTimeline";

/** The signed-in client's own account id, resolved via the same session Supabase mode already authenticates — needed for the (mock-only, see `clientDocumentApprovalStore.ts`'s own doc comment) Document Approval enrichment. */
async function currentClientAccountId(): Promise<string> {
  const account = await supabaseClientAccessRepository.getCurrentClientAccount();
  if (!account) throw new NotFoundError("No active client account.");
  return account.id;
}

/**
 * Every query below relies on the new `*_select_client_account` RLS
 * policies (Client Portal MVP migrations) as the real authorization
 * boundary — a client caller's `.eq("id", id)` lookup for a row that
 * isn't theirs returns zero rows (not an error), which this repository
 * surfaces as the same `NotFoundError` a genuinely nonexistent id would
 * produce. This is deliberate: a client must never be able to distinguish
 * "this record exists but isn't yours" from "this record doesn't exist,"
 * since the former would leak the existence of another Client's data.
 *
 * Every select() lists exact columns — never `select("*")` — so a future
 * column added to the internal table is never accidentally forwarded to
 * the browser. See docs/permissions.md's Client Portal MVP section for
 * the full audited list of excluded fields per table.
 */

const EVENT_COLUMNS =
  "id, client_id, title, event_type, status, event_date, start_time, end_time, timezone, location_name, city, state, guest_count, package_name, theme, color_palette, created_at, updated_at, completed_at";

const CONTRACT_COLUMNS =
  "id, client_id, event_id, contract_number, title, description, status, signature_status, effective_date, expiration_date, sent_at, viewed_at, signed_at, total_value, deposit_required, deposit_amount, remaining_balance, currency, created_at, updated_at";

const INVOICE_COLUMNS =
  "id, client_id, event_id, contract_id, invoice_number, title, description, status, issue_date, due_date, subtotal_minor, tax_minor, discount_minor, total_minor, paid_minor, balance_minor, currency, sent_at, viewed_at, paid_at, overdue_at, created_at, updated_at";

const PAYMENT_COLUMNS =
  "id, invoice_id, payment_type, status, amount_minor, currency, payment_method, transaction_date, received_at, refunded_at, created_at";

const DOCUMENT_COLUMNS =
  "id, title, description, category, status, file_name, original_file_name, mime_type, size_bytes, version, is_latest_version, media_asset_id, uploaded_at, expires_at, created_at, updated_at";

interface DocumentRow {
  id: string;
  title: string;
  description: string | null;
  category: ClientPortalDocument["category"];
  status: ClientPortalDocument["status"];
  file_name: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  is_latest_version: boolean;
  media_asset_id: string | null;
  uploaded_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

function toClientPortalDocument(row: DocumentRow, clientAccountId: string): ClientPortalDocument {
  const approval = getClientDocumentApproval(row.id, clientAccountId);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    file_name: row.file_name,
    original_file_name: row.original_file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    version: row.version,
    is_latest_version: row.is_latest_version,
    hasFile: row.media_asset_id !== null,
    uploaded_at: row.uploaded_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    approvalStatus: approval?.status ?? "pending",
    approvalComment: approval?.comment ?? null,
  };
}

async function getClientPortalEvents(): Promise<ClientPortalEvent[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .is("archived_at", null)
    .order("event_date", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as unknown as ClientPortalEvent[];
}

async function getClientPortalEventById(id: string): Promise<ClientPortalEvent> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) throw new NotFoundError(`Event ${id} was not found`);
  return data as unknown as ClientPortalEvent;
}

async function getClientPortalContracts(): Promise<ClientPortalContract[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(CONTRACT_COLUMNS)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as unknown as ClientPortalContract[];
}

async function getClientPortalContractById(id: string): Promise<ClientPortalContract> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("contracts").select(CONTRACT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) throw new NotFoundError(`Contract ${id} was not found`);
  return data as unknown as ClientPortalContract;
}

async function getClientPortalInvoices(): Promise<ClientPortalInvoice[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .is("archived_at", null)
    .is("voided_at", null)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as unknown as ClientPortalInvoice[];
}

async function getClientPortalInvoiceById(id: string): Promise<ClientPortalInvoiceWithPayments> {
  const supabase = createSupabaseClient();
  const { data: invoice, error: invoiceError } = await supabase.from("invoices").select(INVOICE_COLUMNS).eq("id", id).maybeSingle();
  if (invoiceError) throw normalizeSupabaseError(invoiceError);
  if (!invoice) throw new NotFoundError(`Invoice ${id} was not found`);

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("invoice_id", id)
    .order("transaction_date", { ascending: false });
  if (paymentsError) throw normalizeSupabaseError(paymentsError);

  return { ...(invoice as unknown as ClientPortalInvoice), payments: (payments ?? []) as unknown as ClientPortalPayment[] };
}

/** "No access to superseded versions unless current business rules explicitly permit it" — no such permission exists yet, so every query below is additionally scoped to is_latest_version = true. */
async function getClientPortalDocuments(): Promise<ClientPortalDocument[]> {
  const supabase = createSupabaseClient();
  const clientAccountId = await currentClientAccountId();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .neq("status", "deleted")
    .eq("is_latest_version", true)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return ((data ?? []) as unknown as DocumentRow[]).map((row) => toClientPortalDocument(row, clientAccountId));
}

async function getClientPortalDocumentById(id: string): Promise<ClientPortalDocument> {
  const supabase = createSupabaseClient();
  const clientAccountId = await currentClientAccountId();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("id", id)
    .eq("is_latest_version", true)
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) throw new NotFoundError(`Document ${id} was not found`);
  return toClientPortalDocument(data as unknown as DocumentRow, clientAccountId);
}

/**
 * Two-step, matching the internal getMediaAssetDownloadUrl() precedent:
 * get_client_document_storage_ref (security definer) validates access and
 * returns only storage_bucket/storage_path, then this function
 * immediately exchanges that for a real signed URL — the bucket/path
 * never leave this function, only the signed URL is ever returned.
 */
async function getClientPortalDocumentDownloadUrl(id: string): Promise<DataResult<string>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("get_client_document_storage_ref", { p_document_id: id });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && code.startsWith("P012")) return fail(error.message);
    throw normalizeSupabaseError(error);
  }
  const ref = data?.[0];
  if (!ref) return fail("This document is not available.");

  const { data: signed, error: signError } = await supabase.storage
    .from(ref.storage_bucket)
    .createSignedUrl(ref.storage_path, 3600);
  if (signError) throw normalizeSupabaseError(signError);

  return ok(signed.signedUrl);
}

async function getClientPortalOverview(): Promise<ClientPortalOverview> {
  const context = await supabaseClientAccessRepository.getCurrentClientAccountContext();
  const [events, contracts, invoices, documents] = await Promise.all([
    getClientPortalEvents(),
    getClientPortalContracts(),
    getClientPortalInvoices(),
    getClientPortalDocuments(),
  ]);

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

  const recentDocuments = [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  let nextRecommendedAction: string | null = null;
  if (nextDue) {
    nextRecommendedAction = `A payment of ${(nextDue.balance_minor / 100).toFixed(2)} ${nextDue.currency} is due${nextDue.due_date ? ` on ${new Date(nextDue.due_date).toLocaleDateString()}` : ""}.`;
  } else if (upcoming) {
    nextRecommendedAction = `Your event "${upcoming.title}" is coming up${upcoming.event_date ? ` on ${new Date(upcoming.event_date).toLocaleDateString()}` : ""}.`;
  }

  return {
    clientName: context?.clientName ?? "",
    upcomingEvent: upcoming ?? null,
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
  const account = await supabaseClientAccessRepository.getCurrentClientAccount();
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

export const supabaseClientPortalRepository: ClientPortalRepository = {
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
