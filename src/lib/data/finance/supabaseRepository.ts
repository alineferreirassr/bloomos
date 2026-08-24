import type { Database } from "@/types/database.types";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import type { JournalEntry } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import type { EntityType } from "@/core/enums/entityType";
import type { AccountType } from "@/core/enums/accountType";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { INVOICE_STATUS_LABELS } from "@/core/enums/invoiceStatus";
import { PAYMENT_STATUS_LABELS } from "@/core/enums/paymentStatus";
import { EXPENSE_STATUS_LABELS } from "@/core/enums/expenseStatus";
import { canTransitionInvoiceStatus, isInvoiceTerminal, getInvoiceNextRecommendedAction } from "@/core/workflows/invoiceWorkflow";
import {
  canTransitionPaymentStatus,
  isPaymentFinal,
  isPaymentRefundable,
  getPaymentNextRecommendedAction,
} from "@/core/workflows/paymentWorkflow";
import { canTransitionExpenseStatus, isExpenseTerminal, getExpenseNextRecommendedAction } from "@/core/workflows/expenseWorkflow";
import {
  invoiceSchema,
  invoiceAdjustmentSchema,
  paymentSchema,
  expenseSchema,
  manualAdjustmentInputSchema,
  journalEntryReversalInputSchema,
  expenseTransitionInputSchema,
  accountingPeriodCreateInputSchema,
  type InvoiceInput,
  type InvoiceAdjustmentInput,
  type PaymentInput,
  type ExpenseInput,
  type ManualAdjustmentInput,
  type PaymentSettlementInput,
  type ExpenseTransitionInput,
  type JournalEntryReversalInput,
  type AccountingPeriodCreateInput,
} from "@/modules/finance/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  mapInvoiceRow,
  mapPaymentRow,
  mapExpenseRow,
  mapClientRow,
  mapNoteRow,
  mapTimelineActivityRow,
  mapChartOfAccountRow,
  mapJournalEntryRow,
  mapJournalLineRow,
  mapAccountingPeriodRow,
} from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getCoreAuditLogService } from "@/core/audit";
import { handleFinanceRpcError, throwFinanceReportError } from "@/lib/data/finance/errors";
import type {
  InvoiceFilters,
  PaymentFilters,
  ExpenseFilters,
  ChartOfAccountFilters,
  JournalEntryFilters,
  AccountingPeriodFilters,
  GeneralLedgerReportFilters,
  TrialBalanceReportFilters,
  ProfitAndLossReportFilters,
  BalanceSheetReportFilters,
  FinanceRepository,
} from "@/lib/data/finance/repository";
import type {
  GeneralLedgerReport,
  GeneralLedgerAccount,
  GeneralLedgerTransaction,
  TrialBalanceReport,
  TrialBalanceRow,
  ProfitAndLossReport,
  BalanceSheetReport,
} from "@/types/financeReport";
import type { NormalBalance } from "@/core/enums/normalBalance";
import { validateTrialBalance, buildProfitAndLossSections, buildBalanceSheetSections, validateAccountingEquation } from "@/lib/data/finance/reportCalculations";
import { getFullName } from "@/lib/personName";

const DEFAULT_JOURNAL_ENTRY_PAGE_SIZE = 50;

type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceInsert = Omit<Database["public"]["Tables"]["invoices"]["Insert"], "invoice_number">;

const MAX_INVOICE_NUMBER_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";
const UNKNOWN_ERROR_CODE = "unknown";
/**
 * errcodes raised by process_payment_refund for expected, user-facing
 * validation failures — translated to a DataResult fail() rather than a
 * thrown error. P0001-P0004 are the original (migration 8) validation
 * codes; P1104/P1118 are Finance F1.8's additions, raised by the
 * post_payment_refund_reversal step process_payment_refund now composes
 * (duplicate reversal posting / no settlement entry to reverse); P1121 is
 * Finance F2.1C-B's addition — a defensive guard against an unbalanced
 * refund-vs-Revenue correction, expected to be unreachable. F2.1B-REVIEW's
 * P1120 (blanket rejection of invoice-linked refunds against recognized
 * Revenue) is retired as of F2.1C-B — no SQL path raises it any longer.
 * P1129/P1130 are Finance F2.1C-C-IDEMPOTENCY's additions — a request-level
 * idempotency key conflict, and a missing required idempotency key,
 * shared with record_deposit_application's own use of the same two codes.
 * P1131 is Finance F2.1C-D-B's addition — a defensive guard against the
 * refund correction's Invoice-field synchronization going negative,
 * expected to be unreachable given the existing refundable ceiling.
 */
const APP_VALIDATION_ERROR_CODES = new Set(["P0001", "P0002", "P0003", "P0004", "P1104", "P1118", "P1121", "P1129", "P1130", "P1131"]);

/**
 * errcodes raised by record_deposit_application for expected, user-facing
 * validation failures — Finance F2.1C-C. P1111/P1104/P1118 are reused with
 * their established meanings (not found / duplicate posting / no
 * settlement entry to build from — the last one added in F2.1C-C-REVIEW,
 * mirroring post_payment_refund_reversal's identical guard); P1122-P1128
 * are this checkpoint's new codes (over-application against the deposit
 * ceiling, over-application against the invoice's own balance, source
 * not an unapplied Customer Deposit, workspace/client mismatch, currency
 * mismatch, invoice not in an application-eligible status, invalid amount);
 * P1129/P1130 are Finance F2.1C-C-IDEMPOTENCY's additions — a request-level
 * idempotency key conflict, and a missing required idempotency key, shared
 * with process_payment_refund's own use of the same two codes.
 */
const DEPOSIT_APPLICATION_VALIDATION_ERROR_CODES = new Set([
  "P1111", "P1104", "P1118", "P1122", "P1123", "P1124", "P1125", "P1126", "P1127", "P1128", "P1129", "P1130",
]);

/**
 * errcodes raised by record_invoice_adjustment for expected, user-facing
 * validation failures — Finance F2.1C-D-C. P1111 is reused with its
 * established meaning (invoice not found); P1129/P1130 are reused with
 * their established Finance F2.1C-C-IDEMPOTENCY meanings (idempotency key
 * reused for a different payload, missing required idempotency key) —
 * shared with process_payment_refund/record_deposit_application's own use
 * of the same two codes, not a duplicate mechanism. P1132-P1135 are this
 * checkpoint's new codes: invoice not in an adjustment-eligible status,
 * no-op adjustment (requested values match the invoice's current values),
 * downward correction would drop the total below the amount already
 * collected, and a defensive invalid-financial-values guard (unreachable
 * via this repository's own schema validation below, mirroring P1121/
 * P1131's "should be unreachable" precedent).
 */
const INVOICE_ADJUSTMENT_VALIDATION_ERROR_CODES = new Set(["P1111", "P1129", "P1130", "P1132", "P1133", "P1134", "P1135"]);

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Same rationale as leads/clients/events/contracts supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/**
 * Finance Notes/Timeline are recorded against three different owner types
 * (invoice/payment/expense) — unlike Contracts' hardcoded 'contract', this
 * is parameterized like Events' insertTimelineActivity.
 */
async function insertTimelineActivity(
  supabase: SupabaseClient,
  actor: string,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  type: TimelineActivity["type"],
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Internal existence checks — return null rather than throwing, matching every other Supabase repository's fetchXRow pattern. RLS means a record in another Workspace is simply invisible here. */
async function fetchInvoiceRow(id: string): Promise<Invoice | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInvoiceRow(data) : null;
}

async function fetchPaymentRow(id: string): Promise<Payment | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapPaymentRow(data) : null;
}

async function fetchExpenseRow(id: string): Promise<Expense | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapExpenseRow(data) : null;
}

async function validateEventBelongsToClient(
  supabase: SupabaseClient,
  eventId: string,
  clientId: string,
): Promise<string | null> {
  const { data, error } = await supabase.from("events").select("client_id").eq("id", eventId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return "Event not found.";
  if (data.client_id !== clientId) return "The selected event doesn't belong to this client.";
  return null;
}

async function validateContractBelongsToClient(
  supabase: SupabaseClient,
  contractId: string,
  clientId: string,
): Promise<string | null> {
  const { data, error } = await supabase.from("contracts").select("client_id").eq("id", contractId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return "Contract not found.";
  if (data.client_id !== clientId) return "The selected contract doesn't belong to this client.";
  return null;
}

/**
 * Generates a candidate invoice_number via generate_invoice_number(), then
 * inserts. If a concurrent writer won the race for that exact number, the
 * workspace-scoped unique index rejects the insert with a 23505; this
 * retries with a freshly generated number — same pattern as Contracts'
 * insertContractWithGeneratedNumber.
 */
async function insertInvoiceWithGeneratedNumber(
  supabase: SupabaseClient,
  workspaceId: string,
  rowWithoutNumber: InvoiceInsert,
): Promise<{ data: InvoiceRow | null; error: { code?: string } | null }> {
  for (let attempt = 1; attempt <= MAX_INVOICE_NUMBER_ATTEMPTS; attempt++) {
    const { data: invoiceNumber, error: numberError } = await supabase.rpc("generate_invoice_number", {
      p_workspace_id: workspaceId,
    });
    if (numberError) throw normalizeSupabaseError(numberError);

    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...rowWithoutNumber, invoice_number: invoiceNumber as string })
      .select("*")
      .single();

    if (!error) return { data, error: null };
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION || attempt === MAX_INVOICE_NUMBER_ATTEMPTS) {
      return { data: null, error };
    }
    // Unique violation on invoice_number specifically — retry with a freshly generated one.
  }
  // Unreachable — the loop always returns on its final attempt.
  return { data: null, error: { code: UNKNOWN_ERROR_CODE } };
}

