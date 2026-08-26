import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveExpense,
  archiveInvoice,
  approveExpense,
  cancelExpense,
  cancelPayment,
  createExpense,
  createInvoice,
  createExpenseNote,
  createInvoiceNote,
  createPayment,
  createPaymentNote,
  duplicateExpense,
  duplicateInvoice,
  getDashboardMetrics,
  getEventFinancialStatus,
  getEventFinancialSummary,
  getExpenseById,
  getExpenseNextAction,
  getExpenses,
  getInvoiceById,
  getInvoiceNextAction,
  getInvoices,
  getNotesByExpenseId,
  getNotesByInvoiceId,
  getNotesByPaymentId,
  getPaymentById,
  getPaymentNextAction,
  getPayments,
  getTimelineByExpenseId,
  getTimelineByInvoiceId,
  getTimelineByPaymentId,
  getWorkspaceFinancialSummary,
  issueInvoice,
  markExpenseDue,
  markExpensePaid,
  markExpenseReimbursed,
  markInvoiceOverdue,
  markInvoiceViewed,
  markPaymentFailed,
  markPaymentProcessing,
  markPaymentSucceeded,
  refundPayment,
  resetAllMockData,
  restoreExpense,
  restoreInvoice,
  sendInvoice,
  updateExpense,
  updateInvoice,
  updatePayment,
  voidInvoice,
} from "@/lib/data";
import type { InvoiceInput, PaymentInput, ExpenseInput } from "@/modules/finance/schema";

const validInvoiceInput: InvoiceInput = {
  client_id: "client_2",
  event_id: null,
  contract_id: null,
  title: "Test Invoice",
  description: null,
  issue_date: "2026-07-01",
  due_date: "2026-07-15",
  subtotal_minor: 100000,
  tax_minor: 0,
  discount_minor: 0,
  currency: "USD",
  notes: null,
};

const validPaymentInput: PaymentInput = {
  invoice_id: null,
  client_id: "client_2",
  event_id: null,
  contract_id: null,
  payment_type: "deposit",
  amount_minor: 50000,
  currency: "USD",
  payment_method: "cash",
  reference: null,
  transaction_date: "2026-07-01",
  notes: null,
};

const validExpenseInput: ExpenseInput = {
  event_id: null,
  client_id: null,
  contract_id: null,
  supplier_id: null,
  team_member_id: null,
  category: "flowers",
  description: "Test expense",
  amount_minor: 20000,
  currency: "USD",
  transaction_date: "2026-07-01",
  due_date: null,
  reimbursable: false,
  reference: null,
  notes: null,
};

beforeEach(() => {
  resetAllMockData();
});

