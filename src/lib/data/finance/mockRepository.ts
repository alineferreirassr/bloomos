import type { Invoice } from "@/types/invoice";
import type { Client } from "@/types/client";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import type { JournalEntry, JournalLine } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import type { ExpenseCategory } from "@/core/enums/expenseCategory";
import { NotFoundError } from "@/core/errors";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/core/enums/invoiceStatus";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
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
  paymentSchema,
  expenseSchema,
  manualAdjustmentInputSchema,
  journalEntryReversalInputSchema,
  expenseTransitionInputSchema,
  accountingPeriodCreateInputSchema,
  type InvoiceInput,
  type PaymentInput,
  type ExpenseInput,
  type ManualAdjustmentInput,
  type PaymentSettlementInput,
  type ExpenseTransitionInput,
  type JournalEntryReversalInput,
  type AccountingPeriodCreateInput,
} from "@/modules/finance/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import { addMinor, subtractMinor, sumMinor, calculateBalance } from "@/lib/money";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { getCoreAuditLogService } from "@/core/audit";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { readInvoices, writeInvoices } from "@/lib/data/mock/invoicesStore";
import { readPayments, writePayments } from "@/lib/data/mock/paymentsStore";
import { readExpenses, writeExpenses } from "@/lib/data/mock/expensesStore";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { readChartOfAccounts } from "@/lib/data/mock/chartOfAccountsStore";
import { readJournalEntries, writeJournalEntries } from "@/lib/data/mock/journalEntriesStore";
import { readJournalLines, writeJournalLines } from "@/lib/data/mock/journalLinesStore";
import { readAccountingPeriods, writeAccountingPeriods } from "@/lib/data/mock/accountingPeriodsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
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
import {
  calculateNormalBalance,
  calculateRunningBalance,
  splitEndingBalance,
  validateTrialBalance,
  buildProfitAndLossSections,
  buildBalanceSheetSections,
  validateAccountingEquation,
} from "@/lib/data/finance/reportCalculations";
import { getFullName } from "@/lib/personName";

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

/** Shared Client/Event/Contract consistency check for createInvoice/createPayment/updateInvoice — extracted verbatim from the prior lib/data/index.ts implementation. */
function validateEventBelongsToClient(eventId: string, clientId: string): string | null {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return "Event not found.";
  if (event.client_id !== clientId) return "The selected event doesn't belong to this client.";
  return null;
}

function validateContractBelongsToClient(contractId: string, clientId: string): string | null {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) return "Contract not found.";
  if (contract.client_id !== clientId) return "The selected contract doesn't belong to this client.";
  return null;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

async function getInvoices(filters: InvoiceFilters = {}): Promise<Invoice[]> {
  await delay(200);
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
  const clientsById = new Map(readClients().map((client) => [client.id, client]));
  const eventsById = new Map(readEvents().map((event) => [event.id, event]));
  const contractsById = new Map(readContracts().map((contract) => [contract.id, contract]));

  return readInvoices().filter((invoice) => {
    if (!includeArchived && invoice.status === "archived") return false;
    if (status && status !== "all" && invoice.status !== status) return false;
    if (overdueOnly && invoice.status !== "overdue") return false;
    if (clientId && invoice.client_id !== clientId) return false;
    if (eventId && invoice.event_id !== eventId) return false;
    if (contractId && invoice.contract_id !== contractId) return false;
    if (issueDateFrom || issueDateTo) {
      if (!invoice.issue_date) return false;
      if (issueDateFrom && invoice.issue_date < issueDateFrom) return false;
      if (issueDateTo && invoice.issue_date > issueDateTo) return false;
    }
    if (dueDateFrom || dueDateTo) {
      if (!invoice.due_date) return false;
      if (dueDateFrom && invoice.due_date < dueDateFrom) return false;
      if (dueDateTo && invoice.due_date > dueDateTo) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(invoice.client_id);
      const clientName = client ? getFullName(client) : "";
      const event = invoice.event_id ? eventsById.get(invoice.event_id) : undefined;
      const contract = invoice.contract_id ? contractsById.get(invoice.contract_id) : undefined;
      const haystack = `${invoice.invoice_number} ${invoice.title} ${clientName} ${event?.title ?? ""} ${contract?.contract_number ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

async function getInvoiceById(id: string): Promise<Invoice> {
  await delay(150);
  const invoice = readInvoices().find((i) => i.id === id);
  if (!invoice) {
    throw new NotFoundError(`Invoice ${id} was not found`);
  }
  return invoice;
}

/** Workspace-scoped and collision-checked — extracted verbatim from the prior lib/data/index.ts implementation. */
function generateInvoiceNumber(workspaceId: string): string {
  const year = new Date().getUTCFullYear();
  const workspaceInvoices = readInvoices().filter((i) => i.workspace_id === workspaceId);
  const existingNumbers = new Set(workspaceInvoices.map((i) => i.invoice_number));

  let sequence = workspaceInvoices.length + 1;
  let candidate = `INV-${year}-${String(sequence).padStart(4, "0")}`;
  while (existingNumbers.has(candidate)) {
    sequence += 1;
    candidate = `INV-${year}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
}

function computeInvoiceTotal(subtotalMinor: number, taxMinor: number, discountMinor: number): number {
  return subtractMinor(addMinor(subtotalMinor, taxMinor), discountMinor);
}

async function createInvoice(input: InvoiceInput): Promise<DataResult<Invoice>> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const timestamp = nowIso();
  const total_minor = computeInvoiceTotal(parsed.data.subtotal_minor, parsed.data.tax_minor, parsed.data.discount_minor);
  const invoice: Invoice = {
    id: generateId("invoice"),
    workspace_id: client.workspace_id,
    invoice_number: generateInvoiceNumber(client.workspace_id),
    ...parsed.data,
    status: "draft",
    total_minor,
    paid_minor: 0,
    balance_minor: total_minor,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeInvoices([...readInvoices(), invoice]);
  recordTimelineActivity(invoice.workspace_id, "invoice", invoice.id, "invoice_created", `Invoice created: "${invoice.title}"`);

  return ok(invoice);
}

async function updateInvoice(id: string, input: InvoiceInput): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
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
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const total_minor = computeInvoiceTotal(parsed.data.subtotal_minor, parsed.data.tax_minor, parsed.data.discount_minor);
  const updated: Invoice = {
    ...existing,
    ...parsed.data,
    total_minor,
    balance_minor: calculateBalance(total_minor, existing.paid_minor),
    updated_at: nowIso(),
  };

  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_updated", `Invoice updated: "${updated.title}"`);

  return ok(updated);
}

/**
 * Finance F2.1B — posts Revenue recognition for a just-issued invoice:
 * Debit 1100 AR (total_minor) + 4900 Sales Discounts (discount_minor, if
 * any), Credit 4000 Service Revenue (subtotal_minor) + 2100 Sales Tax
 * Payable (tax_minor, if any). Mirrors post_invoice_revenue_recognition
 * exactly — same account numbers, same posting_key convention
 * (invoice_issued:<invoice_id>), same source_type ('invoice_issued',
 * already a reserved value in journal_entries_source_type_check since the
 * reverse_journal_entry migration).
 */
function postInvoiceRevenueRecognitionMock(invoice: Invoice): void {
  const arAccount = findAccountByNumber(invoice.workspace_id, 1100);
  const revenueAccount = findAccountByNumber(invoice.workspace_id, 4000);

  const lines: { account_id: string; debit_minor: number; credit_minor: number }[] = [
    { account_id: arAccount.id, debit_minor: invoice.total_minor, credit_minor: 0 },
  ];
  if (invoice.discount_minor > 0) {
    lines.push({ account_id: findAccountByNumber(invoice.workspace_id, 4900).id, debit_minor: invoice.discount_minor, credit_minor: 0 });
  }
  lines.push({ account_id: revenueAccount.id, debit_minor: 0, credit_minor: invoice.subtotal_minor });
  if (invoice.tax_minor > 0) {
    lines.push({ account_id: findAccountByNumber(invoice.workspace_id, 2100).id, debit_minor: 0, credit_minor: invoice.tax_minor });
  }

  insertMockJournalEntry({
    workspace_id: invoice.workspace_id,
    entry_date: invoice.issue_date ?? nowIso().slice(0, 10),
    source_type: "invoice_issued",
    source_id: invoice.id,
    posting_key: `invoice_issued:${invoice.id}`,
    memo: `Revenue recognized on invoice issuance: "${invoice.title}"`,
    posted_by: CURRENT_ACTOR,
    lines,
  });
}

/**
 * Finance F2.1B — mirrors post_invoice_voided_reversal exactly: a no-op if
 * the invoice was voided before ever being issued (no recognition entry
 * exists yet), otherwise swaps every original line's debit/credit into a
 * new entry (source_type 'invoice_voided', posting_key
 * invoice_voided:<invoice_id>) and marks the original reversed. The caller
 * (voidInvoice) already guarantees paid_minor === 0 before calling this.
 */
function reverseInvoiceRevenueRecognitionMock(invoice: Invoice): void {
  const original = readJournalEntries().find((e) => e.source_type === "invoice_issued" && e.source_id === invoice.id);
  if (!original) {
    return;
  }

  const originalLines = readJournalLines().filter((line) => line.journal_entry_id === original.id);
  const reversal = insertMockJournalEntry({
    workspace_id: original.workspace_id,
    entry_date: nowIso().slice(0, 10),
    source_type: "invoice_voided",
    source_id: invoice.id,
    posting_key: `invoice_voided:${invoice.id}`,
    memo: `Revenue recognition reversed: invoice voided ("${invoice.title}")`,
    posted_by: CURRENT_ACTOR,
    reverses_entry_id: original.id,
    lines: originalLines.map((line) => ({
      account_id: line.account_id,
      debit_minor: line.credit_minor,
      credit_minor: line.debit_minor,
      line_memo: line.line_memo,
    })),
  });

  writeJournalEntries(readJournalEntries().map((e) => (e.id === original.id ? { ...e, reversed_by_entry_id: reversal.id } : e)));
}

async function issueInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "issued")) {
    return fail(`Cannot issue an invoice that is already ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = {
    ...existing,
    status: "issued",
    issue_date: existing.issue_date ?? timestamp.slice(0, 10),
    updated_at: timestamp,
  };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  postInvoiceRevenueRecognitionMock(updated);
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_issued", `Invoice issued: "${existing.title}"`);

  return ok(updated);
}

async function sendInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "sent")) {
    return fail(`Cannot send an invoice that is ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}. Issue it first.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "sent", sent_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_sent", `Invoice sent: "${existing.title}"`);

  return ok(updated);
}