/** Wraps recompute_invoice_balance() — called after any Payment mutation that changes what's linked to an Invoice. Idempotent, so calling it is always safe. */
async function recomputeInvoiceBalance(supabase: SupabaseClient, invoiceId: string, actor: string): Promise<void> {
  const { error } = await supabase.rpc("recompute_invoice_balance", { p_invoice_id: invoiceId, p_actor: actor });
  if (error) throw normalizeSupabaseError(error);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

async function getInvoices(filters: InvoiceFilters = {}, context?: ServerRepositoryContext): Promise<Invoice[]> {
  const session = context?.session ?? (await requireWorkspaceSession());
  const {
    search,
    status,
    clientId,
    eventId,
    contractId,
    issueDateFrom,
    issueDateTo,
    dueDateFrom,
    dueDateTo,
    overdueOnly = false,
    includeArchived = false,
  } = filters;

  const supabase = context?.supabase ?? createSupabaseClient();
  let query = supabase.from("invoices").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) query = query.neq("status", "archived");
  if (overdueOnly) query = query.eq("status", "overdue");
  if (status && status !== "all") query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (eventId) query = query.eq("event_id", eventId);
  if (contractId) query = query.eq("contract_id", contractId);
  if (issueDateFrom) query = query.gte("issue_date", issueDateFrom);
  if (issueDateTo) query = query.lte("issue_date", issueDateTo);
  if (dueDateFrom) query = query.gte("due_date", dueDateFrom);
  if (dueDateTo) query = query.lte("due_date", dueDateTo);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  const invoices = (data ?? []).map(mapInvoiceRow);

  const q = search?.trim().toLowerCase();
  if (!q) return invoices;

  const { data: clientRows, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", session.workspace.id);
  if (clientsError) throw normalizeSupabaseError(clientsError);
  const clientsById = new Map((clientRows ?? []).map(mapClientRow).map((c) => [c.id, c]));

  const { data: eventRows, error: eventsError } = await supabase
    .from("events")
    .select("id, title")
    .eq("workspace_id", session.workspace.id);
  if (eventsError) throw normalizeSupabaseError(eventsError);
  const eventTitlesById = new Map((eventRows ?? []).map((e: { id: string; title: string }) => [e.id, e.title]));

  const { data: contractRows, error: contractsError } = await supabase
    .from("contracts")
    .select("id, contract_number")
    .eq("workspace_id", session.workspace.id);
  if (contractsError) throw normalizeSupabaseError(contractsError);
  const contractNumbersById = new Map(
    (contractRows ?? []).map((c: { id: string; contract_number: string }) => [c.id, c.contract_number]),
  );

  return invoices.filter((invoice) => {
    const client = clientsById.get(invoice.client_id);
    const clientName = client ? getFullName(client) : "";
    const eventTitle = invoice.event_id ? (eventTitlesById.get(invoice.event_id) ?? "") : "";
    const contractNumber = invoice.contract_id ? (contractNumbersById.get(invoice.contract_id) ?? "") : "";
    const haystack = `${invoice.invoice_number} ${invoice.title} ${clientName} ${eventTitle} ${contractNumber}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getInvoiceById(id: string): Promise<Invoice> {
  const invoice = await fetchInvoiceRow(id);
  if (!invoice) {
    throw new NotFoundError(`Invoice ${id} was not found`);
  }
  return invoice;
}

function computeInvoiceTotal(subtotalMinor: number, taxMinor: number, discountMinor: number): number {
  return subtotalMinor + taxMinor - discountMinor;
}

async function createInvoice(input: InvoiceInput): Promise<DataResult<Invoice>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.client_id)
    .maybeSingle();
  if (clientError) throw normalizeSupabaseError(clientError);
  if (!clientRow) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  const client = mapClientRow(clientRow);

  if (parsed.data.event_id !== null) {
    const error = await validateEventBelongsToClient(supabase, parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = await validateContractBelongsToClient(supabase, parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const total_minor = computeInvoiceTotal(parsed.data.subtotal_minor, parsed.data.tax_minor, parsed.data.discount_minor);

  const { data, error } = await insertInvoiceWithGeneratedNumber(supabase, client.workspace_id, {
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: "draft",
    total_minor,
    paid_minor: 0,
    balance_minor: total_minor,
  });
  if (error) throw normalizeSupabaseError(error);

  const invoice = mapInvoiceRow(data as InvoiceRow);
  await insertTimelineActivity(supabase, actor, invoice.workspace_id, "invoice", invoice.id, "invoice_created", `Invoice created: "${invoice.title}"`);

  return ok(invoice);
}

async function updateInvoice(id: string, input: InvoiceInput): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (isInvoiceTerminal(existing.status)) {
    return fail(`This invoice is ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} and read-only.`);
  }

  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  // Finance F2.1B — once an invoice leaves draft, Revenue has been recognized
  // against its current subtotal/tax/discount (source_type='invoice_issued').
  // Changing any of those fields now would silently diverge the ledger from
  // the Invoice record, with no correction posting to keep them in sync.
  // This requires a dedicated correction flow F2.1B does not implement
  // (F2.1C) — block the financially material fields, not the whole record,
  // so title/description/notes/due_date remain editable post-issuance.
  // Finance F2.1C-D-B (Founder decision D3): currency joins this same guard
  // — every recognized Journal Entry line for this invoice was posted in
  // its issued currency, and every refund/deposit-application correction
  // (F2.1C-B/F2.1C-C/F2.1C-D-B) assumes that currency never changes underneath
  // them. There is no FX-conversion correction flow, so this is a permanent
  // lock, not a deferred-flow block like subtotal/tax/discount above.
  if (
    existing.status !== "draft" &&
    (parsed.data.subtotal_minor !== existing.subtotal_minor ||
      parsed.data.tax_minor !== existing.tax_minor ||
      parsed.data.discount_minor !== existing.discount_minor)
  ) {
    return fail(
      "Cannot change the subtotal, tax, or discount after an invoice has been issued — Revenue has already been recognized. This requires a dedicated correction flow not yet available.",
    );
  }
  if (existing.status !== "draft" && parsed.data.currency !== existing.currency) {
    return fail("Cannot change the currency after an invoice has been issued — Revenue has already been recognized in the original currency.", {
      currency: "Currency cannot be changed after issuance.",
    });
  }
  if (parsed.data.client_id !== existing.client_id) {
    return fail("An invoice's client can't be changed after creation.", { client_id: "Client cannot be changed." });
  }

  const supabase = createSupabaseClient();
  if (parsed.data.event_id !== null) {
    const error = await validateEventBelongsToClient(supabase, parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = await validateContractBelongsToClient(supabase, parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const session = await requireWorkspaceSession();
  const total_minor = computeInvoiceTotal(parsed.data.subtotal_minor, parsed.data.tax_minor, parsed.data.discount_minor);
  const balance_minor = Math.max(0, total_minor - existing.paid_minor);

  const { data, error } = await supabase
    .from("invoices")
    .update({ ...parsed.data, total_minor, balance_minor })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInvoiceRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "invoice",
    id,
    "invoice_updated",
    `Invoice updated: "${updated.title}"`,
  );

  return ok(updated);
}

/**
 * Finance F2.1B — atomic version, composing issue_invoice_and_post_
 * revenue_recognition (status update + Revenue recognition posting in one
 * transaction) exactly the same way markPaymentSucceeded composes
 * mark_payment_succeeded_and_post_settlement. The pre-check against
 * canTransitionInvoiceStatus stays here (same TS-then-SQL double-check
 * pattern every other atomic Finance RPC call site already uses); the RPC
 * itself re-validates draft -> issued and raises P1105 if violated.
 */
async function issueInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "issued")) {
    return fail(`Cannot issue an invoice that is already ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("issue_invoice_and_post_revenue_recognition", {
    p_invoice_id: id,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<Invoice>(error);

  const updated = mapInvoiceRow(data as InvoiceRow);
  await insertTimelineActivity(supabase, actor, updated.workspace_id, "invoice", id, "invoice_issued", `Invoice issued: "${existing.title}"`);

  return ok(updated);
}

async function sendInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "sent")) {
    return fail(`Cannot send an invoice that is ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}. Issue it first.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInvoiceRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "invoice", id, "invoice_sent", `Invoice sent: "${existing.title}"`);

  return ok(updated);
}

/** Idempotent: re-marking an already-viewed invoice keeps its original viewed_at. */
async function markInvoiceViewed(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status === "viewed") {
    return ok(existing);
  }
  if (!canTransitionInvoiceStatus(existing.status, "viewed")) {
    return fail(`Cannot mark ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} invoice as viewed.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "viewed", viewed_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInvoiceRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "invoice", id, "invoice_viewed", `Invoice viewed: "${existing.title}"`);

  return ok(updated);
}

async function markInvoiceOverdue(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.due_date === null) {
    return fail("This invoice has no due date to be overdue against.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "overdue")) {
    return fail(`Cannot mark ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} invoice as overdue.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "overdue", overdue_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInvoiceRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "invoice", id, "invoice_overdue", `Invoice overdue: "${existing.title}"`);

  return ok(updated);
}

/**
 * Finance F2.1B — atomic version, composing void_invoice_and_reverse_
 * revenue_recognition. That RPC's own post_invoice_voided_reversal call
 * rejects (P1119) voiding an invoice with any payment applied — the
 * clean-case-only guard from F2.1A/F2.1B's scope. A no-recognition-existed
 * invoice (voided while still draft) reverses as a safe no-op.
 */
async function voidInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "voided")) {
    return fail(`Cannot void an invoice that is already ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("void_invoice_and_reverse_revenue_recognition", {
    p_invoice_id: id,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<Invoice>(error);

  const updated = mapInvoiceRow(data as InvoiceRow);
  await insertTimelineActivity(supabase, actor, updated.workspace_id, "invoice", id, "invoice_voided", `Invoice voided: "${existing.title}"`);

  return ok(updated);
}

async function archiveInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status === "archived") {
    return fail("This invoice is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInvoiceRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "invoice", id, "invoice_archived", "Invoice archived");

  return ok(updated);
}

/** Restoring returns the Invoice to "draft" — same "reasonable resumption point" precedent as restoreContract. */
async function restoreInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status !== "archived") {
    return fail("This invoice is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "draft", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInvoiceRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "invoice", id, "invoice_restored", "Invoice restored");

  return ok(updated);
}

/** Fresh draft copy of an Invoice's content with a new id/invoice_number, resetting status/paid_minor/balance_minor and every lifecycle timestamp — mirrors duplicateContract. */
async function duplicateInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = await fetchInvoiceRow(id);
  if (!existing) {
    return fail("Invoice not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await insertInvoiceWithGeneratedNumber(supabase, existing.workspace_id, {
    workspace_id: existing.workspace_id,
    client_id: existing.client_id,
    event_id: existing.event_id,
    contract_id: existing.contract_id,
    title: existing.title,
    description: existing.description,
    status: "draft",
    issue_date: null,
    due_date: null,
    subtotal_minor: existing.subtotal_minor,
    tax_minor: existing.tax_minor,
    discount_minor: existing.discount_minor,
    total_minor: existing.total_minor,
    paid_minor: 0,
    balance_minor: existing.total_minor,
    currency: existing.currency,
    notes: existing.notes,
  });
  if (error) throw normalizeSupabaseError(error);

  const duplicate = mapInvoiceRow(data as InvoiceRow);
  await insertTimelineActivity(
    supabase,
    actor,
    duplicate.workspace_id,
    "invoice",
    duplicate.id,
    "invoice_created",
    `Invoice created (duplicated from ${existing.invoice_number})`,
  );

  return ok(duplicate);
}

async function getInvoiceNextAction(invoiceId: string): Promise<string | null> {
  const invoice = await getInvoiceById(invoiceId);
  return getInvoiceNextRecommendedAction(invoice);
}

/**
 * Finance F2.1C-D-C. Only shape-validates client-side (subtotal/tax/
 * discount non-negative, discount <= subtotal) — deliberately NOT a
 * client-side state-eligibility/no-op/overpayment pre-check, matching
 * applyDepositToInvoice's own established design: those checks depend on
 * CURRENT database state and would risk spuriously rejecting a legitimate
 * replay against state that has already moved on since a prior successful
 * call (the exact staleness bug fixed in F2.1C-C-IDEMPOTENCY). The RPC is
 * the sole authority for anything state-dependent.
 */
async function recordInvoiceAdjustment(invoiceId: string, input: InvoiceAdjustmentInput, adjustmentId: string): Promise<DataResult<Invoice>> {
  const parsed = invoiceAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (!adjustmentId) {
    return fail(
      "adjustmentId is required and must be a stable identifier supplied by the caller (the same value on every retry of the same adjustment request).",
    );
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("record_invoice_adjustment", {
    p_invoice_id: invoiceId,
    p_subtotal_minor: parsed.data.subtotal_minor,
    p_tax_minor: parsed.data.tax_minor,
    p_discount_minor: parsed.data.discount_minor,
    p_reason: parsed.data.reason,
    p_adjustment_id: adjustmentId,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && INVOICE_ADJUSTMENT_VALIDATION_ERROR_CODES.has(code)) {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  return ok(mapInvoiceRow(data));
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

async function getPayments(filters: PaymentFilters = {}, context?: ServerRepositoryContext): Promise<Payment[]> {
  const session = context?.session ?? (await requireWorkspaceSession());
  const {
    search,
    status,
    paymentType,
    paymentMethod,
    clientId,
    eventId,
    invoiceId,
    contractId,
    dateFrom,
    dateTo,
    refundsOnly = false,
  } = filters;

  const supabase = context?.supabase ?? createSupabaseClient();
  let query = supabase.from("payments").select("*").eq("workspace_id", session.workspace.id);

  if (status && status !== "all") query = query.eq("status", status);
  if (paymentType && paymentType !== "all") query = query.eq("payment_type", paymentType);
  if (paymentMethod && paymentMethod !== "all") query = query.eq("payment_method", paymentMethod);
  if (refundsOnly) query = query.eq("payment_type", "refund");
  if (clientId) query = query.eq("client_id", clientId);
  if (eventId) query = query.eq("event_id", eventId);
  if (invoiceId) query = query.eq("invoice_id", invoiceId);
  if (contractId) query = query.eq("contract_id", contractId);
  if (dateFrom) query = query.gte("transaction_date", dateFrom);
  if (dateTo) query = query.lte("transaction_date", dateTo);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  const payments = (data ?? []).map(mapPaymentRow);

  const q = search?.trim().toLowerCase();
  if (!q) return payments;

  const { data: clientRows, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", session.workspace.id);
  if (clientsError) throw normalizeSupabaseError(clientsError);
  const clientsById = new Map((clientRows ?? []).map(mapClientRow).map((c) => [c.id, c]));

  const { data: eventRows, error: eventsError } = await supabase
    .from("events")
    .select("id, title")
    .eq("workspace_id", session.workspace.id);
  if (eventsError) throw normalizeSupabaseError(eventsError);
  const eventTitlesById = new Map((eventRows ?? []).map((e: { id: string; title: string }) => [e.id, e.title]));

  return payments.filter((payment) => {
    const client = clientsById.get(payment.client_id);
    const clientName = client ? getFullName(client) : "";
    const eventTitle = payment.event_id ? (eventTitlesById.get(payment.event_id) ?? "") : "";
    const haystack = `${clientName} ${eventTitle} ${payment.reference ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getPaymentById(id: string): Promise<Payment> {
  const payment = await fetchPaymentRow(id);
  if (!payment) {
    throw new NotFoundError(`Payment ${id} was not found`);
  }
  return payment;
}

/** Methods with no real payment-provider integration are recorded as already succeeded — there is no provider round trip to await. */
const IMMEDIATELY_SUCCEEDED_METHODS = new Set(["cash", "check", "bank_transfer", "ach", "zelle", "venmo"]);

/**
 * Finance F1.7 — the single canonical path that creates a Payment AND
 * posts its ledger settlement atomically, via the `record_payment_
 * settlement` RPC (one Postgres transaction: insert the row, then post
 * Dr 1000 Cash / Cr 1100 Accounts Receivable or Cr 2200 Customer Deposits).
 * Shared by createPayment (only when its own status computation already
 * decided "succeeded") and recordPaymentSettlement, so a Payment that
 * economically succeeds always reaches the ledger the same way regardless
 * of which UI screen recorded it — this is the fix for the F1.6 finding
 * that "Record Payment" and "Record Settlement" silently diverged (one
 * posted, one didn't, for what a user would reasonably consider the same
 * action). Every caller has already run its own client/event/contract/
 * invoice-ownership validation before reaching this helper — it performs
 * no additional business validation itself, only the insert+post call and
 * the two audit trails (Timeline + Audit Log) both prior paths already had
 * one or the other of, never both — this helper gives every caller both.
 */
async function insertSettledPayment(
  supabase: SupabaseClient,
  session: WorkspaceSession,
  actor: string,
  parsed: PaymentInput,
): Promise<DataResult<Payment>> {
  const { data, error } = await supabase.rpc("record_payment_settlement", {
    p_workspace_id: session.workspace.id,
    p_invoice_id: parsed.invoice_id,
    p_client_id: parsed.client_id,
    p_event_id: parsed.event_id,
    p_contract_id: parsed.contract_id,
    p_payment_type: parsed.payment_type,
    p_amount_minor: parsed.amount_minor,
    p_currency: parsed.currency,
    p_payment_method: parsed.payment_method,
    p_reference: parsed.reference,
    p_transaction_date: parsed.transaction_date,
    p_notes: parsed.notes,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<Payment>(error);

  const payment = mapPaymentRow(data as Database["public"]["Tables"]["payments"]["Row"]);

  await insertTimelineActivity(supabase, actor, payment.workspace_id, "payment", payment.id, "payment_created", "Payment created: Succeeded");
  await getCoreAuditLogService().recordAuditEvent(payment.workspace_id, {
    actor,
    action: "payment_settlement_recorded",
    ownerType: "payment",
    ownerId: payment.id,
    before: null,
    after: { amount_minor: payment.amount_minor, payment_method: payment.payment_method, invoice_id: payment.invoice_id },
  });

  return ok(payment);
}

async function createPayment(input: PaymentInput): Promise<DataResult<Payment>> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.client_id)
    .maybeSingle();
  if (clientError) throw normalizeSupabaseError(clientError);
  if (!clientRow) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  const client = mapClientRow(clientRow);

  if (parsed.data.event_id !== null) {
    const error = await validateEventBelongsToClient(supabase, parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = await validateContractBelongsToClient(supabase, parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }
  let invoice: Invoice | null = null;
  if (parsed.data.invoice_id !== null) {
    invoice = await fetchInvoiceRow(parsed.data.invoice_id);
    if (!invoice) {
      return fail("Please select a valid invoice.", { invoice_id: "Invoice not found." });
    }
    if (invoice.client_id !== parsed.data.client_id || invoice.workspace_id !== client.workspace_id) {
      return fail("The selected invoice doesn't belong to this client.", {
        invoice_id: "Invoice belongs to a different client.",
      });
    }
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const initialStatus = IMMEDIATELY_SUCCEEDED_METHODS.has(parsed.data.payment_method) ? "succeeded" : "pending";

  // No overpayment: a Payment that counts toward paid immediately can never
  // exceed what's actually still owed on its Invoice. Refund-type Payments
  // are exempt. A Payment starting pending/processing is re-checked when
  // it's later marked succeeded (markPaymentSucceeded).
  if (invoice && initialStatus === "succeeded" && parsed.data.payment_type !== "refund") {
    if (parsed.data.amount_minor > invoice.balance_minor) {
      return fail(
        `This payment (${parsed.data.amount_minor} minor units) would exceed the invoice's remaining balance (${invoice.balance_minor} minor units).`,
        { amount_minor: "Amount exceeds the remaining balance." },
      );
    }
  }

  // Finance F1.7 — a Payment that starts "succeeded" (an immediately-
  // succeeded method, or a refund — see IMMEDIATELY_SUCCEEDED_METHODS
  // above) is an economically-complete money movement the moment it's
  // created, so it goes through the same atomic insert+ledger-post RPC
  // recordPaymentSettlement uses, never a plain insert — this is the fix
  // for the F1.6 finding that "Record Payment" silently never reached the
  // ledger even when it recorded a payment as already succeeded. A
  // Payment that starts "pending" (e.g. a manually-recorded card/PayPal/
  // Stripe payment awaiting confirmation) correctly stays a plain insert —
  // posting to the ledger before the money has actually moved would be a
  // real accounting error, not merely a missed opportunity.
  if (initialStatus === "succeeded") {
    return insertSettledPayment(supabase, session, actor, parsed.data);
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      workspace_id: client.workspace_id,
      ...parsed.data,
      status: initialStatus,
      received_at: null,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const payment = mapPaymentRow(data);
  await insertTimelineActivity(
    supabase,
    actor,
    payment.workspace_id,
    "payment",
    payment.id,
    "payment_created",
    `Payment created: ${PAYMENT_STATUS_LABELS[initialStatus]}`,
  );

  return ok(payment);
}

/** General content edits — blocked once the Payment is final (isPaymentFinal). No dedicated "payment_updated" timeline type exists — a plain content edit intentionally records nothing. */
async function updatePayment(id: string, input: PaymentInput): Promise<DataResult<Payment>> {
  const existing = await fetchPaymentRow(id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (isPaymentFinal(existing.status)) {
    return fail(`This payment is ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} and read-only.`);
  }

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (parsed.data.client_id !== existing.client_id) {
    return fail("A payment's client can't be changed after creation.", { client_id: "Client cannot be changed." });
  }
  if (parsed.data.invoice_id !== existing.invoice_id) {
    return fail("A payment's linked invoice can't be changed after creation.", {
      invoice_id: "Invoice cannot be changed.",
    });
  }

  const supabase = createSupabaseClient();
  if (parsed.data.event_id !== null) {
    const error = await validateEventBelongsToClient(supabase, parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = await validateContractBelongsToClient(supabase, parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const { data, error } = await supabase.from("payments").update(parsed.data).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPaymentRow(data);
  if (updated.invoice_id && updated.status === "succeeded" && updated.amount_minor !== existing.amount_minor) {
    await recomputeInvoiceBalance(supabase, updated.invoice_id, actor);
  }

  return ok(updated);
}

async function markPaymentProcessing(id: string): Promise<DataResult<Payment>> {
  const existing = await fetchPaymentRow(id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "processing")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as processing.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "processing" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPaymentRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "payment", id, "payment_processing", "Payment processing");

  return ok(updated);
}

/**
 * Finance F1.8 — the atomic version. A single database transaction (the
 * mark_payment_succeeded_and_post_settlement RPC) validates the pending/
 * processing -> succeeded transition, updates status, recomputes the linked
 * Invoice balance, and posts the settlement — closing the F1.7-disclosed
 * gap where a status update and its ledger post were two separate calls
 * and a posting failure could leave a Payment persisted as "succeeded"
 * with no settlement entry. A posting failure now rolls back the whole
 * transaction: the caller gets a clean fail() and the Payment's status is
 * untouched, exactly as if nothing had been attempted.
 */
async function markPaymentSucceeded(id: string): Promise<DataResult<Payment>> {
  const existing = await fetchPaymentRow(id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "succeeded")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as succeeded.`);
  }

  const supabase = createSupabaseClient();
  // No overpayment: re-checked here (not just at createPayment) since a
  // pending/processing Payment can sit for a while. Deliberately stays a
  // TypeScript-layer check, not duplicated into the RPC — record_payment_
  // settlement (the sibling create-time path) doesn't enforce it in SQL
  // either, so this keeps both paths' business validation in the one place
  // it already lived, rather than a second copy that could drift.
  if (existing.invoice_id && existing.payment_type !== "refund") {
    const linkedInvoice = await fetchInvoiceRow(existing.invoice_id);
    if (linkedInvoice && existing.amount_minor > linkedInvoice.balance_minor) {
      return fail(
        `This payment (${existing.amount_minor} minor units) would exceed the invoice's remaining balance (${linkedInvoice.balance_minor} minor units).`,
      );
    }
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const { data, error } = await supabase.rpc("mark_payment_succeeded_and_post_settlement", {
    p_payment_id: id,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<Payment>(error);

  const updated = mapPaymentRow(data as Database["public"]["Tables"]["payments"]["Row"]);
  await insertTimelineActivity(supabase, actor, updated.workspace_id, "payment", id, "payment_succeeded", "Payment succeeded");

  return ok(updated);
}

async function markPaymentFailed(id: string): Promise<DataResult<Payment>> {
  const existing = await fetchPaymentRow(id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "failed")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as failed.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "failed", failed_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPaymentRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "payment", id, "payment_failed", "Payment failed");

  return ok(updated);
}

function refundReferenceFor(originalPaymentId: string): string {
  return `refund_of:${originalPaymentId}`;
}

function depositApplicationReferenceFor(depositPaymentId: string): string {
  return `deposit_application_of:${depositPaymentId}`;
}

/**
 * Delegates the atomic core (refundable-ceiling check, refund Payment
 * insert, original Payment status update, Timeline entry) to
 * process_payment_refund() — see migration 8's comment for why the row lock
 * there makes this race-safe. Expected validation failures (errcodes
 * P0001-P0004, plus Finance F1.8's P1104/P1118) are translated into a
 * DataResult fail() with the RPC's own message rather than thrown,
 * matching the mock's fail()-returning refundPayment exactly. Calls
 * recompute_invoice_balance() as a separate step afterward if the original
 * Payment was invoice-linked — same two-step pattern as the mock's
 * refundPayment() calling applyPaymentToInvoice() as its own last step.
 *
 * Finance F1.8 — process_payment_refund itself now ALSO posts the
 * proportional settlement reversal (Dr AR-or-Deposits / Cr Cash for the
 * refunded amount) in the same transaction as the operational refund — no
 * code change was needed at this call site, since it's the same RPC name,
 * same params, same return shape as before F1.8. See the migration's own
 * comment for why this can't reuse the whole-entry reverse_journal_entry.
 */
/**
 * Finance F2.1C-C-IDEMPOTENCY: `refundPaymentId` is a REQUIRED, caller-
 * supplied request-level idempotency key — see FinanceRepository's doc
 * comment. The prior client-side `isPaymentRefundable(original.status)`
 * pre-check is REMOVED here: on a REPLAY, `original.status` may already
 * have changed to refunded/partially_refunded as a RESULT of the first
 * call, which would make that pre-check incorrectly reject a legitimate
 * replay before the RPC's own replay-aware logic ever runs. Validation now
 * happens exclusively inside process_payment_refund, matching
 * applyDepositToInvoice's existing (no-client-pre-check) pattern —
 * consistent between the two, and correct on replay for both.
 */
async function refundPayment(originalPaymentId: string, amountMinor: number, refundPaymentId: string): Promise<DataResult<Payment>> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return fail("Enter a refund amount greater than zero.");
  }
  if (!refundPaymentId) {
    return fail("refundPaymentId is required and must be a stable identifier supplied by the caller (the same value on every retry of the same refund request).");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("process_payment_refund", {
    p_original_payment_id: originalPaymentId,
    p_amount_minor: amountMinor,
    p_refund_payment_id: refundPaymentId,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  const refund = mapPaymentRow(data);
  if (refund.invoice_id) {
    await recomputeInvoiceBalance(supabase, refund.invoice_id, actor);
  }

  return ok(refund);
}

const PAID_EQUIVALENT_STATUSES = new Set(["succeeded", "partially_refunded", "refunded"]);

async function sumPaymentsByReference(supabase: ReturnType<typeof createSupabaseClient>, reference: string): Promise<number> {
  const { data, error } = await supabase.from("payments").select("amount_minor, status").eq("reference", reference);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? [])
    .filter((p: { status: string }) => PAID_EQUIVALENT_STATUSES.has(p.status))
    .reduce((sum: number, p: { amount_minor: number }) => sum + p.amount_minor, 0);
}

async function getPaymentRefundableAmount(paymentId: string): Promise<number> {
  const payment = await fetchPaymentRow(paymentId);
  if (!payment || !isPaymentRefundable(payment.status)) return 0;

  const supabase = createSupabaseClient();
  const priorRefunds = await sumPaymentsByReference(supabase, refundReferenceFor(paymentId));
  // Finance F2.1C-C: a Customer Deposit already applied to an invoice is no
  // longer available to refund — always computed, naturally zero for an
  // invoice-linked payment since nothing can reference it as an application.
  const priorApplications = await sumPaymentsByReference(supabase, depositApplicationReferenceFor(paymentId));

  return Math.max(0, payment.amount_minor - priorRefunds - priorApplications);
}

async function cancelPayment(id: string): Promise<DataResult<Payment>> {
  const existing = await fetchPaymentRow(id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "cancelled")) {
    return fail(`Cannot cancel a payment that is ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPaymentRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "payment", id, "payment_cancelled", "Payment cancelled");

  return ok(updated);
}

async function getPaymentNextAction(paymentId: string): Promise<string | null> {
  const payment = await getPaymentById(paymentId);
  return getPaymentNextRecommendedAction(payment);
}

/**
 * Finance F2.1C-C. Same shape as refundPayment: client-side only checks the
 * conditions cheap/obvious enough to short-circuit before a round trip
 * (amount positivity), everything else (ceiling, workspace/client/currency
 * consistency, invoice status eligibility) is enforced server-side by
 * record_deposit_application and translated back through DEPOSIT_
 * APPLICATION_VALIDATION_ERROR_CODES.
 *
 * Finance F2.1C-C-IDEMPOTENCY: `applicationPaymentId` is a REQUIRED,
 * caller-supplied request-level idempotency key — same contract as
 * refundPayment's `refundPaymentId` (see its doc comment).
 */
async function applyDepositToInvoice(depositPaymentId: string, invoiceId: string, amountMinor: number, applicationPaymentId: string): Promise<DataResult<Payment>> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return fail("Enter a deposit application amount greater than zero.");
  }
  if (!applicationPaymentId) {
    return fail("applicationPaymentId is required and must be a stable identifier supplied by the caller (the same value on every retry of the same deposit application request).");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("record_deposit_application", {
    p_deposit_payment_id: depositPaymentId,
    p_invoice_id: invoiceId,
    p_amount_minor: amountMinor,
    p_application_payment_id: applicationPaymentId,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && DEPOSIT_APPLICATION_VALIDATION_ERROR_CODES.has(code)) {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  return ok(mapPaymentRow(data));
}

async function getDepositApplicableAmount(depositPaymentId: string): Promise<number> {
  const deposit = await fetchPaymentRow(depositPaymentId);
  if (!deposit || deposit.invoice_id !== null || !isPaymentRefundable(deposit.status)) return 0;

  const supabase = createSupabaseClient();
  const priorRefunds = await sumPaymentsByReference(supabase, refundReferenceFor(depositPaymentId));
  const priorApplications = await sumPaymentsByReference(supabase, depositApplicationReferenceFor(depositPaymentId));

  return Math.max(0, deposit.amount_minor - priorRefunds - priorApplications);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const UNPAID_EXPENSE_STATUSES = ["planned", "approved", "due"];

async function getExpenses(filters: ExpenseFilters = {}, context?: ServerRepositoryContext): Promise<Expense[]> {
  const session = context?.session ?? (await requireWorkspaceSession());
  const {
    search,
    status,
    category,
    eventId,
    clientId,
    unpaidOnly = false,
    dueOnly = false,
    reimbursableOnly = false,
    includeArchived = false,
  } = filters;

  const supabase = context?.supabase ?? createSupabaseClient();
  let query = supabase.from("expenses").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) query = query.neq("status", "archived");
  if (status && status !== "all") query = query.eq("status", status);
  if (category && category !== "all") query = query.eq("category", category);
  if (unpaidOnly) query = query.in("status", UNPAID_EXPENSE_STATUSES);
  if (dueOnly) query = query.eq("status", "due");
  if (reimbursableOnly) query = query.eq("reimbursable", true);
  if (eventId) query = query.eq("event_id", eventId);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  const expenses = (data ?? []).map(mapExpenseRow);

  const q = search?.trim().toLowerCase();
  if (!q) return expenses;
  return expenses.filter((expense) => expense.description.toLowerCase().includes(q));
}

async function getExpenseById(id: string): Promise<Expense> {
  const expense = await fetchExpenseRow(id);
  if (!expense) {
    throw new NotFoundError(`Expense ${id} was not found`);
  }
  return expense;
}

/** Expense's client_id is legitimately optional — workspace_id comes from the caller's own session, not derived from a required Client (mirrors the mock's use of CURRENT_WORKSPACE_ID). */
async function createExpense(input: ExpenseInput): Promise<DataResult<Expense>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  if (parsed.data.event_id !== null) {
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("client_id")
      .eq("id", parsed.data.event_id)
      .maybeSingle();
    if (eventError) throw normalizeSupabaseError(eventError);
    if (!eventRow) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (parsed.data.client_id !== null && eventRow.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.contract_id !== null) {
    const { data: contractRow, error: contractError } = await supabase
      .from("contracts")
      .select("client_id")
      .eq("id", parsed.data.contract_id)
      .maybeSingle();
    if (contractError) throw normalizeSupabaseError(contractError);
    if (!contractRow) {
      return fail("Please select a valid contract.", { contract_id: "Contract not found." });
    }
    if (parsed.data.client_id !== null && contractRow.client_id !== parsed.data.client_id) {
      return fail("The selected contract doesn't belong to this client.", {
        contract_id: "Contract belongs to a different client.",
      });
    }
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const { data, error } = await supabase
    .from("expenses")
    .insert({ workspace_id: session.workspace.id, ...parsed.data, status: "planned" })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const expense = mapExpenseRow(data);
  await insertTimelineActivity(supabase, actor, expense.workspace_id, "expense", expense.id, "expense_created", `Expense created: "${expense.description}"`);

  return ok(expense);
}

async function updateExpense(id: string, input: ExpenseInput): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (isExpenseTerminal(existing.status)) {
    return fail(`This expense is ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} and read-only.`);
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  if (parsed.data.event_id !== null) {
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("client_id")
      .eq("id", parsed.data.event_id)
      .maybeSingle();
    if (eventError) throw normalizeSupabaseError(eventError);
    if (!eventRow) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (parsed.data.client_id !== null && eventRow.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.contract_id !== null) {
    const { data: contractRow, error: contractError } = await supabase
      .from("contracts")
      .select("client_id")
      .eq("id", parsed.data.contract_id)
      .maybeSingle();
    if (contractError) throw normalizeSupabaseError(contractError);
    if (!contractRow) {
      return fail("Please select a valid contract.", { contract_id: "Contract not found." });
    }
    if (parsed.data.client_id !== null && contractRow.client_id !== parsed.data.client_id) {
      return fail("The selected contract doesn't belong to this client.", {
        contract_id: "Contract belongs to a different client.",
      });
    }
  }

  const session = await requireWorkspaceSession();
  const { data, error } = await supabase.from("expenses").update(parsed.data).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "expense",
    id,
    "expense_updated",
    `Expense updated: "${updated.description}"`,
  );

  return ok(updated);
}

async function approveExpense(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "approved")) {
    return fail(`Cannot approve an expense that is already ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "approved" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_approved", "Expense approved");

  return ok(updated);
}

async function markExpenseDue(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "due")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as due.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("expenses").update({ status: "due" }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_marked_due", "Expense marked due");

  return ok(updated);
}

async function markExpensePaid(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "paid")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as paid.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "paid", paid_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_paid", "Expense paid");

  return ok(updated);
}

async function markExpenseReimbursed(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!existing.reimbursable) {
    return fail("This expense isn't marked reimbursable.");
  }
  if (!canTransitionExpenseStatus(existing.status, "reimbursed")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as reimbursed.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "reimbursed", reimbursed_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_reimbursed", "Expense reimbursed");

  return ok(updated);
}

async function cancelExpense(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "cancelled")) {
    return fail(`Cannot cancel an expense that is already ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_cancelled", "Expense cancelled");

  return ok(updated);
}

async function archiveExpense(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (existing.status === "archived") {
    return fail("This expense is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_archived", "Expense archived");

  return ok(updated);
}

/** Restoring returns the Expense to "planned" — same "reasonable resumption point" precedent as restoreContract/restoreInvoice. */
async function restoreExpense(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (existing.status !== "archived") {
    return fail("This expense is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "planned", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapExpenseRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "expense", id, "expense_restored", "Expense restored");

  return ok(updated);
}

/** Fresh "planned" copy of an Expense's content with a new id, resetting status/paid_at/reimbursed_at/archived_at — mirrors duplicateContract/duplicateInvoice. */
async function duplicateExpense(id: string): Promise<DataResult<Expense>> {
  const existing = await fetchExpenseRow(id);
  if (!existing) {
    return fail("Expense not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      workspace_id: existing.workspace_id,
      event_id: existing.event_id,
      client_id: existing.client_id,
      contract_id: existing.contract_id,
      supplier_id: existing.supplier_id,
      team_member_id: existing.team_member_id,
      category: existing.category,
      status: "planned",
      description: existing.description,
      amount_minor: existing.amount_minor,
      currency: existing.currency,
      transaction_date: existing.transaction_date,
      due_date: existing.due_date,
      reimbursable: existing.reimbursable,
      reference: existing.reference,
      notes: existing.notes,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const duplicate = mapExpenseRow(data);
  await insertTimelineActivity(
    supabase,
    actor,
    duplicate.workspace_id,
    "expense",
    duplicate.id,
    "expense_created",
    `Expense created (duplicated from ${existing.id})`,
  );

  return ok(duplicate);
}

async function getExpenseNextAction(expenseId: string): Promise<string | null> {
  const expense = await getExpenseById(expenseId);
  return getExpenseNextRecommendedAction(expense);
}

// ---------------------------------------------------------------------------
// Invoice/Payment/Expense Notes and Timeline — reuse the shared
// owner_type/owner_id Notes and Timeline tables, same precedent as
// Contract Notes/Timeline.
// ---------------------------------------------------------------------------

async function fetchNotesForOwner(ownerType: EntityType, workspaceId: string, ownerId: string): Promise<Note[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNoteRow);
}

async function createNoteForOwner(
  ownerType: EntityType,
  workspaceId: string,
  ownerId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      owner_type: ownerType,
      owner_id: ownerId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await insertTimelineActivity(supabase, actor, workspaceId, ownerType, ownerId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

async function togglePinNoteForOwner(ownerType: EntityType, noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data: noteRow, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("owner_type", ownerType)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (fetchError) throw normalizeSupabaseError(fetchError);
  if (!noteRow) return null;

  const note = mapNoteRow(noteRow);
  const nextPinned = !note.is_pinned;
  const { data: updatedRow, error: updateError } = await supabase
    .from("notes")
    .update({ is_pinned: nextPinned })
    .eq("id", noteId)
    .eq("owner_type", ownerType)
    .eq("owner_id", note.owner_id)
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const updated = mapNoteRow(updatedRow);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    note.workspace_id,
    ownerType,
    note.owner_id,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${note.title}"`,
  );

  return ok(updated);
}

async function fetchTimelineForOwner(ownerType: EntityType, workspaceId: string, ownerId: string): Promise<TimelineActivity[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapTimelineActivityRow);
}

async function getNotesByInvoiceId(invoiceId: string): Promise<Note[]> {
  const invoice = await fetchInvoiceRow(invoiceId);
  if (!invoice) return [];
  return fetchNotesForOwner("invoice", invoice.workspace_id, invoiceId);
}

async function createInvoiceNote(invoiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const invoice = await fetchInvoiceRow(invoiceId);
  if (!invoice) {
    return fail("Invoice not found.");
  }
  return createNoteForOwner("invoice", invoice.workspace_id, invoiceId, input);
}

async function togglePinInvoiceNote(noteId: string): Promise<DataResult<Note> | null> {
  return togglePinNoteForOwner("invoice", noteId);
}

async function getTimelineByInvoiceId(invoiceId: string): Promise<TimelineActivity[]> {
  const invoice = await fetchInvoiceRow(invoiceId);
  if (!invoice) return [];
  return fetchTimelineForOwner("invoice", invoice.workspace_id, invoiceId);
}

async function getNotesByPaymentId(paymentId: string): Promise<Note[]> {
  const payment = await fetchPaymentRow(paymentId);
  if (!payment) return [];
  return fetchNotesForOwner("payment", payment.workspace_id, paymentId);
}

async function createPaymentNote(paymentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const payment = await fetchPaymentRow(paymentId);
  if (!payment) {
    return fail("Payment not found.");
  }
  return createNoteForOwner("payment", payment.workspace_id, paymentId, input);
}

async function togglePinPaymentNote(noteId: string): Promise<DataResult<Note> | null> {
  return togglePinNoteForOwner("payment", noteId);
}

async function getTimelineByPaymentId(paymentId: string): Promise<TimelineActivity[]> {
  const payment = await fetchPaymentRow(paymentId);
  if (!payment) return [];
  return fetchTimelineForOwner("payment", payment.workspace_id, paymentId);
}

async function getNotesByExpenseId(expenseId: string): Promise<Note[]> {
  const expense = await fetchExpenseRow(expenseId);
  if (!expense) return [];
  return fetchNotesForOwner("expense", expense.workspace_id, expenseId);
}

async function createExpenseNote(expenseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const expense = await fetchExpenseRow(expenseId);
  if (!expense) {
    return fail("Expense not found.");
  }
  return createNoteForOwner("expense", expense.workspace_id, expenseId, input);
}

async function togglePinExpenseNote(noteId: string): Promise<DataResult<Note> | null> {
  return togglePinNoteForOwner("expense", noteId);
}

async function getTimelineByExpenseId(expenseId: string): Promise<TimelineActivity[]> {
  const expense = await fetchExpenseRow(expenseId);
  if (!expense) return [];
  return fetchTimelineForOwner("expense", expense.workspace_id, expenseId);
}

// ---------------------------------------------------------------------------
// Finance Ledger (Repository Layer phase). Consumes the already-approved
// Finance Posting Engine RPCs — no accounting logic (balance checks,
// account resolution, idempotency) is re-derived here, only shape
// validation, error translation, result mapping, and one Core Audit entry
// per successful write. See core/audit's own doc comment for the same
// mock-only-this-phase disclosure Purchases/Inventory already carry:
// getCoreAuditLogService() writes to an in-memory store regardless of data
// mode, so a Supabase-backed session's Audit entries are not currently
// durable — an existing, disclosed Core limitation, not something this
// phase attempts to fix.
// ---------------------------------------------------------------------------

async function fetchChartOfAccountRow(id: string): Promise<Database["public"]["Tables"]["chart_of_accounts"]["Row"] | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("chart_of_accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data;
}

async function listChartOfAccounts(filters: ChartOfAccountFilters = {}): Promise<ChartOfAccount[]> {
  const session = await requireWorkspaceSession();
  const { includeArchived = false, accountType } = filters;
  const supabase = createSupabaseClient();
  let query = supabase.from("chart_of_accounts").select("*").eq("workspace_id", session.workspace.id);
  if (!includeArchived) query = query.is("archived_at", null);
  if (accountType && accountType !== "all") query = query.eq("account_type", accountType);
  const { data, error } = await query.order("account_number", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapChartOfAccountRow);
}

async function getChartOfAccount(id: string): Promise<ChartOfAccount> {
  const row = await fetchChartOfAccountRow(id);
  if (!row) {
    throw new NotFoundError(`Chart of Accounts entry ${id} was not found`);
  }
  return mapChartOfAccountRow(row);
}

async function fetchJournalEntryRow(id: string): Promise<Database["public"]["Tables"]["journal_entries"]["Row"] | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("journal_entries").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data;
}

/**
 * accountId filtering is a real two-step query (journal_lines -> matching
 * entry ids -> journal_entries), not a client-side filter, so it stays
 * efficient regardless of ledger volume. Pagination uses Postgrest's
 * native .range() — no cursor/page-token scheme exists elsewhere in this
 * codebase to match, so this is the smallest addition rather than a new
 * convention every other list method would need to adopt too. Ordering by
 * (entry_date desc, id desc) is fully deterministic even when multiple
 * entries share the same entry_date.
 */
async function listJournalEntries(filters: JournalEntryFilters = {}): Promise<JournalEntry[]> {
  const session = await requireWorkspaceSession();
  const { dateFrom, dateTo, sourceType, postingStatus, accountId, limit = DEFAULT_JOURNAL_ENTRY_PAGE_SIZE, offset = 0 } = filters;
  const supabase = createSupabaseClient();

  let entryIdsForAccount: string[] | null = null;
  if (accountId) {
    const { data, error } = await supabase
      .from("journal_lines")
      .select("journal_entry_id")
      .eq("workspace_id", session.workspace.id)
      .eq("account_id", accountId);
    if (error) throw normalizeSupabaseError(error);
    entryIdsForAccount = Array.from(new Set((data ?? []).map((row) => row.journal_entry_id)));
    if (entryIdsForAccount.length === 0) return [];
  }

  let query = supabase.from("journal_entries").select("*").eq("workspace_id", session.workspace.id);
  if (dateFrom) query = query.gte("entry_date", dateFrom);
  if (dateTo) query = query.lte("entry_date", dateTo);
  if (sourceType && sourceType !== "all") query = query.eq("source_type", sourceType);
  if (postingStatus && postingStatus !== "all") query = query.eq("posting_status", postingStatus);
  if (entryIdsForAccount) query = query.in("id", entryIdsForAccount);

  const { data, error } = await query
    .order("entry_date", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapJournalEntryRow);
}

/** Attaches lines + a chart_of_accounts join (account_number/name/account_type per line) — two queries, not an embedded Postgrest join, since chart_of_accounts/journal_lines carry no Relationships metadata in database.types.ts for the typed client to infer one from. */
async function getJournalEntry(id: string): Promise<JournalEntry> {
  const row = await fetchJournalEntryRow(id);
  if (!row) {
    throw new NotFoundError(`Journal entry ${id} was not found`);
  }
  const entry = mapJournalEntryRow(row);

  const supabase = createSupabaseClient();
  const { data: lineRows, error: lineError } = await supabase
    .from("journal_lines")
    .select("*")
    .eq("journal_entry_id", id)
    .order("line_order", { ascending: true });
  if (lineError) throw normalizeSupabaseError(lineError);

  const lines = (lineRows ?? []).map(mapJournalLineRow);
  const accountIds = Array.from(new Set(lines.map((line) => line.account_id)));
  const accountsById = new Map<string, { account_number: number; name: string; account_type: AccountType }>();
  if (accountIds.length > 0) {
    const { data: accountRows, error: accountError } = await supabase
      .from("chart_of_accounts")
      .select("id, account_number, name, account_type")
      .in("id", accountIds);
    if (accountError) throw normalizeSupabaseError(accountError);
    for (const account of accountRows ?? []) {
      accountsById.set(account.id, { account_number: account.account_number, name: account.name, account_type: account.account_type as AccountType });
    }
  }

  entry.lines = lines.map((line) => ({ ...line, account: accountsById.get(line.account_id) }));
  return entry;
}

async function fetchAccountingPeriodRow(id: string): Promise<Database["public"]["Tables"]["accounting_periods"]["Row"] | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("accounting_periods").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data;
}

async function listAccountingPeriods(filters: AccountingPeriodFilters = {}): Promise<AccountingPeriod[]> {
  const session = await requireWorkspaceSession();
  const { status } = filters;
  const supabase = createSupabaseClient();
  let query = supabase.from("accounting_periods").select("*").eq("workspace_id", session.workspace.id);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query.order("period_start", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapAccountingPeriodRow);
}

async function getAccountingPeriod(id: string): Promise<AccountingPeriod> {
  const row = await fetchAccountingPeriodRow(id);
  if (!row) {
    throw new NotFoundError(`Accounting period ${id} was not found`);
  }
  return mapAccountingPeriodRow(row);
}

/**
 * Finance Reports Foundation — every method below calls a database-side
 * report RPC (never re-aggregating the ledger in TypeScript) and reshapes
 * the RPC's flat rows into the nested report domain shape via the same
 * shared reportCalculations.ts helpers the mock repository uses, so the two
 * can never compute a report differently. A report's own input-validation
 * failure (e.g. an invalid date range, P1200) throws a plain Error via
 * throwFinanceReportError, matching every other read in this repository.
 * See docs/finance-reports.md.
 */

async function getGeneralLedgerReport(filters: GeneralLedgerReportFilters): Promise<GeneralLedgerReport> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("finance_general_ledger_report", {
    p_workspace_id: session.workspace.id,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_account_id: filters.accountId ?? null,
    p_account_type: filters.accountType ?? null,
    p_source_type: filters.sourceType ?? null,
  });
  if (error) throwFinanceReportError(error);

  const accountsById = new Map<string, GeneralLedgerAccount>();
  for (const row of data ?? []) {
    let account = accountsById.get(row.account_id);
    if (!account) {
      account = {
        accountId: row.account_id,
        accountNumber: row.account_number,
        accountName: row.account_name,
        accountType: row.account_type as GeneralLedgerAccount["accountType"],
        normalBalance: row.normal_balance as NormalBalance,
        openingBalanceMinor: row.opening_balance_minor,
        transactions: [],
        closingBalanceMinor: row.opening_balance_minor,
      };
      accountsById.set(row.account_id, account);
    }
    if (row.journal_entry_id !== null && row.journal_line_id !== null) {
      const transaction: GeneralLedgerTransaction = {
        journalEntryId: row.journal_entry_id,
        entryDate: row.entry_date!,
        memo: row.memo,
        sourceType: row.source_type!,
        sourceId: row.source_id,
        postingStatus: row.posting_status!,
        journalLineId: row.journal_line_id,
        lineMemo: row.line_memo,
        debitMinor: row.debit_minor!,
        creditMinor: row.credit_minor!,
        runningBalanceMinor: row.running_balance_minor,
      };
      account.transactions.push(transaction);
      account.closingBalanceMinor = row.running_balance_minor;
    }
  }

  return {
    workspaceId: session.workspace.id,
    generatedAt: new Date().toISOString(),
    startDate: filters.startDate,
    endDate: filters.endDate,
    accounts: Array.from(accountsById.values()),
  };
}

async function getTrialBalanceReport(filters: TrialBalanceReportFilters): Promise<TrialBalanceReport> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("finance_trial_balance_report", {
    p_workspace_id: session.workspace.id,
    p_as_of_date: filters.asOfDate,
    p_include_zero_balances: filters.includeZeroBalances ?? false,
  });
  if (error) throwFinanceReportError(error);

  const rows: TrialBalanceRow[] = (data ?? []).map((row) => {
    const net = row.total_debit_minor - row.total_credit_minor;
    return {
      accountId: row.account_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      accountType: row.account_type as TrialBalanceRow["accountType"],
      normalBalance: row.normal_balance as NormalBalance,
      isArchived: row.is_archived,
      debitMinor: row.total_debit_minor,
      creditMinor: row.total_credit_minor,
      endingDebitMinor: net >= 0 ? net : 0,
      endingCreditMinor: net < 0 ? -net : 0,
    };
  });

  const { isBalanced, totalEndingDebitMinor, totalEndingCreditMinor } = validateTrialBalance(rows);

  return {
    workspaceId: session.workspace.id,
    generatedAt: new Date().toISOString(),
    asOfDate: filters.asOfDate,
    rows,
    totalEndingDebitMinor,
    totalEndingCreditMinor,
    isBalanced,
  };
}

async function getProfitAndLossReport(filters: ProfitAndLossReportFilters): Promise<ProfitAndLossReport> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("finance_profit_and_loss_report", {
    p_workspace_id: session.workspace.id,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_comparison_start_date: filters.comparison?.startDate ?? null,
    p_comparison_end_date: filters.comparison?.endDate ?? null,
  });
  if (error) throwFinanceReportError(error);

  const movements = (data ?? []).map((row) => ({
    accountId: row.account_id,
    accountNumber: row.account_number,
    accountName: row.account_name,
    accountType: row.account_type as ProfitAndLossReport["sections"][number]["rows"][number]["accountType"],
    normalBalance: row.normal_balance as NormalBalance,
    currentDebitMinor: row.current_debit_minor,
    currentCreditMinor: row.current_credit_minor,
    comparisonDebitMinor: row.comparison_debit_minor,
    comparisonCreditMinor: row.comparison_credit_minor,
  }));

  const { sections, netIncomeMinor, comparisonNetIncomeMinor } = buildProfitAndLossSections(movements, !!filters.comparison);

  return {
    workspaceId: session.workspace.id,
    generatedAt: new Date().toISOString(),
    startDate: filters.startDate,
    endDate: filters.endDate,
    comparisonStartDate: filters.comparison?.startDate ?? null,
    comparisonEndDate: filters.comparison?.endDate ?? null,
    sections,
    netIncomeMinor,
    comparisonNetIncomeMinor,
  };
}

async function getBalanceSheetReport(filters: BalanceSheetReportFilters): Promise<BalanceSheetReport> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc("finance_balance_sheet_report", {
    p_workspace_id: session.workspace.id,
    p_as_of_date: filters.asOfDate,
  });
  if (error) throwFinanceReportError(error);

  const rows = data ?? [];
  const currentPeriodEarningsMinor = rows[0]?.current_period_earnings_minor ?? 0;
  const balances = rows.map((row) => ({
    accountId: row.account_id,
    accountNumber: row.account_number,
    accountName: row.account_name,
    accountType: row.account_type as BalanceSheetReport["sections"][number]["rows"][number]["accountType"],
    parentAccountId: row.parent_account_id,
    closingBalanceMinor: row.closing_balance_minor,
  }));

  const { sections, totalAssetsMinor, totalLiabilitiesMinor, totalEquityMinor } = buildBalanceSheetSections(
    balances,
    currentPeriodEarningsMinor,
  );

  return {
    workspaceId: session.workspace.id,
    generatedAt: new Date().toISOString(),
    asOfDate: filters.asOfDate,
    sections,
    totalAssetsMinor,
    totalLiabilitiesMinor,
    totalEquityMinor,
    currentPeriodEarningsMinor,
    isBalanced: validateAccountingEquation(totalAssetsMinor, totalLiabilitiesMinor, totalEquityMinor),
  };
}

/**
 * Finance F1.7 — delegates to the same canonical `insertSettledPayment`
 * helper `createPayment` now uses for its own "succeeded" branch (see that
 * helper's doc comment). This function's only remaining distinct behavior
 * is rejecting `payment_method === "stripe"` before validation even runs —
 * Settlement forces every non-Stripe method to post as already-succeeded
 * regardless of whether it's one of `createPayment`'s
 * IMMEDIATELY_SUCCEEDED_METHODS, which is the genuine, still-useful
 * distinction between the two screens: "I already know this money moved,
 * post it now" vs. "record what I was told, infer whether it's settled."
 */
async function recordPaymentSettlement(input: PaymentSettlementInput): Promise<DataResult<Payment>> {
  if (input.payment_method === "stripe") {
    return fail("Stripe payments are not supported in this phase — record only manual/internal payment methods.");
  }

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  return insertSettledPayment(supabase, session, actor, parsed.data);
}

async function recordExpenseTransition(expenseId: string, input: ExpenseTransitionInput): Promise<DataResult<Expense>> {
  const parsed = expenseTransitionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const existing = await fetchExpenseRow(expenseId);
  if (!existing) {
    return fail("Expense not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("record_expense_transition", {
    p_expense_id: expenseId,
    p_transition: parsed.data.transition,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<Expense>(error);

  const expense = mapExpenseRow(data as Database["public"]["Tables"]["expenses"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(expense.workspace_id, {
    actor,
    action: `expense_${parsed.data.transition}`,
    ownerType: "expense",
    ownerId: expense.id,
    before: { status: existing.status },
    after: { status: expense.status },
  });

  return ok(expense);
}

/** Balance equality (total debits = total credits) is validated by record_manual_adjustment's own P1106 check, not re-checked here — see modules/finance/schema.ts's manualAdjustmentInputSchema doc comment. */
async function recordManualAdjustment(input: ManualAdjustmentInput): Promise<DataResult<JournalEntry>> {
  const parsed = manualAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("record_manual_adjustment", {
    p_workspace_id: session.workspace.id,
    p_entry_date: parsed.data.entry_date,
    p_memo: parsed.data.memo,
    p_lines: parsed.data.lines.map((line, index) => ({
      account_id: line.account_id,
      debit_minor: line.debit_minor,
      credit_minor: line.credit_minor,
      line_memo: line.line_memo ?? null,
      line_order: index,
    })),
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<JournalEntry>(error);

  const entry = mapJournalEntryRow(data as Database["public"]["Tables"]["journal_entries"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(entry.workspace_id, {
    actor,
    action: "manual_adjustment_recorded",
    ownerType: "journal_entry",
    ownerId: entry.id,
    before: null,
    after: { memo: entry.memo, line_count: parsed.data.lines.length },
  });

  return ok(entry);
}

/** Never updates the original entry directly — reverse_journal_entry sets reversed_by_entry_id on it itself, inside the same RPC transaction; this repository only reads/maps the RPC's result. */
async function reverseJournalEntry(journalEntryId: string, input: JournalEntryReversalInput): Promise<DataResult<JournalEntry>> {
  const parsed = journalEntryReversalInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const original = await fetchJournalEntryRow(journalEntryId);
  if (!original) {
    return fail("Journal entry not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("reverse_journal_entry", {
    p_journal_entry_id: journalEntryId,
    p_reason: parsed.data.reason,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<JournalEntry>(error);

  const reversal = mapJournalEntryRow(data as Database["public"]["Tables"]["journal_entries"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(reversal.workspace_id, {
    actor,
    action: "journal_entry_reversed",
    ownerType: "journal_entry",
    ownerId: journalEntryId,
    before: { reversed_by_entry_id: null },
    after: { reversed_by_entry_id: reversal.id },
  });

  return ok(reversal);
}

async function createAccountingPeriod(input: AccountingPeriodCreateInput): Promise<DataResult<AccountingPeriod>> {
  const parsed = accountingPeriodCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("create_accounting_period", {
    p_workspace_id: session.workspace.id,
    p_period_start: parsed.data.period_start,
    p_period_end: parsed.data.period_end,
    p_actor: actor,
  });
  if (error) return handleFinanceRpcError<AccountingPeriod>(error);

  const period = mapAccountingPeriodRow(data as Database["public"]["Tables"]["accounting_periods"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(period.workspace_id, {
    actor,
    action: "accounting_period_created",
    ownerType: "accounting_period",
    ownerId: period.id,
    before: null,
    after: { period_start: period.period_start, period_end: period.period_end },
  });

  return ok(period);
}

async function closeAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>> {
  const existing = await fetchAccountingPeriodRow(id);
  if (!existing) {
    return fail("Accounting period not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("close_period", { p_period_id: id, p_actor: actor });
  if (error) return handleFinanceRpcError<AccountingPeriod>(error);

  const period = mapAccountingPeriodRow(data as Database["public"]["Tables"]["accounting_periods"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(period.workspace_id, {
    actor,
    action: "accounting_period_closed",
    ownerType: "accounting_period",
    ownerId: period.id,
    before: { status: existing.status },
    after: { status: period.status },
  });

  return ok(period);
}

async function lockAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>> {
  const existing = await fetchAccountingPeriodRow(id);
  if (!existing) {
    return fail("Accounting period not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("lock_period", { p_period_id: id, p_actor: actor });
  if (error) return handleFinanceRpcError<AccountingPeriod>(error);

  const period = mapAccountingPeriodRow(data as Database["public"]["Tables"]["accounting_periods"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(period.workspace_id, {
    actor,
    action: "accounting_period_locked",
    ownerType: "accounting_period",
    ownerId: period.id,
    before: { status: existing.status },
    after: { status: period.status },
  });

  return ok(period);
}

export const supabaseFinanceRepository: FinanceRepository = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  issueInvoice,
  sendInvoice,
  markInvoiceViewed,
  markInvoiceOverdue,
  voidInvoice,
  archiveInvoice,
  restoreInvoice,
  duplicateInvoice,
  getInvoiceNextAction,
  recordInvoiceAdjustment,
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  markPaymentProcessing,
  markPaymentSucceeded,
  markPaymentFailed,
  cancelPayment,
  refundPayment,
  getPaymentRefundableAmount,
  getPaymentNextAction,
  applyDepositToInvoice,
  getDepositApplicableAmount,
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  approveExpense,
  markExpenseDue,
  markExpensePaid,
  markExpenseReimbursed,
  cancelExpense,
  archiveExpense,
  restoreExpense,
  duplicateExpense,
  getExpenseNextAction,
  getNotesByInvoiceId,
  createInvoiceNote,
  togglePinInvoiceNote,
  getTimelineByInvoiceId,
  getNotesByPaymentId,
  createPaymentNote,
  togglePinPaymentNote,
  getTimelineByPaymentId,
  getNotesByExpenseId,
  createExpenseNote,
  togglePinExpenseNote,
  getTimelineByExpenseId,
  listChartOfAccounts,
  getChartOfAccount,
  listJournalEntries,
  getJournalEntry,
  listAccountingPeriods,
  getAccountingPeriod,
  recordPaymentSettlement,
  recordExpenseTransition,
  recordManualAdjustment,
  reverseJournalEntry,
  createAccountingPeriod,
  closeAccountingPeriod,
  lockAccountingPeriod,
  getGeneralLedgerReport,
  getTrialBalanceReport,
  getProfitAndLossReport,
  getBalanceSheetReport,
};