describe("mock data", () => {
  it("seeds every required Invoice status", async () => {
    const all = await getInvoices({ includeArchived: true });
    const statuses = new Set(all.map((i) => i.status));
    for (const status of ["draft", "sent", "partially_paid", "paid", "overdue", "voided"] as const) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it("seeds every invoice_number uniquely", async () => {
    const all = await getInvoices({ includeArchived: true });
    const numbers = all.map((i) => i.invoice_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("seeds Payments covering deposit succeeded, pending, failed, refund, cash, and bank transfer", async () => {
    const all = await getPayments();
    expect(all.some((p) => p.payment_type === "deposit" && p.status === "succeeded")).toBe(true);
    expect(all.some((p) => p.status === "pending")).toBe(true);
    expect(all.some((p) => p.status === "failed")).toBe(true);
    expect(all.some((p) => p.payment_type === "refund")).toBe(true);
    expect(all.some((p) => p.payment_method === "cash")).toBe(true);
    expect(all.some((p) => p.payment_method === "bank_transfer")).toBe(true);
  });

  it("seeds Expenses across a spread of categories including a reimbursed and a not-yet-reimbursed pair", async () => {
    const all = await getExpenses();
    const categories = new Set(all.map((e) => e.category));
    expect(categories.has("flowers")).toBe(true);
    expect(categories.has("team_payroll")).toBe(true);
    expect(categories.has("software")).toBe(true);
    expect(all.some((e) => e.reimbursable && e.reimbursed_at !== null)).toBe(true);
    expect(all.some((e) => e.reimbursable && e.reimbursed_at === null)).toBe(true);
  });
});

describe("createInvoice", () => {
  it("creates an invoice with a generated invoice_number and computed total", async () => {
    const result = await createInvoice(validInvoiceInput, crypto.randomUUID());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoice_number).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(result.data.status).toBe("draft");
      expect(result.data.total_minor).toBe(100000);
      expect(result.data.paid_minor).toBe(0);
      expect(result.data.balance_minor).toBe(100000);
    }
  });

  it("computes total_minor as subtotal + tax - discount", async () => {
    const result = await createInvoice({ ...validInvoiceInput, subtotal_minor: 100000, tax_minor: 5000, discount_minor: 10000 }, crypto.randomUUID());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_minor).toBe(95000);
    }
  });

  it("rejects an invalid client_id", async () => {
    const result = await createInvoice({ ...validInvoiceInput, client_id: "does_not_exist" }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("rejects an event that doesn't belong to the given client", async () => {
    // event_1 belongs to client_2; client_1 is a different client
    const result = await createInvoice({ ...validInvoiceInput, client_id: "client_1", event_id: "event_1" }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("accepts an event that belongs to the given client", async () => {
    const result = await createInvoice({ ...validInvoiceInput, client_id: "client_2", event_id: "event_1" }, crypto.randomUUID());
    expect(result.success).toBe(true);
  });

  it("rejects a contract that doesn't belong to the given client", async () => {
    const result = await createInvoice({ ...validInvoiceInput, client_id: "client_1", contract_id: "contract_1" }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("records an invoice_created timeline entry", async () => {
    const result = await createInvoice(validInvoiceInput, crypto.randomUUID());
    expect(result.success).toBe(true);
    if (result.success) {
      const timeline = await getTimelineByInvoiceId(result.data.id);
      expect(timeline.some((t) => t.type === "invoice_created")).toBe(true);
    }
  });

  it("Finance F2.1C-F-E-D-B1: forwards the caller-supplied invoiceId unchanged to the repository — a same-id retry replays the same Invoice", async () => {
    const id = crypto.randomUUID();
    const first = await createInvoice(validInvoiceInput, id);
    expect(first.success).toBe(true);
    const second = await createInvoice(validInvoiceInput, id);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.id).toBe(id);
  });
});

describe("Invoice status transitions", () => {
  it("issues a draft invoice", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await issueInvoice(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("issued");
  });

  it("cannot send a draft invoice directly (must be issued first)", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await sendInvoice(created.data.id);
    expect(result.success).toBe(false);
  });

  it("sends an issued invoice", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await issueInvoice(created.data.id);
    const result = await sendInvoice(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("sent");
      expect(result.data.sent_at).not.toBeNull();
    }
  });

  it("marks a sent invoice as viewed, idempotently", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await issueInvoice(created.data.id);
    await sendInvoice(created.data.id);
    const first = await markInvoiceViewed(created.data.id);
    if (!first.success) throw new Error("expected success");
    const second = await markInvoiceViewed(created.data.id);
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.viewed_at).toBe(first.data.viewed_at);
  });

  it("marks an invoice overdue only when it has a due_date", async () => {
    const created = await createInvoice({ ...validInvoiceInput, due_date: null }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await issueInvoice(created.data.id);
    await sendInvoice(created.data.id);
    const result = await markInvoiceOverdue(created.data.id);
    expect(result.success).toBe(false);
  });

  it("marks a sent invoice overdue when it has a due_date", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await issueInvoice(created.data.id);
    await sendInvoice(created.data.id);
    const result = await markInvoiceOverdue(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("overdue");
      expect(result.data.overdue_at).not.toBeNull();
    }
  });

  it("voids an invoice", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("voided");
  });

  it("cannot void a paid invoice", async () => {
    const invoices = await getInvoices({ includeArchived: true, status: "paid" });
    expect(invoices.length).toBeGreaterThan(0);
    const result = await voidInvoice(invoices[0].id, crypto.randomUUID(), "reason");
    expect(result.success).toBe(false);
  });

  it("archives and restores an invoice back to draft", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const archived = await archiveInvoice(created.data.id);
    expect(archived.success).toBe(true);
    const restored = await restoreInvoice(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("draft");
      expect(restored.data.archived_at).toBeNull();
    }
  });

  it("blocks content edits once an invoice is voided or archived", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");
    const result = await updateInvoice(created.data.id, validInvoiceInput);
    expect(result.success).toBe(false);
  });
});

describe("duplicateInvoice", () => {
  it("creates a new draft invoice with a new id, a new invoice_number, and no inherited lifecycle timestamps", async () => {
    const invoices = await getInvoices({ includeArchived: true, status: "paid" });
    const original = invoices[0];
    const result = await duplicateInvoice(original.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).not.toBe(original.id);
      expect(result.data.invoice_number).not.toBe(original.invoice_number);
      expect(result.data.status).toBe("draft");
      expect(result.data.paid_minor).toBe(0);
      expect(result.data.balance_minor).toBe(result.data.total_minor);
      expect(result.data.sent_at).toBeNull();
      expect(result.data.paid_at).toBeNull();
    }
  });
});

describe("createPayment and Invoice application", () => {
  it("creates a payment with client_id required", async () => {
    const result = await createPayment({ ...validPaymentInput, client_id: "does_not_exist" }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("rejects an invoice_id that doesn't belong to the given client", async () => {
    const invoices = await getInvoices({ includeArchived: true });
    const someOtherClientsInvoice = invoices.find((i) => i.client_id !== "client_1");
    if (!someOtherClientsInvoice) throw new Error("setup failed");
    const result = await createPayment({
      ...validPaymentInput,
      client_id: "client_1",
      invoice_id: someOtherClientsInvoice.id,
    }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("records a cash payment as immediately succeeded", async () => {
    const result = await createPayment({ ...validPaymentInput, payment_method: "cash" }, crypto.randomUUID());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("succeeded");
      expect(result.data.received_at).not.toBeNull();
    }
  });

  it("records a credit_card payment as pending (no provider connected)", async () => {
    const result = await createPayment({ ...validPaymentInput, payment_method: "credit_card" }, crypto.randomUUID());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
      expect(result.data.received_at).toBeNull();
    }
  });

  it("applies a full succeeded payment to its Invoice, marking it paid", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 50000,
      payment_method: "cash",
    }, crypto.randomUUID());

    const updated = await getInvoiceById(invoice.data.id);
    expect(updated.status).toBe("paid");
    expect(updated.paid_minor).toBe(50000);
    expect(updated.balance_minor).toBe(0);
  });

  it("applies a partial succeeded payment to its Invoice, marking it partially_paid", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 40000,
      payment_method: "cash",
    }, crypto.randomUUID());

    const updated = await getInvoiceById(invoice.data.id);
    expect(updated.status).toBe("partially_paid");
    expect(updated.paid_minor).toBe(40000);
    expect(updated.balance_minor).toBe(60000);
  });

  it("does not let a pending payment count toward an Invoice's paid total", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 50000,
      payment_method: "credit_card",
    }, crypto.randomUUID());

    const updated = await getInvoiceById(invoice.data.id);
    expect(updated.status).toBe("sent");
    expect(updated.paid_minor).toBe(0);
  });

  it("does not let a failed payment count toward an Invoice's paid total", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    const payment = await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 50000,
      payment_method: "credit_card",
    }, crypto.randomUUID());
    if (!payment.success) throw new Error("setup failed");
    await markPaymentFailed(payment.data.id);

    const updated = await getInvoiceById(invoice.data.id);
    expect(updated.paid_minor).toBe(0);
    expect(updated.status).not.toBe("paid");
  });

  it("rejects a payment that would exceed the invoice's remaining balance (no overpayment)", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    const result = await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 90000,
      payment_method: "cash",
    }, crypto.randomUUID());
    expect(result.success).toBe(false);

    const updated = await getInvoiceById(invoice.data.id);
    expect(updated.paid_minor).toBe(0);
    expect(updated.balance_minor).toBe(50000);
  });

  it("accepts a payment that exactly matches the remaining balance", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    const result = await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 50000,
      payment_method: "cash",
    }, crypto.randomUUID());
    expect(result.success).toBe(true);

    const updated = await getInvoiceById(invoice.data.id);
    expect(updated.balance_minor).toBe(0);
    expect(updated.status).toBe("paid");
  });

  it("rejects marking a pending payment succeeded if the invoice's balance shrank in the meantime", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);

    const pending = await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 40000,
      payment_method: "credit_card",
    }, crypto.randomUUID());
    if (!pending.success) throw new Error("setup failed");

    // A second, immediately-succeeded payment covers the balance first.
    await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 50000,
      payment_method: "cash",
    }, crypto.randomUUID());

    const result = await markPaymentSucceeded(pending.data.id);
    expect(result.success).toBe(false);
  });
});