/** Idempotent: re-marking an already-viewed invoice keeps its original viewed_at, same precedent as markViewed (Contract). */
async function markInvoiceViewed(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status === "viewed") {
    return ok(existing);
  }
  if (!canTransitionInvoiceStatus(existing.status, "viewed")) {
    return fail(`Cannot mark ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} invoice as viewed.`);
  }

  const updated: Invoice = { ...existing, status: "viewed", viewed_at: nowIso(), updated_at: nowIso() };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_viewed", `Invoice viewed: "${existing.title}"`);

  return ok(updated);
}

async function markInvoiceOverdue(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.due_date === null) {
    return fail("This invoice has no due date to be overdue against.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "overdue")) {
    return fail(`Cannot mark ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()} invoice as overdue.`);
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "overdue", overdue_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_overdue", `Invoice overdue: "${existing.title}"`);

  return ok(updated);
}

async function voidInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (!canTransitionInvoiceStatus(existing.status, "voided")) {
    return fail(`Cannot void an invoice that is already ${INVOICE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }
  // Finance F2.1B — mirrors post_invoice_voided_reversal's P1119 guard:
  // void-after-partial-payment needs a proportional correction model this
  // clean-case migration does not implement (F2.1C).
  if (existing.paid_minor > 0) {
    return fail("Cannot void an invoice with payments applied. This requires a dedicated correction flow not yet available.");
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "voided", voided_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  reverseInvoiceRevenueRecognitionMock(updated);
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_voided", `Invoice voided: "${existing.title}"`);

  return ok(updated);
}

async function archiveInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status === "archived") {
    return fail("This invoice is already archived.");
  }

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_archived", "Invoice archived");

  return ok(updated);
}

/** Restoring returns the Invoice to "draft" — the same "reasonable resumption point" precedent as restoreContract. */
async function restoreInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }
  if (existing.status !== "archived") {
    return fail("This invoice is not archived.");
  }

  const updated: Invoice = { ...existing, status: "draft", archived_at: null, updated_at: nowIso() };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
  recordTimelineActivity(existing.workspace_id, "invoice", id, "invoice_restored", "Invoice restored");

  return ok(updated);
}

/** Fresh draft copy of an Invoice's content with a new id/invoice_number, resetting status/paid_minor/balance_minor and every lifecycle timestamp — mirrors duplicateContract. */
async function duplicateInvoice(id: string): Promise<DataResult<Invoice>> {
  const existing = readInvoices().find((i) => i.id === id);
  if (!existing) {
    return fail("Invoice not found.");
  }

  const timestamp = nowIso();
  const duplicate: Invoice = {
    ...existing,
    id: generateId("invoice"),
    invoice_number: generateInvoiceNumber(existing.workspace_id),
    status: "draft",
    issue_date: null,
    due_date: null,
    paid_minor: 0,
    balance_minor: existing.total_minor,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeInvoices([...readInvoices(), duplicate]);
  recordTimelineActivity(
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
 * Recomputes an Invoice's paid_minor/balance_minor/status from scratch by
 * summing every linked Payment that currently counts toward paid (net of
 * refunds) — extracted verbatim from the prior lib/data/index.ts internal
 * applyPaymentToInvoice. Never called by UI directly, only by
 * createPayment/markPaymentSucceeded/refundPayment below.
 */
function applyPaymentToInvoice(invoiceId: string): Invoice | null {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) return null;

  const linked = readPayments().filter((p) => p.invoice_id === invoiceId);
  const grossPaid = sumMinor(
    linked.filter((p) => PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status) && p.payment_type !== "refund").map((p) => p.amount_minor),
  );
  const refunded = sumMinor(
    linked.filter((p) => PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status) && p.payment_type === "refund").map((p) => p.amount_minor),
  );
  const paid_minor = Math.max(0, subtractMinor(grossPaid, refunded));
  const balance_minor = calculateBalance(invoice.total_minor, paid_minor);

  const PAYMENT_AWARE_STATUSES: InvoiceStatus[] = ["sent", "viewed", "partially_paid", "paid", "overdue"];
  let status = invoice.status;
  let paid_at = invoice.paid_at;
  if (PAYMENT_AWARE_STATUSES.includes(invoice.status)) {
    if (paid_minor > 0 && balance_minor === 0) {
      status = "paid";
      paid_at = paid_at ?? nowIso();
    } else if (paid_minor > 0) {
      status = "partially_paid";
    }
  }

  const updated: Invoice = { ...invoice, paid_minor, balance_minor, status, paid_at, updated_at: nowIso() };
  writeInvoices(readInvoices().map((i) => (i.id === invoiceId ? updated : i)));

  if (status !== invoice.status) {
    if (status === "paid") {
      recordTimelineActivity(updated.workspace_id, "invoice", invoiceId, "invoice_paid", `Invoice paid in full: "${updated.title}"`);
    } else if (status === "partially_paid") {
      recordTimelineActivity(
        updated.workspace_id,
        "invoice",
        invoiceId,
        "invoice_partially_paid",
        `Invoice partially paid: "${updated.title}"`,
      );
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

async function getPayments(filters: PaymentFilters = {}): Promise<Payment[]> {
  await delay(200);
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
  const clientsById = new Map(readClients().map((client) => [client.id, client]));
  const eventsById = new Map(readEvents().map((event) => [event.id, event]));

  return readPayments().filter((payment) => {
    if (status && status !== "all" && payment.status !== status) return false;
    if (paymentType && paymentType !== "all" && payment.payment_type !== paymentType) return false;
    if (paymentMethod && paymentMethod !== "all" && payment.payment_method !== paymentMethod) return false;
    if (refundsOnly && payment.payment_type !== "refund") return false;
    if (clientId && payment.client_id !== clientId) return false;
    if (eventId && payment.event_id !== eventId) return false;
    if (invoiceId && payment.invoice_id !== invoiceId) return false;
    if (contractId && payment.contract_id !== contractId) return false;
    if (dateFrom && payment.transaction_date < dateFrom) return false;
    if (dateTo && payment.transaction_date > dateTo) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(payment.client_id);
      const clientName = client ? getFullName(client) : "";
      const event = payment.event_id ? eventsById.get(payment.event_id) : undefined;
      const haystack = `${clientName} ${event?.title ?? ""} ${payment.reference ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

async function getPaymentById(id: string): Promise<Payment> {
  await delay(150);
  const payment = readPayments().find((p) => p.id === id);
  if (!payment) {
    throw new NotFoundError(`Payment ${id} was not found`);
  }
  return payment;
}

/** Methods with no real payment-provider integration are recorded as already succeeded — there is no provider round trip to await. */
const IMMEDIATELY_SUCCEEDED_METHODS = new Set(["cash", "check", "bank_transfer", "ach", "zelle", "venmo"]);

/**
 * Finance F1.7 — the single canonical path that creates a Payment AND
 * posts its (mock) ledger settlement, mirroring
 * supabaseRepository.ts's insertSettledPayment exactly so mock and
 * Supabase mode stay in parity. Shared by createPayment (only when its
 * own status computation already decided "succeeded") and
 * recordPaymentSettlement — the fix for the F1.6 finding that "Record
 * Payment" and "Record Settlement" silently diverged (one posted to the
 * ledger, one didn't, for what a user would reasonably consider the same
 * action).
 */
async function insertSettledPayment(client: Client, parsed: PaymentInput, invoice: Invoice | undefined): Promise<Payment> {
  const timestamp = nowIso();
  const payment: Payment = {
    id: generateId("payment"),
    workspace_id: client.workspace_id,
    ...parsed,
    status: "succeeded",
    received_at: timestamp,
    failed_at: null,
    refunded_at: null,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writePayments([...readPayments(), payment]);
  recordTimelineActivity(payment.workspace_id, "payment", payment.id, "payment_created", "Payment created: Succeeded");

  if (invoice) {
    applyPaymentToInvoice(invoice.id);
  }

  const creditAccount = findAccountByNumber(payment.workspace_id, invoice ? 1100 : 2200);
  const debitAccount = findAccountByNumber(payment.workspace_id, 1000);
  insertMockJournalEntry({
    workspace_id: payment.workspace_id,
    entry_date: payment.transaction_date,
    source_type: "payment_settlement",
    source_id: payment.id,
    posting_key: `payment_settlement:${payment.id}`,
    memo: `Payment settlement (${payment.payment_type}, ${payment.payment_method})`,
    posted_by: CURRENT_ACTOR,
    lines: [
      { account_id: debitAccount.id, debit_minor: payment.amount_minor, credit_minor: 0 },
      { account_id: creditAccount.id, debit_minor: 0, credit_minor: payment.amount_minor },
    ],
  });

  await getCoreAuditLogService().recordAuditEvent(payment.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "payment_settlement_recorded",
    ownerType: "payment",
    ownerId: payment.id,
    before: null,
    after: { amount_minor: payment.amount_minor, payment_method: payment.payment_method, invoice_id: payment.invoice_id },
  });

  return payment;
}

async function createPayment(input: PaymentInput): Promise<DataResult<Payment>> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }
  let invoice: Invoice | undefined;
  if (parsed.data.invoice_id !== null) {
    invoice = readInvoices().find((i) => i.id === parsed.data.invoice_id);
    if (!invoice) {
      return fail("Please select a valid invoice.", { invoice_id: "Invoice not found." });
    }
    if (invoice.client_id !== parsed.data.client_id || invoice.workspace_id !== client.workspace_id) {
      return fail("The selected invoice doesn't belong to this client.", {
        invoice_id: "Invoice belongs to a different client.",
      });
    }
  }

  const timestamp = nowIso();
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
  // Finance F1.7 — a Payment that starts "succeeded" goes through the same
  // canonical insert+ledger-post path recordPaymentSettlement uses, never
  // a plain insert — the fix for the F1.6 finding that "Record Payment"
  // silently never reached the (mock) ledger even when it recorded a
  // payment as already succeeded. See insertSettledPayment's own doc
  // comment and its Supabase-mode counterpart for the full reasoning.
  if (initialStatus === "succeeded") {
    const payment = await insertSettledPayment(client, parsed.data, invoice);
    return ok(payment);
  }

  const payment: Payment = {
    id: generateId("payment"),
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: initialStatus,
    received_at: null,
    failed_at: null,
    refunded_at: null,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writePayments([...readPayments(), payment]);
  recordTimelineActivity(
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
  const existing = readPayments().find((p) => p.id === id);
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
  if (parsed.data.event_id !== null) {
    const error = validateEventBelongsToClient(parsed.data.event_id, parsed.data.client_id);
    if (error) return fail(error, { event_id: error });
  }
  if (parsed.data.contract_id !== null) {
    const error = validateContractBelongsToClient(parsed.data.contract_id, parsed.data.client_id);
    if (error) return fail(error, { contract_id: error });
  }

  const updated: Payment = { ...existing, ...parsed.data, updated_at: nowIso() };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));

  if (updated.invoice_id && updated.status === "succeeded" && updated.amount_minor !== existing.amount_minor) {
    applyPaymentToInvoice(updated.invoice_id);
  }

  return ok(updated);
}

async function markPaymentProcessing(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "processing")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as processing.`);
  }

  const updated: Payment = { ...existing, status: "processing", updated_at: nowIso() };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_processing", "Payment processing");

  return ok(updated);
}

/**
 * Finance F1.8 — the atomic version. Mock mode has no real database
 * transaction, so atomicity is achieved by ORDERING: the settlement
 * posting is attempted FIRST, against the still-pending Payment, before
 * any store mutation happens. If posting throws (e.g. no accounting period
 * covers the transaction_date), this returns fail() immediately with the
 * store completely untouched — status stays pending, no Timeline entry, no
 * invoice recompute — closing the F1.7-disclosed gap where a posting
 * failure could leave a Payment persisted as "succeeded" with no
 * settlement entry. Only after posting succeeds do status/Timeline/invoice
 * mutate, mirroring the Supabase-mode RPC's transactional guarantee as
 * closely as an in-memory store can.
 */
async function markPaymentSucceeded(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "succeeded")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as succeeded.`);
  }
  // No overpayment: re-checked here (not just at createPayment) since a
  // pending/processing Payment can sit for a while — the Invoice's balance
  // may have shrunk by the time this one succeeds.
  if (existing.invoice_id && existing.payment_type !== "refund") {
    const linkedInvoice = readInvoices().find((i) => i.id === existing.invoice_id);
    if (linkedInvoice && existing.amount_minor > linkedInvoice.balance_minor) {
      return fail(
        `This payment (${existing.amount_minor} minor units) would exceed the invoice's remaining balance (${linkedInvoice.balance_minor} minor units).`,
      );
    }
  }

  try {
    const creditAccount = findAccountByNumber(existing.workspace_id, existing.invoice_id ? 1100 : 2200);
    const debitAccount = findAccountByNumber(existing.workspace_id, 1000);
    insertMockJournalEntry({
      workspace_id: existing.workspace_id,
      entry_date: existing.transaction_date,
      source_type: "payment_settlement",
      source_id: existing.id,
      posting_key: `payment_settlement:${existing.id}`,
      memo: `Payment settlement (${existing.payment_type}, ${existing.payment_method})`,
      posted_by: CURRENT_ACTOR,
      lines: [
        { account_id: debitAccount.id, debit_minor: existing.amount_minor, credit_minor: 0 },
        { account_id: creditAccount.id, debit_minor: 0, credit_minor: existing.amount_minor },
      ],
    });
  } catch (postingError) {
    return fail(postingError instanceof Error ? postingError.message : String(postingError));
  }

  const timestamp = nowIso();
  const updated: Payment = { ...existing, status: "succeeded", received_at: timestamp, updated_at: timestamp };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_succeeded", "Payment succeeded");

  if (updated.invoice_id) {
    applyPaymentToInvoice(updated.invoice_id);
  }

  return ok(updated);
}

