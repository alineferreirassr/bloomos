import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
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
import { invoiceSchema, paymentSchema, expenseSchema, type InvoiceInput, type PaymentInput, type ExpenseInput } from "@/modules/finance/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import { addMinor, subtractMinor, sumMinor, calculateBalance } from "@/lib/money";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { readInvoices, writeInvoices } from "@/lib/data/mock/invoicesStore";
import { readPayments, writePayments } from "@/lib/data/mock/paymentsStore";
import { readExpenses, writeExpenses } from "@/lib/data/mock/expensesStore";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type {
  InvoiceFilters,
  PaymentFilters,
  ExpenseFilters,
  FinanceRepository,
} from "@/lib/data/finance/repository";

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
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
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

  const timestamp = nowIso();
  const updated: Invoice = { ...existing, status: "voided", voided_at: timestamp, updated_at: timestamp };
  writeInvoices(readInvoices().map((i) => (i.id === id ? updated : i)));
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
      const clientName = client ? `${client.first_name} ${client.last_name}` : "";
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
  const payment: Payment = {
    id: generateId("payment"),
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: initialStatus,
    received_at: initialStatus === "succeeded" ? timestamp : null,
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

  if (initialStatus === "succeeded" && invoice) {
    applyPaymentToInvoice(invoice.id);
  }

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

async function refundPayment(originalPaymentId: string, amountMinor: number): Promise<DataResult<Payment>> {
  const original = readPayments().find((p) => p.id === originalPaymentId);
  if (!original) {
    return fail("Payment not found.");
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
  const refundable = Math.max(0, subtractMinor(original.amount_minor, priorRefunds));
  if (amountMinor > refundable) {
    return fail(`Cannot refund more than the refundable amount (${refundable} minor units remaining).`);
  }

  const timestamp = nowIso();
  const refund: Payment = {
    id: generateId("payment"),
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
  return Math.max(0, subtractMinor(payment.amount_minor, priorRefunds));
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
};