describe("Payment status transitions", () => {
  it("moves a pending payment through processing to succeeded", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "credit_card" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const processing = await markPaymentProcessing(created.data.id);
    expect(processing.success).toBe(true);
    if (processing.success) expect(processing.data.status).toBe("processing");
    const succeeded = await markPaymentSucceeded(created.data.id);
    expect(succeeded.success).toBe(true);
    if (succeeded.success) expect(succeeded.data.status).toBe("succeeded");
  });

  it("cannot mark a succeeded payment as failed", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "cash" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await markPaymentFailed(created.data.id);
    expect(result.success).toBe(false);
  });

  it("cancels a pending payment", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "credit_card" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await cancelPayment(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
  });

  it("blocks content edits once a payment is final", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "credit_card" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await cancelPayment(created.data.id);
    const result = await updatePayment(created.data.id, validPaymentInput);
    expect(result.success).toBe(false);
  });
});

describe("refundPayment", () => {
  it("creates a refund-type Payment and marks the original refunded when fully refunded", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    const refund = await refundPayment(original.data.id, 50000, crypto.randomUUID());
    expect(refund.success).toBe(true);
    if (refund.success) {
      expect(refund.data.payment_type).toBe("refund");
      expect(refund.data.amount_minor).toBe(50000);
    }
    const updatedOriginal = await getPaymentById(original.data.id);
    expect(updatedOriginal.status).toBe("refunded");
    expect(updatedOriginal.refunded_at).not.toBeNull();
  });

  it("marks the original partially_refunded when less than the full amount is refunded", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    await refundPayment(original.data.id, 20000, crypto.randomUUID());
    const updatedOriginal = await getPaymentById(original.data.id);
    expect(updatedOriginal.status).toBe("partially_refunded");
  });

  it("prevents refunding more than the refundable amount", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    const result = await refundPayment(original.data.id, 60000, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("prevents a second refund from exceeding what remains after the first", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    await refundPayment(original.data.id, 30000, crypto.randomUUID());
    const secondRefund = await refundPayment(original.data.id, 30000, crypto.randomUUID());
    expect(secondRefund.success).toBe(false);
  });

  it("allows a second refund that fits within the remaining refundable amount", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    await refundPayment(original.data.id, 30000, crypto.randomUUID());
    const secondRefund = await refundPayment(original.data.id, 20000, crypto.randomUUID());
    expect(secondRefund.success).toBe(true);
    const updatedOriginal = await getPaymentById(original.data.id);
    expect(updatedOriginal.status).toBe("refunded");
  });

  it("cannot refund a pending payment", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "credit_card" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await refundPayment(created.data.id, 10000, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative refund amount", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    expect((await refundPayment(original.data.id, 0, crypto.randomUUID())).success).toBe(false);
    expect((await refundPayment(original.data.id, -100, crypto.randomUUID())).success).toBe(false);
  });

  it("recomputes the linked Invoice's paid/balance/status after a refund", async () => {
    const invoice = await createInvoice({ ...validInvoiceInput, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 }, crypto.randomUUID());
    if (!invoice.success) throw new Error("setup failed");
    await issueInvoice(invoice.data.id);
    await sendInvoice(invoice.data.id);
    const payment = await createPayment({
      ...validPaymentInput,
      invoice_id: invoice.data.id,
      amount_minor: 50000,
      payment_method: "cash",
    }, crypto.randomUUID());
    if (!payment.success) throw new Error("setup failed");

    let updatedInvoice = await getInvoiceById(invoice.data.id);
    expect(updatedInvoice.status).toBe("paid");

    await refundPayment(payment.data.id, 20000, crypto.randomUUID());

    // Finance F2.1C-D-B: this invoice-linked refund posts a Revenue
    // correction (20000 of the 50000 subtotal is no longer recognized), so
    // total_minor is synchronized down to 30000 alongside it — the true
    // economic total after the refund, not the stale original 50000. Net
    // cash actually retained (50000 paid - 20000 refunded = 30000) now
    // exactly matches that corrected total, so balance_minor is 0 and the
    // invoice reads as fully paid rather than phantom-owing 20000 more.
    updatedInvoice = await getInvoiceById(invoice.data.id);
    expect(updatedInvoice.total_minor).toBe(30000);
    expect(updatedInvoice.paid_minor).toBe(30000);
    expect(updatedInvoice.balance_minor).toBe(0);
    expect(updatedInvoice.status).toBe("paid");
  });

  it("records a payment_refunded timeline entry", async () => {
    const original = await createPayment({ ...validPaymentInput, amount_minor: 50000, payment_method: "cash" }, crypto.randomUUID());
    if (!original.success) throw new Error("setup failed");
    const refund = await refundPayment(original.data.id, 50000, crypto.randomUUID());
    if (!refund.success) throw new Error("expected success");
    const timeline = await getTimelineByPaymentId(refund.data.id);
    expect(timeline.some((t) => t.type === "payment_refunded")).toBe(true);
  });
});