async function markPaymentFailed(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "failed")) {
    return fail(`Cannot mark ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()} payment as failed.`);
  }

  const timestamp = nowIso();
  const updated: Payment = { ...existing, status: "failed", failed_at: timestamp, updated_at: timestamp };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_failed", "Payment failed");

  return ok(updated);
}

/**
 * Refunds are represented as a new Payment (payment_type: "refund") rather
 * than a second ledger. The refundable ceiling is the original Payment's
 * amount_minor minus every prior refund already issued against it, tracked
 * via `reference` (since Payment has no dedicated "refunds this payment"
 * column) — extracted verbatim from the prior lib/data/index.ts
 * implementation.
 */
function refundReferenceFor(originalPaymentId: string): string {
  return `refund_of:${originalPaymentId}`;
}

/**
 * Finance F1.8 — also posts a PARTIAL, proportional settlement reversal
 * (Dr [original credit account] / Cr [original Cash account], for this
 * refund's own amount_minor, never the original's full amount) so N
 * legitimate partial refunds against one original payment each produce
 * their own distinct posting. Never reuses reverseJournalEntry — that's a
 * whole-entry-only mechanism (at most one reversal per original entry),
 * wrong for partial/multiple refunds. Mirrors post_payment_refund_reversal
 * exactly: reads the original settlement's ACTUAL posted account_ids back
 * from the mock journal store rather than re-deriving routing from
 * invoice_id, and fails safely (never invents a reversal) if no
 * payment_settlement entry exists for the original payment — the correct
 * behavior for a payment that predates F1.7/F1.8 or was never settled.
 *
 * Atomic by ORDERING, same technique as markPaymentSucceeded: the refund's
 * id is pre-generated and the reversal is posted BEFORE any store mutation.
 * If posting throws, this returns fail() with the store completely
 * untouched — no refund row, no original-status change, no Timeline entry.
 *
 * Finance F2.1C-B: when the refunded payment is invoice-linked and that
 * invoice still has unreversed recognized Revenue, composes a proportional
 * Revenue correction into this SAME entry (Dr 4950 Refunds & Returns + Dr
 * 2100 Sales Tax Payable, if any + Cr 4900 Sales Discounts, if any + Cr
 * 1100 AR netting the settlement-reversal's own AR debit to zero) —
 * replacing F2.1B-REVIEW's P1120 blanket rejection with the real posting.
 *
 * Finance F2.1C-C-IDEMPOTENCY: `refundPaymentId` is now a REQUIRED,
 * caller-supplied request-level idempotency key, not an internally-
 * generated row id — mirrors record_purchase_receipt's established
 * p_receipt_event_id convention. A repeat call with the same key and the
 * same (originalPaymentId, amountMinor) payload is a REPLAY — returns the
 * existing refund Payment unchanged, without re-running the checks below
 * (which could spuriously fail against CURRENT state that moved on since
 * the original, already-successful call — e.g. `original.status` is
 * expected to have changed as a RESULT of that call). A payload mismatch
 * is a genuine conflict, never silently replayed.
 */