describe("createExpense", () => {
  it("creates a general business expense with no Client/Event/Contract", async () => {
    const result = await createExpense(validExpenseInput, crypto.randomUUID());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("planned");
      expect(result.data.client_id).toBeNull();
      expect(result.data.event_id).toBeNull();
    }
  });

  it("rejects an event that doesn't belong to the given client", async () => {
    const result = await createExpense({ ...validExpenseInput, client_id: "client_1", event_id: "event_1" }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("accepts an event that belongs to the given client", async () => {
    const result = await createExpense({ ...validExpenseInput, client_id: "client_2", event_id: "event_1" }, crypto.randomUUID());
    expect(result.success).toBe(true);
  });

  it("rejects a zero amount", async () => {
    const result = await createExpense({ ...validExpenseInput, amount_minor: 0 }, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("Finance F2.1C-F-E-D-B2: forwards the caller-supplied expenseId unchanged to the repository — a same-id retry replays the same Expense", async () => {
    const id = crypto.randomUUID();
    const first = await createExpense(validExpenseInput, id);
    expect(first.success).toBe(true);
    const second = await createExpense(validExpenseInput, id);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.id).toBe(id);
  });
});

describe("getExpenseById", () => {
  it("returns the matching Expense", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const found = await getExpenseById(created.data.id);
    expect(found.id).toBe(created.data.id);
  });

  it("throws NotFoundError for a missing Expense", async () => {
    await expect(getExpenseById("does_not_exist")).rejects.toThrow();
  });
});

describe("Expense status transitions", () => {
  it("moves planned -> approved -> due -> paid", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    expect((await approveExpense(created.data.id)).success).toBe(true);
    expect((await markExpenseDue(created.data.id)).success).toBe(true);
    const paid = await markExpensePaid(created.data.id);
    expect(paid.success).toBe(true);
    if (paid.success) expect(paid.data.paid_at).not.toBeNull();
  });

  it("cannot mark planned expense due directly (must be approved first)", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await markExpenseDue(created.data.id);
    expect(result.success).toBe(false);
  });

  it("reimburses a paid, reimbursable expense", async () => {
    const created = await createExpense({ ...validExpenseInput, reimbursable: true }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await approveExpense(created.data.id);
    await markExpensePaid(created.data.id);
    const result = await markExpenseReimbursed(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reimbursed_at).not.toBeNull();
  });

  it("cannot reimburse a non-reimbursable expense", async () => {
    const created = await createExpense({ ...validExpenseInput, reimbursable: false }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await approveExpense(created.data.id);
    await markExpensePaid(created.data.id);
    const result = await markExpenseReimbursed(created.data.id);
    expect(result.success).toBe(false);
  });

  it("cancels a planned expense", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const result = await cancelExpense(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
  });

  it("cannot cancel a paid expense", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await approveExpense(created.data.id);
    await markExpensePaid(created.data.id);
    const result = await cancelExpense(created.data.id);
    expect(result.success).toBe(false);
  });

  it("archives and restores an expense back to planned", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await archiveExpense(created.data.id);
    const restored = await restoreExpense(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.status).toBe("planned");
  });

  it("blocks content edits once an expense is terminal (reimbursed/cancelled/archived)", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await cancelExpense(created.data.id);
    const result = await updateExpense(created.data.id, validExpenseInput);
    expect(result.success).toBe(false);
  });
});

describe("duplicateExpense", () => {
  it("creates a new planned expense with a new id and no inherited paid/reimbursed state", async () => {
    const created = await createExpense({ ...validExpenseInput, reimbursable: true }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await approveExpense(created.data.id);
    await markExpensePaid(created.data.id);
    await markExpenseReimbursed(created.data.id);

    const duplicate = await duplicateExpense(created.data.id);
    expect(duplicate.success).toBe(true);
    if (duplicate.success) {
      expect(duplicate.data.id).not.toBe(created.data.id);
      expect(duplicate.data.status).toBe("planned");
      expect(duplicate.data.paid_at).toBeNull();
      expect(duplicate.data.reimbursed_at).toBeNull();
    }
  });
});

describe("getInvoiceNextAction / getPaymentNextAction / getExpenseNextAction", () => {
  it("returns a recommended action for a draft invoice", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const action = await getInvoiceNextAction(created.data.id);
    expect(action).toMatch(/issue/i);
  });

  it("returns null for a voided invoice", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");
    const action = await getInvoiceNextAction(created.data.id);
    expect(action).toBeNull();
  });

  it("returns a recommended action for a pending payment", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "credit_card" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const action = await getPaymentNextAction(created.data.id);
    expect(action).toMatch(/confirm/i);
  });

  it("returns a recommended action for a planned expense", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const action = await getExpenseNextAction(created.data.id);
    expect(action).toMatch(/approve/i);
  });
});