async function refundPayment(originalPaymentId: string, amountMinor: number, refundPaymentId: string): Promise<DataResult<Payment>> {
  const original = readPayments().find((p) => p.id === originalPaymentId);
  if (!original) {
    return fail("Payment not found.");
  }
  if (!refundPaymentId) {
    return fail("refundPaymentId is required and must be a stable identifier supplied by the caller (the same value on every retry of the same refund request).");
  }

  const refundReference = refundReferenceFor(originalPaymentId);
  const existingRefund = readPayments().find((p) => p.id === refundPaymentId);
  if (existingRefund) {
    if (existingRefund.reference !== refundReference || existingRefund.amount_minor !== amountMinor) {
      return fail("This idempotency key was already used for a different refund request.");
    }
    return ok(existingRefund);
  }

  if (!isPaymentRefundable(original.status)) {
    return fail(`Cannot refund a payment that is ${PAYMENT_STATUS_LABELS[original.status].toLowerCase()}.`);
  }
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return fail("Enter a refund amount greater than zero.");
  }

  const priorRefunds = sumMinor(
    readPayments()
      .filter((p) => p.reference === refundReferenceFor(originalPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  // Finance F2.1C-C: a Customer Deposit already applied to an invoice is no
  // longer available to refund — a deposit could otherwise be refunded AND
  // applied for more than it ever held. Always computed (not gated on
  // invoice_id === null) since an invoice-linked original payment can never
  // have a deposit_application_of:<id> row referencing it — this sum is
  // naturally zero for that case, so no branching is needed.
  const priorApplications = sumMinor(
    readPayments()
      .filter((p) => p.reference === depositApplicationReferenceFor(originalPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  const refundable = Math.max(0, subtractMinor(subtractMinor(original.amount_minor, priorRefunds), priorApplications));
  if (amountMinor > refundable) {
    return fail(`Cannot refund more than the refundable amount (${refundable} minor units remaining).`);
  }

  const timestamp = nowIso();
  const refundId = refundPaymentId;

  const settlementEntry = readJournalEntries().find(
    (e) => e.workspace_id === original.workspace_id && e.source_type === "payment_settlement" && e.source_id === original.id,
  );
  if (!settlementEntry) {
    return fail(
      "No settlement entry exists for the original payment — cannot reverse. It predates ledger posting or was never settled; resolve via reconciliation, not an invented reversal.",
    );
  }
  const settlementLines = readJournalLines().filter((l) => l.journal_entry_id === settlementEntry.id);
  const cashLine = settlementLines.find((l) => l.debit_minor > 0);
  const creditLine = settlementLines.find((l) => l.credit_minor > 0);
  if (!cashLine || !creditLine) {
    return fail("The original settlement entry is malformed — cannot determine accounts to reverse.");
  }

  const lines: { account_id: string; debit_minor: number; credit_minor: number }[] = [
    { account_id: creditLine.account_id, debit_minor: amountMinor, credit_minor: 0 },
    { account_id: cashLine.account_id, debit_minor: 0, credit_minor: amountMinor },
  ];

  // Finance F2.1C-B: compose the Revenue-side correction into this SAME
  // entry, exactly when the refunded payment is invoice-linked and that
  // invoice still has an unreversed Revenue-recognition entry — the same
  // condition F2.1B-REVIEW's now-retired P1120 guard used to reject on.
  // Mirrors post_payment_refund_reversal's SQL line-for-line.
  //
  // Finance F2.1C-B-REVIEW: the three portions are computed CUMULATIVELY
  // against every completed refund linked to this invoice (this one plus
  // every other, regardless of which original payment they refunded) and
  // taken as the difference from the previous cumulative state — NOT
  // rounded independently per refund. Independent per-refund rounding let
  // 3+ partial refunds summing to the full invoice amount drift net
  // Revenue/Sales Discounts by 1+ cents versus a single full refund, even
  // though each individual entry still balanced on its own. The
  // cumulative-then-diff technique telescopes to exactly zero drift once
  // the running total reaches the invoice total, however many refund
  // events occur or however unevenly they're split — verified by
  // simulation across 2-way, 3-way, 7-way, and adversarial 10-way-equal-
  // split refund sequences.
  // Finance F2.1C-D-B: computed BEFORE posting (pure, no store mutation) and
  // applied to the store only after posting succeeds, alongside the other
  // post-success writes below — never left partially applied.
  let invoiceCorrection: Invoice | null = null;

  if (original.invoice_id !== null) {
    const recognitionEntry = readJournalEntries().find(
      (e) => e.source_type === "invoice_issued" && e.source_id === original.invoice_id && e.reversed_by_entry_id === null,
    );
    if (recognitionEntry) {
      const invoice = readInvoices().find((i) => i.id === original.invoice_id);
      if (!invoice) {
        return fail("The invoice linked to this payment no longer exists — cannot compute a refund correction.");
      }

      // Finance F2.1C-D-B: the proportional formula's basis (original
      // subtotal/tax/discount/total) is read fresh from the ORIGINAL
      // invoice_issued journal entry's own posted lines — NEVER from
      // invoice.tax_minor/discount_minor/total_minor, which this same
      // function now updates as a side effect below (see that update for
      // why). Reading the mutable invoice fields as the formula's divisor
      // would corrupt every refund AFTER the first one — proven by
      // simulation: a 2-way partial refund sequence that does NOT fully
      // drain the invoice (e.g. 30000+20000 of a 103000 total) drifts net
      // Sales Discounts by 1 cent once the divisor shrinks between refund
      // events, reintroducing exactly the class of drift F2.1C-B-REVIEW's
      // cumulative-then-diff technique was built to eliminate.
      // journal_lines is append-only and immutable, making it the correct,
      // permanent basis — resolved by account NUMBER (1100 AR = original
      // total, 4000 Revenue = original subtotal, 2100 Tax = original tax,
      // 4900 Discount = original discount), not by re-reading the invoice.
      const recognitionLines = readJournalLines().filter((l) => l.journal_entry_id === recognitionEntry.id);
      const arAccountId = findAccountByNumber(invoice.workspace_id, 1100).id;
      const revenueAccountId = findAccountByNumber(invoice.workspace_id, 4000).id;
      const taxAccountId = findAccountByNumber(invoice.workspace_id, 2100).id;
      const discountAccountId = findAccountByNumber(invoice.workspace_id, 4900).id;
      const origTotal = sumMinor(recognitionLines.filter((l) => l.account_id === arAccountId).map((l) => l.debit_minor));
      const origSubtotal = sumMinor(recognitionLines.filter((l) => l.account_id === revenueAccountId).map((l) => l.credit_minor));
      const origTax = sumMinor(recognitionLines.filter((l) => l.account_id === taxAccountId).map((l) => l.credit_minor));
      const origDiscount = sumMinor(recognitionLines.filter((l) => l.account_id === discountAccountId).map((l) => l.debit_minor));
      void origSubtotal; // not needed for the proportional formula itself, only origTotal/origTax/origDiscount are — kept for clarity/traceability

      const priorRefundedTotal = sumMinor(
        readPayments()
          .filter(
            (p) => p.invoice_id === invoice.id && p.payment_type === "refund" && p.id !== refundId && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status),
          )
          .map((p) => p.amount_minor),
      );
      const cumulativeRefundedTotal = priorRefundedTotal + amountMinor;

      const taxCum = Math.round((cumulativeRefundedTotal * origTax) / origTotal);
      const discountCum = Math.round((cumulativeRefundedTotal * origDiscount) / origTotal);
      const revenueCum = cumulativeRefundedTotal + discountCum - taxCum;

      const taxPrior = Math.round((priorRefundedTotal * origTax) / origTotal);
      const discountPrior = Math.round((priorRefundedTotal * origDiscount) / origTotal);
      const revenuePrior = priorRefundedTotal + discountPrior - taxPrior;

      const taxPortion = taxCum - taxPrior;
      const discountPortion = discountCum - discountPrior;
      const revenuePortion = revenueCum - revenuePrior;

      if (revenuePortion < 0) {
        return fail("Unable to compute a balanced refund correction for this invoice.");
      }

      lines.push({ account_id: findAccountByNumber(invoice.workspace_id, 4950).id, debit_minor: revenuePortion, credit_minor: 0 });
      if (taxPortion > 0) {
        lines.push({ account_id: findAccountByNumber(invoice.workspace_id, 2100).id, debit_minor: taxPortion, credit_minor: 0 });
      }
      if (discountPortion > 0) {
        lines.push({ account_id: findAccountByNumber(invoice.workspace_id, 4900).id, debit_minor: 0, credit_minor: discountPortion });
      }
      lines.push({ account_id: creditLine.account_id, debit_minor: 0, credit_minor: amountMinor });

      // Finance F2.1C-D-B: synchronize the Invoice's CURRENT economic
      // fields with this refund's correction, so applyPaymentToInvoice
      // (called separately, below) produces a balance_minor that matches
      // the TRUE ledger AR position — fixing the mismatch F2.1C-D-A
      // discovered (balance_minor previously stayed at the stale original
      // total forever, regardless of how much Revenue correction had
      // already posted). Uses invoice's CURRENT (possibly
      // already-corrected-by-a-prior-refund) fields as the decrement base
      // — intentionally DIFFERENT from the proportional formula's basis
      // above, which must stay anchored to the ORIGINAL, immutable ledger
      // amounts; the two are deliberately decoupled.
      const newSubtotal = subtractMinor(invoice.subtotal_minor, revenuePortion);
      const newTax = subtractMinor(invoice.tax_minor, taxPortion);
      const newDiscount = subtractMinor(invoice.discount_minor, discountPortion);
      const newTotal = subtractMinor(addMinor(newSubtotal, newTax), newDiscount);

      if (newSubtotal < 0 || newTax < 0 || newDiscount < 0 || newTotal < 0) {
        return fail("Unable to compute a balanced refund correction for this invoice.");
      }

      invoiceCorrection = { ...invoice, subtotal_minor: newSubtotal, tax_minor: newTax, discount_minor: newDiscount, total_minor: newTotal, updated_at: timestamp };
    }
  }

  try {
    insertMockJournalEntry({
      workspace_id: original.workspace_id,
      entry_date: timestamp.slice(0, 10),
      source_type: "payment_refund",
      source_id: refundId,
      posting_key: `payment_refund:${refundId}`,
      memo: `Refund reversal of payment settlement ${settlementEntry.id} (${amountMinor} minor units)`,
      posted_by: CURRENT_ACTOR,
      lines,
    });
  } catch (postingError) {
    return fail(postingError instanceof Error ? postingError.message : String(postingError));
  }

  const refund: Payment = {
    id: refundId,
    workspace_id: original.workspace_id,
    invoice_id: original.invoice_id,
    client_id: original.client_id,
    event_id: original.event_id,
    contract_id: original.contract_id,
    payment_type: "refund",
    status: "succeeded",
    amount_minor: amountMinor,
    currency: original.currency,
    payment_method: original.payment_method,
    reference: refundReferenceFor(originalPaymentId),
    transaction_date: timestamp.slice(0, 10),
    received_at: timestamp,
    failed_at: null,
    refunded_at: timestamp,
    notes: `Refund of payment ${original.id}.`,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writePayments([...readPayments(), refund]);
  recordTimelineActivity(refund.workspace_id, "payment", refund.id, "payment_refunded", "Payment refunded");

  const remainingAfterThisRefund = refundable - amountMinor;
  const originalUpdated: Payment = {
    ...original,
    status: remainingAfterThisRefund === 0 ? "refunded" : "partially_refunded",
    refunded_at: timestamp,
    updated_at: timestamp,
  };
  writePayments(readPayments().map((p) => (p.id === originalPaymentId ? originalUpdated : p)));

  // Finance F2.1C-D-B: apply the invoice correction (computed above,
  // before posting) BEFORE recomputing the balance, so applyPaymentToInvoice
  // sees the corrected total_minor rather than the stale original.
  if (invoiceCorrection) {
    writeInvoices(readInvoices().map((i) => (i.id === invoiceCorrection!.id ? invoiceCorrection! : i)));
  }

  if (original.invoice_id) {
    applyPaymentToInvoice(original.invoice_id);
  }

  return ok(refund);
}

async function getPaymentRefundableAmount(paymentId: string): Promise<number> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment || !isPaymentRefundable(payment.status)) return 0;

  const priorRefunds = sumMinor(
    readPayments()
      .filter(
        (p) => p.reference === refundReferenceFor(paymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status),
      )
      .map((p) => p.amount_minor),
  );
  const priorApplications = sumMinor(
    readPayments()
      .filter((p) => p.reference === depositApplicationReferenceFor(paymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  return Math.max(0, subtractMinor(subtractMinor(payment.amount_minor, priorRefunds), priorApplications));
}

// ---------------------------------------------------------------------------
// Customer Deposit → Invoice application (Finance F2.1C-C)
// ---------------------------------------------------------------------------

function depositApplicationReferenceFor(depositPaymentId: string): string {
  return `deposit_application_of:${depositPaymentId}`;
}

const DEPOSIT_APPLICATION_ELIGIBLE_INVOICE_STATUSES = new Set(["issued", "sent", "viewed", "partially_paid", "overdue"]);

/**
 * Finance F2.1C-C — mirrors record_deposit_application's available-deposit
 * formula: the deposit's own amount_minor minus every prior completed
 * refund AND every prior completed application of it. Returns 0 for a
 * payment that either doesn't exist or isn't an unapplied Customer
 * Deposit in a consumable status, exactly like getPaymentRefundableAmount
 * does for a non-refundable payment.
 */
async function getDepositApplicableAmount(depositPaymentId: string): Promise<number> {
  const deposit = readPayments().find((p) => p.id === depositPaymentId);
  if (!deposit || deposit.invoice_id !== null || !isPaymentRefundable(deposit.status)) return 0;

  const priorRefunds = sumMinor(
    readPayments()
      .filter((p) => p.reference === refundReferenceFor(depositPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  const priorApplications = sumMinor(
    readPayments()
      .filter((p) => p.reference === depositApplicationReferenceFor(depositPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  return Math.max(0, subtractMinor(subtractMinor(deposit.amount_minor, priorRefunds), priorApplications));
}

/**
 * Finance F2.1C-C — mirrors record_deposit_application's SQL exactly:
 * validates the deposit is an unapplied Customer Deposit in a consumable
 * status, workspace/client/currency consistency, invoice application-
 * eligible status, and the available-deposit + invoice-balance ceilings;
 * inserts the application Payment row (payment_type='adjustment',
 * payment_method='other', status='succeeded', reference=
 * 'deposit_application_of:<deposit_id>'); posts Dr 2200 Customer Deposits
 * / Cr 1100 Accounts Receivable (no Cash line — Cash already moved when
 * the deposit was originally collected); recomputes the invoice balance.
 * Atomic by ORDERING, same technique as refundPayment: the application's
 * id is pre-generated and posting is attempted BEFORE any store mutation.
 */
/**
 * Finance F2.1C-C-IDEMPOTENCY: `applicationPaymentId` is a REQUIRED,
 * caller-supplied request-level idempotency key, not an internally-
 * generated row id — same contract as refundPayment's `refundPaymentId`
 * (see its doc comment). Checked immediately after locating the deposit
 * (before any other validation, which could spuriously fail against
 * CURRENT state on a replay) — a repeat with the same key and the same
 * (deposit, invoice, amount) payload returns the existing application
 * Payment unchanged; a payload mismatch is a genuine conflict.
 */
async function applyDepositToInvoice(depositPaymentId: string, invoiceId: string, amountMinor: number, applicationPaymentId: string): Promise<DataResult<Payment>> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return fail("Enter a deposit application amount greater than zero.");
  }
  if (!applicationPaymentId) {
    return fail("applicationPaymentId is required and must be a stable identifier supplied by the caller (the same value on every retry of the same deposit application request).");
  }

  const deposit = readPayments().find((p) => p.id === depositPaymentId);
  if (!deposit) {
    return fail("Deposit payment not found.");
  }

  const applicationReference = depositApplicationReferenceFor(depositPaymentId);
  const existingApplication = readPayments().find((p) => p.id === applicationPaymentId);
  if (existingApplication) {
    if (existingApplication.reference !== applicationReference || existingApplication.invoice_id !== invoiceId || existingApplication.amount_minor !== amountMinor) {
      return fail("This idempotency key was already used for a different deposit application request.");
    }
    return ok(existingApplication);
  }

  if (deposit.invoice_id !== null) {
    return fail("This payment is already linked to an invoice and is not an unapplied Customer Deposit.");
  }
  if (!isPaymentRefundable(deposit.status)) {
    return fail(`Cannot apply a deposit payment that is ${PAYMENT_STATUS_LABELS[deposit.status].toLowerCase()}.`);
  }
  // Finance F2.1C-C-REVIEW: mirrors refundPayment's P1118-equivalent guard
  // exactly — status alone doesn't PROVE Cash actually moved into Customer
  // Deposits for this payment. Fails safely (never invents an application
  // against a deposit that predates ledger posting or was never settled)
  // rather than trusting invoice_id-is-null + status-is-consumable alone.
  const depositSettlementEntry = readJournalEntries().find(
    (e) => e.workspace_id === deposit.workspace_id && e.source_type === "payment_settlement" && e.source_id === deposit.id,
  );
  if (!depositSettlementEntry) {
    return fail(
      "No settlement entry exists for the deposit payment — cannot apply. It predates ledger posting or was never settled; resolve via reconciliation, not an invented application.",
    );
  }

  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) {
    return fail("Invoice not found.");
  }
  if (deposit.workspace_id !== invoice.workspace_id || deposit.client_id !== invoice.client_id) {
    return fail("The deposit and the target invoice must belong to the same workspace and client.");
  }
  if (deposit.currency !== invoice.currency) {
    return fail("The deposit currency does not match the invoice currency.");
  }
  if (!DEPOSIT_APPLICATION_ELIGIBLE_INVOICE_STATUSES.has(invoice.status)) {
    return fail(`Cannot apply a deposit to an invoice that is ${INVOICE_STATUS_LABELS[invoice.status].toLowerCase()}.`);
  }

  const priorRefunds = sumMinor(
    readPayments()
      .filter((p) => p.reference === refundReferenceFor(depositPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  const priorApplications = sumMinor(
    readPayments()
      .filter((p) => p.reference === depositApplicationReferenceFor(depositPaymentId) && PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(p.status))
      .map((p) => p.amount_minor),
  );
  const available = Math.max(0, subtractMinor(subtractMinor(deposit.amount_minor, priorRefunds), priorApplications));
  if (amountMinor > available) {
    return fail(`Cannot apply more than the available deposit balance (${available} minor units remaining).`);
  }
  if (amountMinor > invoice.balance_minor) {
    return fail(`Cannot apply more than the invoice's outstanding balance (${invoice.balance_minor} minor units remaining).`);
  }

  const timestamp = nowIso();
  const applicationId = applicationPaymentId;

  try {
    insertMockJournalEntry({
      workspace_id: deposit.workspace_id,
      entry_date: timestamp.slice(0, 10),
      source_type: "deposit_application",
      source_id: applicationId,
      posting_key: `deposit_application:${applicationId}`,
      memo: `Customer Deposit applied to invoice (deposit ${deposit.id})`,
      posted_by: CURRENT_ACTOR,
      lines: [
        { account_id: findAccountByNumber(deposit.workspace_id, 2200).id, debit_minor: amountMinor, credit_minor: 0 },
        { account_id: findAccountByNumber(deposit.workspace_id, 1100).id, debit_minor: 0, credit_minor: amountMinor },
      ],
    });
  } catch (postingError) {
    return fail(postingError instanceof Error ? postingError.message : String(postingError));
  }

  const application: Payment = {
    id: applicationId,
    workspace_id: deposit.workspace_id,
    invoice_id: invoiceId,
    client_id: deposit.client_id,
    event_id: deposit.event_id,
    contract_id: deposit.contract_id,
    payment_type: "adjustment",
    status: "succeeded",
    amount_minor: amountMinor,
    currency: deposit.currency,
    payment_method: "other",
    reference: depositApplicationReferenceFor(depositPaymentId),
    transaction_date: timestamp.slice(0, 10),
    received_at: timestamp,
    failed_at: null,
    refunded_at: null,
    notes: `Customer Deposit ${deposit.id} applied to invoice.`,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writePayments([...readPayments(), application]);
  recordTimelineActivity(application.workspace_id, "payment", application.id, "deposit_applied", "Customer Deposit applied to invoice");

  applyPaymentToInvoice(invoiceId);

  return ok(application);
}

async function cancelPayment(id: string): Promise<DataResult<Payment>> {
  const existing = readPayments().find((p) => p.id === id);
  if (!existing) {
    return fail("Payment not found.");
  }
  if (!canTransitionPaymentStatus(existing.status, "cancelled")) {
    return fail(`Cannot cancel a payment that is ${PAYMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Payment = { ...existing, status: "cancelled", updated_at: nowIso() };
  writePayments(readPayments().map((p) => (p.id === id ? updated : p)));
  recordTimelineActivity(existing.workspace_id, "payment", id, "payment_cancelled", "Payment cancelled");

  return ok(updated);
}

async function getPaymentNextAction(paymentId: string): Promise<string | null> {
  const payment = await getPaymentById(paymentId);
  return getPaymentNextRecommendedAction(payment);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

const UNPAID_EXPENSE_STATUSES = ["planned", "approved", "due"] as const;

async function getExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  await delay(200);
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
  return readExpenses().filter((expense) => {
    if (!includeArchived && expense.status === "archived") return false;
    if (status && status !== "all" && expense.status !== status) return false;
    if (category && category !== "all" && expense.category !== category) return false;
    if (eventId && expense.event_id !== eventId) return false;
    if (clientId && expense.client_id !== clientId) return false;
    if (unpaidOnly && !UNPAID_EXPENSE_STATUSES.includes(expense.status as (typeof UNPAID_EXPENSE_STATUSES)[number])) return false;
    if (dueOnly && expense.status !== "due") return false;
    if (reimbursableOnly && !expense.reimbursable) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      if (!expense.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

async function getExpenseById(id: string): Promise<Expense> {
  await delay(150);
  const expense = readExpenses().find((e) => e.id === id);
  if (!expense) {
    throw new NotFoundError(`Expense ${id} was not found`);
  }
  return expense;
}

/** Expense's client_id is legitimately optional, unlike every other entity whose workspace_id is derived from a required Client — so workspace_id is assigned directly from CURRENT_WORKSPACE_ID here. */
async function createExpense(input: ExpenseInput): Promise<DataResult<Expense>> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (parsed.data.client_id !== null && event.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.contract_id !== null) {
    const contract = readContracts().find((c) => c.id === parsed.data.contract_id);
    if (!contract) {
      return fail("Please select a valid contract.", { contract_id: "Contract not found." });
    }
    if (parsed.data.client_id !== null && contract.client_id !== parsed.data.client_id) {
      return fail("The selected contract doesn't belong to this client.", {
        contract_id: "Contract belongs to a different client.",
      });
    }
  }

  const timestamp = nowIso();
  const expense: Expense = {
    id: generateId("expense"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...parsed.data,
    status: "planned",
    paid_at: null,
    reimbursed_at: null,
    document_id: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeExpenses([...readExpenses(), expense]);
  recordTimelineActivity(expense.workspace_id, "expense", expense.id, "expense_created", `Expense created: "${expense.description}"`);

  return ok(expense);
}

async function updateExpense(id: string, input: ExpenseInput): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
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
  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (parsed.data.client_id !== null && event.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.contract_id !== null) {
    const contract = readContracts().find((c) => c.id === parsed.data.contract_id);
    if (!contract) {
      return fail("Please select a valid contract.", { contract_id: "Contract not found." });
    }
    if (parsed.data.client_id !== null && contract.client_id !== parsed.data.client_id) {
      return fail("The selected contract doesn't belong to this client.", {
        contract_id: "Contract belongs to a different client.",
      });
    }
  }

  const updated: Expense = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_updated", `Expense updated: "${updated.description}"`);

  return ok(updated);
}

async function approveExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "approved")) {
    return fail(`Cannot approve an expense that is already ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Expense = { ...existing, status: "approved", updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_approved", "Expense approved");

  return ok(updated);
}

async function markExpenseDue(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "due")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as due.`);
  }

  const updated: Expense = { ...existing, status: "due", updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_marked_due", "Expense marked due");

  return ok(updated);
}

async function markExpensePaid(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "paid")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as paid.`);
  }

  const timestamp = nowIso();
  const updated: Expense = { ...existing, status: "paid", paid_at: timestamp, updated_at: timestamp };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_paid", "Expense paid");

  return ok(updated);
}

async function markExpenseReimbursed(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!existing.reimbursable) {
    return fail("This expense isn't marked reimbursable.");
  }
  if (!canTransitionExpenseStatus(existing.status, "reimbursed")) {
    return fail(`Cannot mark ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()} expense as reimbursed.`);
  }

  const timestamp = nowIso();
  const updated: Expense = { ...existing, status: "reimbursed", reimbursed_at: timestamp, updated_at: timestamp };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_reimbursed", "Expense reimbursed");

  return ok(updated);
}

async function cancelExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (!canTransitionExpenseStatus(existing.status, "cancelled")) {
    return fail(`Cannot cancel an expense that is already ${EXPENSE_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Expense = { ...existing, status: "cancelled", updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_cancelled", "Expense cancelled");

  return ok(updated);
}

async function archiveExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (existing.status === "archived") {
    return fail("This expense is already archived.");
  }

  const timestamp = nowIso();
  const updated: Expense = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_archived", "Expense archived");

  return ok(updated);
}

/** Restoring returns the Expense to "planned" — same "reasonable resumption point" precedent as restoreContract/restoreInvoice. */
async function restoreExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }
  if (existing.status !== "archived") {
    return fail("This expense is not archived.");
  }

  const updated: Expense = { ...existing, status: "planned", archived_at: null, updated_at: nowIso() };
  writeExpenses(readExpenses().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "expense", id, "expense_restored", "Expense restored");

  return ok(updated);
}

/** Fresh "planned" copy of an Expense's content with a new id, resetting status/paid_at/reimbursed_at/archived_at — mirrors duplicateContract/duplicateInvoice. */
async function duplicateExpense(id: string): Promise<DataResult<Expense>> {
  const existing = readExpenses().find((e) => e.id === id);
  if (!existing) {
    return fail("Expense not found.");
  }

  const timestamp = nowIso();
  const duplicate: Expense = {
    ...existing,
    id: generateId("expense"),
    status: "planned",
    paid_at: null,
    reimbursed_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeExpenses([...readExpenses(), duplicate]);
  recordTimelineActivity(duplicate.workspace_id, "expense", duplicate.id, "expense_created", `Expense created (duplicated from ${existing.id})`);

  return ok(duplicate);
}

async function getExpenseNextAction(expenseId: string): Promise<string | null> {
  const expense = await getExpenseById(expenseId);
  return getExpenseNextRecommendedAction(expense);
}

// ---------------------------------------------------------------------------
// Invoice/Payment/Expense Notes and Timeline — reuse the shared
// owner_type/owner_id Notes and Timeline architecture, same precedent as
// Contract Notes/Timeline.
// ---------------------------------------------------------------------------

async function getNotesByInvoiceId(invoiceId: string): Promise<Note[]> {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) return [];
  return getNotesByOwner(invoice.workspace_id, "invoice", invoiceId);
}

async function createInvoiceNote(invoiceId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) {
    return fail("Invoice not found.");
  }
  return createNoteForOwner(invoice.workspace_id, "invoice", invoiceId, input);
}

async function togglePinInvoiceNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "invoice");
  if (!existing) return null;

  const updated: Note = { ...existing, is_pinned: !existing.is_pinned, updated_at: nowIso() };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "invoice",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByInvoiceId(invoiceId: string): Promise<TimelineActivity[]> {
  const invoice = readInvoices().find((i) => i.id === invoiceId);
  if (!invoice) return [];
  return getTimelineByOwner(invoice.workspace_id, "invoice", invoiceId);
}

async function getNotesByPaymentId(paymentId: string): Promise<Note[]> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment) return [];
  return getNotesByOwner(payment.workspace_id, "payment", paymentId);
}

async function createPaymentNote(paymentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment) {
    return fail("Payment not found.");
  }
  return createNoteForOwner(payment.workspace_id, "payment", paymentId, input);
}

async function togglePinPaymentNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "payment");
  if (!existing) return null;

  const updated: Note = { ...existing, is_pinned: !existing.is_pinned, updated_at: nowIso() };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "payment",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByPaymentId(paymentId: string): Promise<TimelineActivity[]> {
  const payment = readPayments().find((p) => p.id === paymentId);
  if (!payment) return [];
  return getTimelineByOwner(payment.workspace_id, "payment", paymentId);
}

async function getNotesByExpenseId(expenseId: string): Promise<Note[]> {
  const expense = readExpenses().find((e) => e.id === expenseId);
  if (!expense) return [];
  return getNotesByOwner(expense.workspace_id, "expense", expenseId);
}

async function createExpenseNote(expenseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const expense = readExpenses().find((e) => e.id === expenseId);
  if (!expense) {
    return fail("Expense not found.");
  }
  return createNoteForOwner(expense.workspace_id, "expense", expenseId, input);
}

async function togglePinExpenseNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "expense");
  if (!existing) return null;

  const updated: Note = { ...existing, is_pinned: !existing.is_pinned, updated_at: nowIso() };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "expense",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByExpenseId(expenseId: string): Promise<TimelineActivity[]> {
  const expense = readExpenses().find((e) => e.id === expenseId);
  if (!expense) return [];
  return getTimelineByOwner(expense.workspace_id, "expense", expenseId);
}

// ---------------------------------------------------------------------------
// Finance Ledger (Repository Layer phase). Mirrors the same account-number
// mapping and posting_key vocabulary the real Posting Engine RPCs use (see
// supabase/migrations/20260804*.sql), simplified — this is interface
// parity for UI development and unit tests, not a second independent
// accounting engine. It does not re-derive account resolution failures,
// period-closed rejection, or duplicate-posting detection the way Postgres
// does; it only needs to behave plausibly for a mock session.
// ---------------------------------------------------------------------------

/** Mirrors finance_resolve_expense_category_account's mapping exactly (see supabase/migrations/20260804100300_finance_post_expense_transition.sql). */
const EXPENSE_CATEGORY_ACCOUNT_NUMBERS: Record<ExpenseCategory, number> = {
  decor: 6100,
  flowers: 6110,
  rentals: 6120,
  venue: 6130,
  photography: 6140,
  video: 6150,
  food_beverage: 6160,
  transportation: 6170,
  printing: 6180,
  supplies: 6190,
  inventory: 1200,
  team_payroll: 6200,
  supplier_payment: 6210,
  marketing: 6220,
  software: 6230,
  insurance: 6240,
  taxes: 6250,
  fees: 6260,
  travel: 6270,
  refund: 4950,
  reimbursement: 6280,
  miscellaneous: 6900,
};

function findAccountByNumber(workspaceId: string, accountNumber: number): ChartOfAccount {
  const account = readChartOfAccounts().find((a) => a.workspace_id === workspaceId && a.account_number === accountNumber);
  if (!account) {
    throw new Error(`Mock Chart of Accounts is missing seeded account ${accountNumber} for workspace ${workspaceId}`);
  }
  return account;
}

/**
 * Appends one Journal Entry + its lines — mirrors finance_insert_journal_entry's shape (posting_key/source_type/source_id all distinct fields, never conflated). Throws if no seeded period covers entry_date, matching finance_resolve_period's own "never auto-create" rule.
 *
 * Finance F1.8: also throws on a duplicate (workspace_id, posting_key) —
 * mirroring the Supabase-mode journal_entries_workspace_posting_key_unique
 * index (Posting Engine migration, 20260804095000). This is the "minimal
 * mock idempotency guard" the F1.8 payment-atomicity and refund-reversal
 * work depends on to faithfully match the Supabase invariant; it was a
 * known, disclosed pre-F1.8 gap (F1.7's own report noted mock mode had no
 * duplicate-posting_key enforcement at all).
 */
function insertMockJournalEntry(params: {
  workspace_id: string;
  entry_date: string;
  source_type: string;
  source_id: string | null;
  posting_key: string | null;
  memo: string | null;
  posted_by: string;
  reverses_entry_id?: string | null;
  lines: { account_id: string; debit_minor: number; credit_minor: number; line_memo?: string | null }[];
}): JournalEntry {
  if (params.posting_key !== null) {
    const duplicate = readJournalEntries().find(
      (e) => e.workspace_id === params.workspace_id && e.posting_key === params.posting_key,
    );
    if (duplicate) {
      throw new Error(`A journal entry with posting_key "${params.posting_key}" already exists for this workspace.`);
    }
  }

  const period = readAccountingPeriods().find(
    (p) => p.workspace_id === params.workspace_id && p.period_start <= params.entry_date && p.period_end >= params.entry_date,
  );
  if (!period) {
    throw new Error(`No accounting period covers ${params.entry_date} for workspace ${params.workspace_id}`);
  }

  const timestamp = nowIso();
  const entry: JournalEntry = {
    id: generateId("journal_entry"),
    workspace_id: params.workspace_id,
    entry_date: params.entry_date,
    accounting_period_id: period.id,
    source_type: params.source_type,
    source_id: params.source_id,
    posting_key: params.posting_key,
    memo: params.memo,
    currency: "USD",
    reversed_by_entry_id: null,
    reverses_entry_id: params.reverses_entry_id ?? null,
    posting_status: "posted",
    failure_reason: null,
    posted_by: params.posted_by,
    created_at: timestamp,
  };
  writeJournalEntries([...readJournalEntries(), entry]);

  const lines: JournalLine[] = params.lines.map((line, index) => ({
    id: generateId("journal_line"),
    journal_entry_id: entry.id,
    workspace_id: params.workspace_id,
    account_id: line.account_id,
    debit_minor: line.debit_minor,
    credit_minor: line.credit_minor,
    currency: "USD",
    amount_in_base_currency_minor: Math.max(line.debit_minor, line.credit_minor),
    line_memo: line.line_memo ?? null,
    line_order: index,
    created_at: timestamp,
  }));
  writeJournalLines([...readJournalLines(), ...lines]);

  return entry;
}

async function listChartOfAccounts(filters: ChartOfAccountFilters = {}): Promise<ChartOfAccount[]> {
  const { includeArchived = false, accountType } = filters;
  return readChartOfAccounts()
    .filter((a) => a.workspace_id === CURRENT_WORKSPACE_ID)
    .filter((a) => includeArchived || a.archived_at === null)
    .filter((a) => !accountType || accountType === "all" || a.account_type === accountType)
    .sort((a, b) => a.account_number - b.account_number);
}

async function getChartOfAccount(id: string): Promise<ChartOfAccount> {
  const account = readChartOfAccounts().find((a) => a.id === id);
  if (!account) {
    throw new NotFoundError(`Chart of Accounts entry ${id} was not found`);
  }
  return account;
}

/** accountId/pagination are applied the same way the Supabase repository applies them — a real filter/slice, not a different, looser mock-only semantic — so interface parity holds for both data modes. */
async function listJournalEntries(filters: JournalEntryFilters = {}): Promise<JournalEntry[]> {
  const { dateFrom, dateTo, sourceType, postingStatus, accountId, limit = 50, offset = 0 } = filters;

  let entryIdsForAccount: Set<string> | null = null;
  if (accountId) {
    entryIdsForAccount = new Set(
      readJournalLines()
        .filter((line) => line.workspace_id === CURRENT_WORKSPACE_ID && line.account_id === accountId)
        .map((line) => line.journal_entry_id),
    );
  }

  const filtered = readJournalEntries()
    .filter((entry) => entry.workspace_id === CURRENT_WORKSPACE_ID)
    .filter((entry) => !dateFrom || entry.entry_date >= dateFrom)
    .filter((entry) => !dateTo || entry.entry_date <= dateTo)
    .filter((entry) => !sourceType || sourceType === "all" || entry.source_type === sourceType)
    .filter((entry) => !postingStatus || postingStatus === "all" || entry.posting_status === postingStatus)
    .filter((entry) => !entryIdsForAccount || entryIdsForAccount.has(entry.id))
    .sort((a, b) => (a.entry_date === b.entry_date ? b.id.localeCompare(a.id) : b.entry_date.localeCompare(a.entry_date)));

  return filtered.slice(offset, offset + limit);
}

async function getJournalEntry(id: string): Promise<JournalEntry> {
  const entry = readJournalEntries().find((e) => e.id === id);
  if (!entry) {
    throw new NotFoundError(`Journal entry ${id} was not found`);
  }

  const lines = readJournalLines()
    .filter((line) => line.journal_entry_id === id)
    .sort((a, b) => a.line_order - b.line_order)
    .map((line) => {
      const account = readChartOfAccounts().find((a) => a.id === line.account_id);
      return account
        ? { ...line, account: { account_number: account.account_number, name: account.name, account_type: account.account_type } }
        : { ...line };
    });

  return { ...entry, lines };
}

async function listAccountingPeriods(filters: AccountingPeriodFilters = {}): Promise<AccountingPeriod[]> {
  const { status } = filters;
  return readAccountingPeriods()
    .filter((p) => p.workspace_id === CURRENT_WORKSPACE_ID)
    .filter((p) => !status || status === "all" || p.status === status)
    .sort((a, b) => a.period_start.localeCompare(b.period_start));
}

async function getAccountingPeriod(id: string): Promise<AccountingPeriod> {
  const period = readAccountingPeriods().find((p) => p.id === id);
  if (!period) {
    throw new NotFoundError(`Accounting period ${id} was not found`);
  }
  return period;
}

/**
 * Finance F1.7 — delegates to the same canonical `insertSettledPayment`
 * helper `createPayment` now uses for its own "succeeded" branch (see that
 * helper's doc comment, and its Supabase-mode counterpart). This
 * function's only remaining distinct behavior is rejecting
 * `payment_method === "stripe"` before validation even runs, and requiring
 * only client/invoice existence (not the full event/contract-ownership
 * and overpayment checks `createPayment` runs) — mirroring the real RPC's
 * own narrower validation exactly, not a mock-only shortcut.
 */
async function recordPaymentSettlement(input: PaymentSettlementInput): Promise<DataResult<Payment>> {
  if (input.payment_method === "stripe") {
    return fail("Stripe payments are not supported in this phase — record only manual/internal payment methods.");
  }

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }

  let invoice: Invoice | undefined;
  if (parsed.data.invoice_id !== null) {
    invoice = readInvoices().find((i) => i.id === parsed.data.invoice_id);
    if (!invoice) {
      return fail("Please select a valid invoice.", { invoice_id: "Invoice not found." });
    }
  }

  const payment = await insertSettledPayment(client, parsed.data, invoice);
  return ok(payment);
}

/**
 * Delegates the status transition itself to the existing markExpenseDue/
 * markExpensePaid/markExpenseReimbursed — no second copy of that
 * validation. Known, disclosed deviation from the Supabase/RPC path:
 * markExpenseReimbursed also requires `reimbursable=true` (pre-existing
 * mock behavior, not introduced by this phase), while record_expense_
 * transition's own SQL does not check that flag — see the pre-commit
 * report for this phase.
 */
async function recordExpenseTransition(expenseId: string, input: ExpenseTransitionInput): Promise<DataResult<Expense>> {
  const parsed = expenseTransitionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const existing = readExpenses().find((e) => e.id === expenseId);
  if (!existing) {
    return fail("Expense not found.");
  }

  const transitionResult =
    parsed.data.transition === "due"
      ? await markExpenseDue(expenseId)
      : parsed.data.transition === "paid"
        ? await markExpensePaid(expenseId)
        : await markExpenseReimbursed(expenseId);
  if (!transitionResult.success) {
    return transitionResult;
  }

  const expense = transitionResult.data;
  const postingKeyLabel = parsed.data.transition === "reimbursed" ? "expense_reimbursement" : `expense_${parsed.data.transition}`;
  const debitAccount =
    parsed.data.transition === "reimbursed"
      ? findAccountByNumber(expense.workspace_id, 6280)
      : findAccountByNumber(expense.workspace_id, EXPENSE_CATEGORY_ACCOUNT_NUMBERS[expense.category]);
  const creditAccount = findAccountByNumber(expense.workspace_id, parsed.data.transition === "due" ? 2000 : 1000);

  insertMockJournalEntry({
    workspace_id: expense.workspace_id,
    entry_date: expense.due_date ?? expense.transaction_date,
    source_type: `expense_${parsed.data.transition}`,
    source_id: expenseId,
    posting_key: `${postingKeyLabel}:${expenseId}`,
    memo: `Expense ${parsed.data.transition}: "${expense.description}"`,
    posted_by: CURRENT_ACTOR,
    lines: [
      { account_id: debitAccount.id, debit_minor: expense.amount_minor, credit_minor: 0 },
      { account_id: creditAccount.id, debit_minor: 0, credit_minor: expense.amount_minor },
    ],
  });

  await getCoreAuditLogService().recordAuditEvent(expense.workspace_id, {
    actor: CURRENT_ACTOR,
    action: `expense_${parsed.data.transition}`,
    ownerType: "expense",
    ownerId: expense.id,
    before: { status: existing.status },
    after: { status: expense.status },
  });

  return ok(expense);
}

/** Balance equality is validated here (unlike the Supabase repository, which defers entirely to record_manual_adjustment's own P1106 check) since the mock has no Postgres backstop of its own — this is the one place this phase's "no automatic balancing" rule is enforced client-side, not a duplicated accounting RULE (which side is debited/credited), just the arithmetic invariant a Journal Entry can never skip. */
async function recordManualAdjustment(input: ManualAdjustmentInput): Promise<DataResult<JournalEntry>> {
  const parsed = manualAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  for (const line of parsed.data.lines) {
    const account = readChartOfAccounts().find((a) => a.id === line.account_id);
    if (!account) {
      return fail("One or more lines reference an account that does not exist.");
    }
    if (account.workspace_id !== CURRENT_WORKSPACE_ID) {
      return fail("One or more lines reference an account from a different workspace.");
    }
    if (account.archived_at) {
      return fail(`Line references archived account "${account.name}".`);
    }
  }

  const totalDebit = sumMinor(parsed.data.lines.map((line) => line.debit_minor));
  const totalCredit = sumMinor(parsed.data.lines.map((line) => line.credit_minor));
  if (totalDebit !== totalCredit) {
    return fail(`Manual adjustment is not balanced: total debits ${totalDebit} do not equal total credits ${totalCredit}.`);
  }

  const entry = insertMockJournalEntry({
    workspace_id: CURRENT_WORKSPACE_ID,
    entry_date: parsed.data.entry_date,
    source_type: "manual_adjustment",
    source_id: null,
    posting_key: null,
    memo: parsed.data.memo,
    posted_by: CURRENT_ACTOR,
    lines: parsed.data.lines.map((line) => ({
      account_id: line.account_id,
      debit_minor: line.debit_minor,
      credit_minor: line.credit_minor,
      line_memo: line.line_memo ?? null,
    })),
  });

  await getCoreAuditLogService().recordAuditEvent(entry.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "manual_adjustment_recorded",
    ownerType: "journal_entry",
    ownerId: entry.id,
    before: null,
    after: { memo: entry.memo, line_count: parsed.data.lines.length },
  });

  return ok(entry);
}

/** Creates a new entry with every line's debit/credit swapped; the original is never mutated except for reversed_by_entry_id, matching reverse_journal_entry's own guarantee. Append-only: no journal_lines row is ever edited or removed. */
async function reverseJournalEntry(journalEntryId: string, input: JournalEntryReversalInput): Promise<DataResult<JournalEntry>> {
  const parsed = journalEntryReversalInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const original = readJournalEntries().find((e) => e.id === journalEntryId);
  if (!original) {
    return fail("Journal entry not found.");
  }
  if (original.reversed_by_entry_id) {
    return fail("This journal entry has already been reversed.");
  }

  const originalLines = readJournalLines().filter((line) => line.journal_entry_id === journalEntryId);

  const reversal = insertMockJournalEntry({
    workspace_id: original.workspace_id,
    entry_date: original.entry_date,
    source_type: "reversal",
    source_id: journalEntryId,
    posting_key: `reversal:${journalEntryId}`,
    memo: parsed.data.reason,
    posted_by: CURRENT_ACTOR,
    reverses_entry_id: journalEntryId,
    lines: originalLines.map((line) => ({
      account_id: line.account_id,
      debit_minor: line.credit_minor,
      credit_minor: line.debit_minor,
      line_memo: line.line_memo,
    })),
  });

  writeJournalEntries(readJournalEntries().map((e) => (e.id === journalEntryId ? { ...e, reversed_by_entry_id: reversal.id } : e)));

  await getCoreAuditLogService().recordAuditEvent(reversal.workspace_id, {
    actor: CURRENT_ACTOR,
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

  const overlaps = readAccountingPeriods().some(
    (p) =>
      p.workspace_id === CURRENT_WORKSPACE_ID &&
      p.period_start <= parsed.data.period_end &&
      p.period_end >= parsed.data.period_start,
  );
  if (overlaps) {
    return fail("This date range overlaps an existing accounting period for this workspace.");
  }

  const timestamp = nowIso();
  const period: AccountingPeriod = {
    id: generateId("accounting_period"),
    workspace_id: CURRENT_WORKSPACE_ID,
    period_start: parsed.data.period_start,
    period_end: parsed.data.period_end,
    status: "open",
    closed_at: null,
    closed_by: null,
    locked_at: null,
    locked_by: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeAccountingPeriods([...readAccountingPeriods(), period]);

  await getCoreAuditLogService().recordAuditEvent(period.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "accounting_period_created",
    ownerType: "accounting_period",
    ownerId: period.id,
    before: null,
    after: { period_start: period.period_start, period_end: period.period_end },
  });

  return ok(period);
}

async function closeAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>> {
  const existing = readAccountingPeriods().find((p) => p.id === id);
  if (!existing) {
    return fail("Accounting period not found.");
  }
  if (existing.status !== "open") {
    return fail(`Cannot close a period with status ${existing.status}.`);
  }

  const timestamp = nowIso();
  const updated: AccountingPeriod = { ...existing, status: "closed", closed_at: timestamp, closed_by: CURRENT_ACTOR, updated_at: timestamp };
  writeAccountingPeriods(readAccountingPeriods().map((p) => (p.id === id ? updated : p)));

  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "accounting_period_closed",
    ownerType: "accounting_period",
    ownerId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return ok(updated);
}

async function lockAccountingPeriod(id: string): Promise<DataResult<AccountingPeriod>> {
  const existing = readAccountingPeriods().find((p) => p.id === id);
  if (!existing) {
    return fail("Accounting period not found.");
  }
  if (existing.status !== "closed") {
    return fail(`Cannot lock a period with status ${existing.status} — a period must be closed before it can be locked.`);
  }

  const timestamp = nowIso();
  const updated: AccountingPeriod = { ...existing, status: "locked", locked_at: timestamp, locked_by: CURRENT_ACTOR, updated_at: timestamp };
  writeAccountingPeriods(readAccountingPeriods().map((p) => (p.id === id ? updated : p)));

  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "accounting_period_locked",
    ownerType: "accounting_period",
    ownerId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status },
  });

  return ok(updated);
}

/**
 * Finance Reports Foundation — every method below derives exclusively from
 * the mock journalEntriesStore/journalLinesStore/chartOfAccountsStore (never
 * invoices/payments/expenses/purchases/inventory_movements), filtering to
 * posting_status = 'posted' only, exactly mirroring the Supabase RPCs'
 * semantics via the same shared reportCalculations.ts helpers — the two
 * repositories can never compute a report differently. See
 * docs/finance-reports.md.
 */

function postedJournalEntriesById(): Map<string, JournalEntry> {
  return new Map(
    readJournalEntries()
      .filter((entry) => entry.workspace_id === CURRENT_WORKSPACE_ID && entry.posting_status === "posted")
      .map((entry) => [entry.id, entry]),
  );
}

function compareLineOrder(
  a: { entry: JournalEntry; line: JournalLine },
  b: { entry: JournalEntry; line: JournalLine },
): number {
  if (a.entry.entry_date !== b.entry.entry_date) return a.entry.entry_date < b.entry.entry_date ? -1 : 1;
  if (a.entry.created_at !== b.entry.created_at) return a.entry.created_at < b.entry.created_at ? -1 : 1;
  if (a.entry.id !== b.entry.id) return a.entry.id < b.entry.id ? -1 : 1;
  return a.line.id < b.line.id ? -1 : 1;
}

async function getGeneralLedgerReport(filters: GeneralLedgerReportFilters): Promise<GeneralLedgerReport> {
  const { startDate, endDate, accountId, accountType, sourceType } = filters;
  if (!startDate || !endDate) {
    throw new Error("A start date and end date are required.");
  }
  if (endDate < startDate) {
    throw new Error("End date must not be before start date.");
  }

  const eligibleAccounts = readChartOfAccounts()
    .filter((account) => account.workspace_id === CURRENT_WORKSPACE_ID)
    .filter((account) => !accountId || account.id === accountId)
    .filter((account) => !accountType || account.account_type === accountType);

  const entriesById = postedJournalEntriesById();
  const allLines = readJournalLines().filter((line) => entriesById.has(line.journal_entry_id));

  const accounts: GeneralLedgerAccount[] = eligibleAccounts.map((account) => {
    const accountEntries = allLines
      .filter((line) => line.account_id === account.id)
      .map((line) => ({ line, entry: entriesById.get(line.journal_entry_id)! }))
      .sort(compareLineOrder);

    const beforeRange = accountEntries.filter((x) => x.entry.entry_date < startDate);
    const openingBalanceMinor = beforeRange.reduce(
      (sum, x) => sum + calculateNormalBalance(account.normal_balance, x.line.debit_minor, x.line.credit_minor),
      0,
    );

    const inRange = accountEntries.filter((x) => x.entry.entry_date >= startDate && x.entry.entry_date <= endDate);
    const runningBalances = calculateRunningBalance(
      account.normal_balance,
      openingBalanceMinor,
      inRange.map((x) => ({ debitMinor: x.line.debit_minor, creditMinor: x.line.credit_minor })),
    );

    const transactions: GeneralLedgerTransaction[] = inRange
      .map((x, index) => ({ x, runningBalanceMinor: runningBalances[index] }))
      .filter(({ x }) => !sourceType || x.entry.source_type === sourceType)
      .map(({ x, runningBalanceMinor }) => ({
        journalEntryId: x.entry.id,
        entryDate: x.entry.entry_date,
        memo: x.entry.memo,
        sourceType: x.entry.source_type,
        sourceId: x.entry.source_id,
        postingStatus: x.entry.posting_status,
        journalLineId: x.line.id,
        lineMemo: x.line.line_memo,
        debitMinor: x.line.debit_minor,
        creditMinor: x.line.credit_minor,
        runningBalanceMinor,
      }));

    const closingBalanceMinor = runningBalances.length > 0 ? runningBalances[runningBalances.length - 1] : openingBalanceMinor;

    return {
      accountId: account.id,
      accountNumber: account.account_number,
      accountName: account.name,
      accountType: account.account_type,
      normalBalance: account.normal_balance,
      openingBalanceMinor,
      transactions,
      closingBalanceMinor,
    };
  });

  return { workspaceId: CURRENT_WORKSPACE_ID, generatedAt: nowIso(), startDate, endDate, accounts };
}

async function getTrialBalanceReport(filters: TrialBalanceReportFilters): Promise<TrialBalanceReport> {
  const { asOfDate, includeZeroBalances = false } = filters;
  if (!asOfDate) {
    throw new Error("An as-of date is required.");
  }

  const accounts = readChartOfAccounts().filter((account) => account.workspace_id === CURRENT_WORKSPACE_ID);
  const entriesById = new Map(
    Array.from(postedJournalEntriesById()).filter(([, entry]) => entry.entry_date <= asOfDate),
  );
  const lines = readJournalLines().filter((line) => entriesById.has(line.journal_entry_id));

  const rows: TrialBalanceRow[] = [];
  for (const account of accounts) {
    const accountLines = lines.filter((line) => line.account_id === account.id);
    const debitMinor = sumMinor(accountLines.map((line) => line.debit_minor));
    const creditMinor = sumMinor(accountLines.map((line) => line.credit_minor));
    if (!includeZeroBalances && debitMinor === 0 && creditMinor === 0) continue;
    const { endingDebitMinor, endingCreditMinor } = splitEndingBalance(debitMinor, creditMinor);
    rows.push({
      accountId: account.id,
      accountNumber: account.account_number,
      accountName: account.name,
      accountType: account.account_type,
      normalBalance: account.normal_balance,
      isArchived: account.archived_at !== null,
      debitMinor,
      creditMinor,
      endingDebitMinor,
      endingCreditMinor,
    });
  }
  rows.sort((a, b) => a.accountNumber - b.accountNumber);

  const { isBalanced, totalEndingDebitMinor, totalEndingCreditMinor } = validateTrialBalance(rows);

  return { workspaceId: CURRENT_WORKSPACE_ID, generatedAt: nowIso(), asOfDate, rows, totalEndingDebitMinor, totalEndingCreditMinor, isBalanced };
}

const INCOME_STATEMENT_ACCOUNT_TYPES = new Set([
  "revenue",
  "contra_revenue",
  "cost_of_goods_sold",
  "operating_expense",
  "other_income",
  "other_expense",
]);

async function getProfitAndLossReport(filters: ProfitAndLossReportFilters): Promise<ProfitAndLossReport> {
  const { startDate, endDate, comparison } = filters;
  if (!startDate || !endDate) {
    throw new Error("A start date and end date are required.");
  }
  if (endDate < startDate) {
    throw new Error("End date must not be before start date.");
  }
  if (comparison && comparison.endDate < comparison.startDate) {
    throw new Error("Comparison end date must not be before comparison start date.");
  }

  const accounts = readChartOfAccounts()
    .filter((account) => account.workspace_id === CURRENT_WORKSPACE_ID)
    .filter((account) => INCOME_STATEMENT_ACCOUNT_TYPES.has(account.account_type));
  const entriesById = postedJournalEntriesById();
  const lines = readJournalLines().filter((line) => entriesById.has(line.journal_entry_id));

  const movements = accounts.map((account) => {
    const accountLines = lines
      .filter((line) => line.account_id === account.id)
      .map((line) => ({ line, entry: entriesById.get(line.journal_entry_id)! }));

    const inCurrentRange = accountLines.filter((x) => x.entry.entry_date >= startDate && x.entry.entry_date <= endDate);
    const inComparisonRange = comparison
      ? accountLines.filter((x) => x.entry.entry_date >= comparison.startDate && x.entry.entry_date <= comparison.endDate)
      : [];

    return {
      accountId: account.id,
      accountNumber: account.account_number,
      accountName: account.name,
      accountType: account.account_type,
      normalBalance: account.normal_balance,
      currentDebitMinor: sumMinor(inCurrentRange.map((x) => x.line.debit_minor)),
      currentCreditMinor: sumMinor(inCurrentRange.map((x) => x.line.credit_minor)),
      comparisonDebitMinor: sumMinor(inComparisonRange.map((x) => x.line.debit_minor)),
      comparisonCreditMinor: sumMinor(inComparisonRange.map((x) => x.line.credit_minor)),
    };
  });

  const { sections, netIncomeMinor, comparisonNetIncomeMinor } = buildProfitAndLossSections(movements, !!comparison);

  return {
    workspaceId: CURRENT_WORKSPACE_ID,
    generatedAt: nowIso(),
    startDate,
    endDate,
    comparisonStartDate: comparison?.startDate ?? null,
    comparisonEndDate: comparison?.endDate ?? null,
    sections,
    netIncomeMinor,
    comparisonNetIncomeMinor,
  };
}

const BALANCE_SHEET_ACCOUNT_TYPES = new Set(["asset", "liability", "equity"]);

async function getBalanceSheetReport(filters: BalanceSheetReportFilters): Promise<BalanceSheetReport> {
  const { asOfDate } = filters;
  if (!asOfDate) {
    throw new Error("An as-of date is required.");
  }

  const allAccounts = readChartOfAccounts().filter((account) => account.workspace_id === CURRENT_WORKSPACE_ID);
  const entriesById = new Map(
    Array.from(postedJournalEntriesById()).filter(([, entry]) => entry.entry_date <= asOfDate),
  );
  const lines = readJournalLines().filter((line) => entriesById.has(line.journal_entry_id));

  const currentPeriodEarningsMinor = lines
    .filter((line) => {
      const account = allAccounts.find((a) => a.id === line.account_id);
      return account && INCOME_STATEMENT_ACCOUNT_TYPES.has(account.account_type);
    })
    .reduce((sum, line) => sum + (line.credit_minor - line.debit_minor), 0);

  const balanceSheetAccounts = allAccounts.filter((account) => BALANCE_SHEET_ACCOUNT_TYPES.has(account.account_type));
  const balances = balanceSheetAccounts.map((account) => {
    const accountLines = lines.filter((line) => line.account_id === account.id);
    return {
      accountId: account.id,
      accountNumber: account.account_number,
      accountName: account.name,
      accountType: account.account_type,
      parentAccountId: account.parent_account_id,
      closingBalanceMinor: accountLines.reduce(
        (sum, line) => sum + calculateNormalBalance(account.normal_balance, line.debit_minor, line.credit_minor),
        0,
      ),
    };
  });

  const { sections, totalAssetsMinor, totalLiabilitiesMinor, totalEquityMinor } = buildBalanceSheetSections(
    balances,
    currentPeriodEarningsMinor,
  );

  return {
    workspaceId: CURRENT_WORKSPACE_ID,
    generatedAt: nowIso(),
    asOfDate,
    sections,
    totalAssetsMinor,
    totalLiabilitiesMinor,
    totalEquityMinor,
    currentPeriodEarningsMinor,
    isBalanced: validateAccountingEquation(totalAssetsMinor, totalLiabilitiesMinor, totalEquityMinor),
  };
}

export const mockFinanceRepository: FinanceRepository = {
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