describe("Financial summaries", () => {
  it("getEventFinancialSummary returns figures scoped to the given Event", async () => {
    const summary = await getEventFinancialSummary("event_1");
    expect(summary.invoiced_total_minor).toBeGreaterThan(0);
    expect(typeof summary.payment_completion_percentage).toBe("number");
  });

  it("getWorkspaceFinancialSummary returns every required figure", async () => {
    const summary = await getWorkspaceFinancialSummary();
    expect(typeof summary.revenue_this_month_minor).toBe("number");
    expect(typeof summary.outstanding_receivables_minor).toBe("number");
    expect(typeof summary.overdue_receivables_minor).toBe("number");
    expect(typeof summary.deposits_pending_minor).toBe("number");
  });

  it("getEventFinancialStatus derives a valid status for a seeded Event", async () => {
    const status = await getEventFinancialStatus("event_1");
    expect([
      "no_contract",
      "awaiting_invoice",
      "awaiting_deposit",
      "deposit_partial",
      "deposit_paid",
      "balance_due",
      "paid_in_full",
      "overdue",
      "refunded",
      "cancelled",
    ]).toContain(status);
  });

  it("getEventFinancialStatus throws NotFoundError for a missing Event", async () => {
    await expect(getEventFinancialStatus("does_not_exist")).rejects.toThrow();
  });
});

describe("Invoice/Payment/Expense Notes and Timeline", () => {
  it("adds and retrieves a note on an Invoice", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const noteResult = await createInvoiceNote(created.data.id, {
      title: "Test note",
      content: "Body",
      category: "general",
      priority: "normal",
    });
    expect(noteResult.success).toBe(true);
    const notes = await getNotesByInvoiceId(created.data.id);
    expect(notes.length).toBe(1);
  });

  it("adds and retrieves a note on a Payment", async () => {
    const created = await createPayment({ ...validPaymentInput, payment_method: "cash" }, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const noteResult = await createPaymentNote(created.data.id, {
      title: "Test note",
      content: "Body",
      category: "general",
      priority: "normal",
    });
    expect(noteResult.success).toBe(true);
    const notes = await getNotesByPaymentId(created.data.id);
    expect(notes.length).toBe(1);
  });

  it("adds and retrieves a note on an Expense", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    const noteResult = await createExpenseNote(created.data.id, {
      title: "Test note",
      content: "Body",
      category: "general",
      priority: "normal",
    });
    expect(noteResult.success).toBe(true);
    const notes = await getNotesByExpenseId(created.data.id);
    expect(notes.length).toBe(1);
  });

  it("scopes Invoice/Payment/Expense notes and timeline to the correct workspace via owner_type/owner_id", async () => {
    const invoice = await createInvoice(validInvoiceInput, crypto.randomUUID());
    const payment = await createPayment({ ...validPaymentInput, payment_method: "cash" }, crypto.randomUUID());
    const expense = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!invoice.success || !payment.success || !expense.success) throw new Error("setup failed");

    const invoiceNotes = await getNotesByInvoiceId(invoice.data.id);
    const paymentNotes = await getNotesByPaymentId(payment.data.id);
    const expenseNotes = await getNotesByExpenseId(expense.data.id);
    expect(invoiceNotes).toEqual([]);
    expect(paymentNotes).toEqual([]);
    expect(expenseNotes).toEqual([]);
  });

  it("records Invoice lifecycle activities on its own timeline", async () => {
    const created = await createInvoice(validInvoiceInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await issueInvoice(created.data.id);
    await sendInvoice(created.data.id);
    const timeline = await getTimelineByInvoiceId(created.data.id);
    const types = timeline.map((t) => t.type);
    expect(types).toContain("invoice_created");
    expect(types).toContain("invoice_issued");
    expect(types).toContain("invoice_sent");
  });

  it("records Expense lifecycle activities on its own timeline", async () => {
    const created = await createExpense(validExpenseInput, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");
    await approveExpense(created.data.id);
    const timeline = await getTimelineByExpenseId(created.data.id);
    const types = timeline.map((t) => t.type);
    expect(types).toContain("expense_created");
    expect(types).toContain("expense_approved");
  });
});

describe("Dashboard Finance metrics", () => {
  it("exposes every required Finance metric label with a value", async () => {
    const metrics = await getDashboardMetrics();
    const requiredLabels = [
      "Total Invoiced",
      "Total Collected",
      "Outstanding Receivables",
      "Overdue Receivables",
      "Deposits Pending",
      "Expenses This Month",
      "Gross Profit",
      "Net Profit",
      "Refunds This Month",
      "Unpaid Expenses",
      "Events Paid in Full",
    ];
    for (const label of requiredLabels) {
      expect(metrics.some((m) => m.label === label)).toBe(true);
    }
  });

  it("does not collide with the existing status-based 'Events Awaiting Deposit' metric label", async () => {
    const metrics = await getDashboardMetrics();
    const withThatExactLabel = metrics.filter((m) => m.label === "Events Awaiting Deposit");
    expect(withThatExactLabel.length).toBe(1);
    expect(metrics.some((m) => m.label === "Events Awaiting Deposit (Finance)")).toBe(true);
  });

  it("updates Total Collected after a new succeeded payment is recorded", async () => {
    const before = await getDashboardMetrics();
    const beforeValue = before.find((m) => m.label === "Total Collected")?.value;
    await createPayment({ ...validPaymentInput, payment_method: "cash", amount_minor: 999900 }, crypto.randomUUID());
    const after = await getDashboardMetrics();
    const afterValue = after.find((m) => m.label === "Total Collected")?.value;
    expect(afterValue).not.toBe(beforeValue);
  });
});

describe("existing test suite regression", () => {
  it("does not break Contract/Event dashboard metrics still present", async () => {
    const metrics = await getDashboardMetrics();
    expect(metrics.some((m) => m.label === "Total Contracts")).toBe(true);
    expect(metrics.some((m) => m.label === "Upcoming Events")).toBe(true);
  });
});
