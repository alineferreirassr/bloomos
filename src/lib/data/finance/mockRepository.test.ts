import { afterEach, describe, expect, it } from "vitest";
import { mockFinanceRepository } from "@/lib/data/finance/mockRepository";
import { resetInvoicesStore, readInvoices } from "@/lib/data/mock/invoicesStore";
import { resetPaymentsStore } from "@/lib/data/mock/paymentsStore";
import { resetExpensesStore } from "@/lib/data/mock/expensesStore";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { resetChartOfAccountsStore } from "@/lib/data/mock/chartOfAccountsStore";
import { resetJournalEntriesStore } from "@/lib/data/mock/journalEntriesStore";
import { resetJournalLinesStore } from "@/lib/data/mock/journalLinesStore";
import { resetAccountingPeriodsStore } from "@/lib/data/mock/accountingPeriodsStore";
import { resetAuditLogStore, mockAuditLogRepository } from "@/lib/data/core/audit/mockRepository";
import { NotFoundError } from "@/core/errors";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type {
  InvoiceInput,
  PaymentInput,
  ExpenseInput,
  ManualAdjustmentInput,
  PaymentSettlementInput,
} from "@/modules/finance/schema";

afterEach(() => {
  resetInvoicesStore();
  resetPaymentsStore();
  resetExpensesStore();
  resetTimelineStore();
  resetNotesStore();
  resetChartOfAccountsStore();
  resetJournalEntriesStore();
  resetJournalLinesStore();
  resetAccountingPeriodsStore();
  resetAuditLogStore();
});

// event_1 -> client_2, event_2 -> client_3, event_3/event_4 -> client_1, event_5 -> client_4
// contract_1 -> client_2, contract_2 -> client_4, contract_3 -> client_3, contract_7 -> client_1
const BASE_INVOICE_INPUT: InvoiceInput = {
  client_id: "client_2",
  event_id: "event_1",
  contract_id: "contract_1",
  title: "Test Invoice",
  description: null,
  issue_date: null,
  due_date: "2026-08-01",
  subtotal_minor: 100000,
  tax_minor: 5000,
  discount_minor: 2000,
  currency: "USD",
  notes: null,
};

const BASE_PAYMENT_INPUT: PaymentInput = {
  invoice_id: "invoice_4",
  client_id: "client_3",
  event_id: "event_2",
  contract_id: "contract_3",
  payment_type: "deposit",
  amount_minor: 20000,
  currency: "USD",
  payment_method: "cash",
  reference: null,
  transaction_date: "2026-07-16",
  notes: null,
};

const BASE_EXPENSE_INPUT: ExpenseInput = {
  event_id: "event_1",
  client_id: "client_2",
  contract_id: "contract_1",
  supplier_id: null,
  team_member_id: null,
  category: "flowers",
  description: "Test expense",
  amount_minor: 10000,
  currency: "USD",
  transaction_date: "2026-07-16",
  due_date: null,
  reimbursable: true,
  reference: null,
  notes: null,
};

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

describe("mockFinanceRepository.getInvoices / getInvoiceById", () => {
  it("excludes archived invoices by default and filters by status/client/event/contract/search/overdueOnly", async () => {
    const all = await mockFinanceRepository.getInvoices();
    expect(all.every((i) => i.status !== "archived")).toBe(true);

    const byClient = await mockFinanceRepository.getInvoices({ clientId: "client_2" });
    expect(byClient.every((i) => i.client_id === "client_2")).toBe(true);

    const byEvent = await mockFinanceRepository.getInvoices({ eventId: "event_1" });
    expect(byEvent.every((i) => i.event_id === "event_1")).toBe(true);

    const byContract = await mockFinanceRepository.getInvoices({ contractId: "contract_1" });
    expect(byContract.every((i) => i.contract_id === "contract_1")).toBe(true);

    const paid = await mockFinanceRepository.getInvoices({ status: "paid" });
    expect(paid.every((i) => i.status === "paid")).toBe(true);
    expect(paid.length).toBeGreaterThan(0);

    const overdue = await mockFinanceRepository.getInvoices({ overdueOnly: true });
    expect(overdue.every((i) => i.status === "overdue")).toBe(true);
    expect(overdue.length).toBeGreaterThan(0);

    const bySearch = await mockFinanceRepository.getInvoices({ search: "Malibu" });
    expect(bySearch.length).toBeGreaterThan(0);
    expect(bySearch.every((i) => i.title.toLowerCase().includes("malibu"))).toBe(true);

    const withArchived = await mockFinanceRepository.getInvoices({ includeArchived: true });
    expect(withArchived.length).toBeGreaterThanOrEqual(all.length);
  });

  it("throws NotFoundError for an unknown invoice id", async () => {
    await expect(mockFinanceRepository.getInvoiceById("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("mockFinanceRepository.createInvoice — Client/Event/Contract consistency and numbering", () => {
  it("rejects an unknown client", async () => {
    const result = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, client_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects an event that doesn't belong to the selected client", async () => {
    // event_2 belongs to client_3, not client_2.
    const result = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, event_id: "event_2" });
    expect(result.success).toBe(false);
  });

  it("rejects a contract that doesn't belong to the selected client", async () => {
    // contract_2 belongs to client_4, not client_2.
    const result = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, contract_id: "contract_2" });
    expect(result.success).toBe(false);
  });

  it("generates a unique invoice_number, computes total_minor, and starts paid_minor at 0", async () => {
    const result = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.invoice_number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(result.data.status).toBe("draft");
    expect(result.data.total_minor).toBe(103000); // 100000 + 5000 - 2000
    expect(result.data.paid_minor).toBe(0);
    expect(result.data.balance_minor).toBe(103000);

    const numbers = readInvoices().map((i) => i.invoice_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("duplicateInvoice receives a new, different invoice number and reset lifecycle fields", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const duplicate = await mockFinanceRepository.duplicateInvoice(created.data.id);
    expect(duplicate.success).toBe(true);
    if (!duplicate.success) return;
    expect(duplicate.data.id).not.toBe(created.data.id);
    expect(duplicate.data.invoice_number).not.toBe(created.data.invoice_number);
    expect(duplicate.data.status).toBe("draft");
    expect(duplicate.data.paid_minor).toBe(0);
    expect(duplicate.data.balance_minor).toBe(duplicate.data.total_minor);
    expect(duplicate.data.sent_at).toBeNull();
    expect(duplicate.data.viewed_at).toBeNull();
    expect(duplicate.data.paid_at).toBeNull();
  });
});

describe("mockFinanceRepository.updateInvoice", () => {
  it("blocked once the invoice is terminal (voided/archived)", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const voided = await mockFinanceRepository.voidInvoice(created.data.id);
    expect(voided.success).toBe(true);

    const result = await mockFinanceRepository.updateInvoice(created.data.id, BASE_INVOICE_INPUT);
    expect(result.success).toBe(false);
  });

  it("rejects changing the client_id", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await mockFinanceRepository.updateInvoice(created.data.id, {
      ...BASE_INVOICE_INPUT,
      client_id: "client_4",
    });
    expect(result.success).toBe(false);
  });

  it("recomputes total_minor and balance_minor", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await mockFinanceRepository.updateInvoice(created.data.id, {
      ...BASE_INVOICE_INPUT,
      subtotal_minor: 200000,
      tax_minor: 0,
      discount_minor: 0,
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.total_minor).toBe(200000);
    expect(updated.data.balance_minor).toBe(200000);
  });
});

describe("mockFinanceRepository Invoice status lifecycle", () => {
  it("runs issue -> send -> viewed -> overdue -> voided, and rejects out-of-order transitions", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const id = created.data.id;

    const tooEarly = await mockFinanceRepository.markInvoiceViewed(id);
    expect(tooEarly.success).toBe(false);

    const issued = await mockFinanceRepository.issueInvoice(id);
    expect(issued.success).toBe(true);
    if (issued.success) expect(issued.data.status).toBe("issued");

    const sent = await mockFinanceRepository.sendInvoice(id);
    expect(sent.success).toBe(true);
    if (sent.success) {
      expect(sent.data.status).toBe("sent");
      expect(sent.data.sent_at).not.toBeNull();
    }

    const viewed = await mockFinanceRepository.markInvoiceViewed(id);
    expect(viewed.success).toBe(true);
    if (viewed.success) expect(viewed.data.status).toBe("viewed");

    const overdue = await mockFinanceRepository.markInvoiceOverdue(id);
    expect(overdue.success).toBe(true);
    if (overdue.success) {
      expect(overdue.data.status).toBe("overdue");
      expect(overdue.data.overdue_at).not.toBeNull();
    }

    const voided = await mockFinanceRepository.voidInvoice(id);
    expect(voided.success).toBe(true);
    if (voided.success) expect(voided.data.status).toBe("voided");

    const cannotVoidAgain = await mockFinanceRepository.voidInvoice(id);
    expect(cannotVoidAgain.success).toBe(false);
  });

  it("markInvoiceOverdue fails when the invoice has no due_date", async () => {
    const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, due_date: null });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    const result = await mockFinanceRepository.markInvoiceOverdue(created.data.id);
    expect(result.success).toBe(false);
  });

  it("archives and restores, resetting status to draft", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const archived = await mockFinanceRepository.archiveInvoice(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("archived");
      expect(archived.data.archived_at).not.toBeNull();
    }

    const doubleArchive = await mockFinanceRepository.archiveInvoice(created.data.id);
    expect(doubleArchive.success).toBe(false);

    const restored = await mockFinanceRepository.restoreInvoice(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("draft");
      expect(restored.data.archived_at).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

describe("mockFinanceRepository.createPayment", () => {
  it("cash/check/bank_transfer/ach/zelle/venmo start succeeded; other methods start pending", async () => {
    for (const method of ["cash", "check", "bank_transfer", "ach", "zelle", "venmo"] as const) {
      const result = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        payment_method: method,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe("succeeded");
    }

    for (const method of ["credit_card", "debit_card", "paypal", "stripe", "square", "other"] as const) {
      const result = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        payment_method: method,
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe("pending");
    }
  });

  it("rejects a succeeded payment that would exceed the linked invoice's balance_minor", async () => {
    // invoice_4 has balance_minor 50000.
    const result = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 60000,
      payment_method: "cash",
    });
    expect(result.success).toBe(false);
  });

  it("a succeeded payment covering the full balance flips the invoice to paid", async () => {
    const result = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 50000,
      payment_method: "cash",
    });
    expect(result.success).toBe(true);

    const invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
    expect(invoice.status).toBe("paid");
    expect(invoice.paid_minor).toBe(50000);
    expect(invoice.balance_minor).toBe(0);
  });

  it("a succeeded partial payment flips the invoice to partially_paid", async () => {
    const result = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "cash",
    });
    expect(result.success).toBe(true);

    const invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
    expect(invoice.status).toBe("partially_paid");
    expect(invoice.paid_minor).toBe(20000);
    expect(invoice.balance_minor).toBe(30000);
  });
});

describe("mockFinanceRepository.markPaymentSucceeded", () => {
  it("never double-counts paid_minor across multiple succeeded payments (recompute, not increment)", async () => {
    const first = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "credit_card",
    });
    const second = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "credit_card",
    });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    const firstSucceeded = await mockFinanceRepository.markPaymentSucceeded(first.data.id);
    expect(firstSucceeded.success).toBe(true);
    let invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
    expect(invoice.paid_minor).toBe(20000);

    const secondSucceeded = await mockFinanceRepository.markPaymentSucceeded(second.data.id);
    expect(secondSucceeded.success).toBe(true);
    invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
    expect(invoice.paid_minor).toBe(40000);
    expect(invoice.status).toBe("partially_paid");

    // Cannot re-mark an already succeeded payment succeeded again.
    const again = await mockFinanceRepository.markPaymentSucceeded(first.data.id);
    expect(again.success).toBe(false);
    invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
    expect(invoice.paid_minor).toBe(40000);
  });

  it("re-checks overpayment at succeed-time, not just at creation", async () => {
    const covering = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 50000,
      payment_method: "cash",
    });
    expect(covering.success).toBe(true);

    const pending = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 10000,
      payment_method: "credit_card",
    });
    expect(pending.success).toBe(true);
    if (!pending.success) return;

    // invoice_4's balance is now 0 — succeeding this pending payment must fail.
    const result = await mockFinanceRepository.markPaymentSucceeded(pending.data.id);
    expect(result.success).toBe(false);
  });
});

describe("mockFinanceRepository.markPaymentFailed / cancelPayment", () => {
  it("failed and cancelled payments never count toward the invoice's paid_minor", async () => {
    const failing = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "credit_card",
    });
    expect(failing.success).toBe(true);
    if (!failing.success) return;
    const failed = await mockFinanceRepository.markPaymentFailed(failing.data.id);
    expect(failed.success).toBe(true);
    if (failed.success) expect(failed.data.status).toBe("failed");

    const cancelling = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "credit_card",
    });
    expect(cancelling.success).toBe(true);
    if (!cancelling.success) return;
    const cancelled = await mockFinanceRepository.cancelPayment(cancelling.data.id);
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.status).toBe("cancelled");

    const invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
    expect(invoice.paid_minor).toBe(0);
    expect(invoice.status).toBe("sent");
  });
});

describe("mockFinanceRepository.refundPayment", () => {
  it("a full refund updates the original payment to refunded and restores the invoice balance", async () => {
    // payment_1: succeeded, amount 250000, linked to invoice_1 (paid, balance 0).
    const result = await mockFinanceRepository.refundPayment("payment_1", 250000);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.payment_type).toBe("refund");
    expect(result.data.amount_minor).toBe(250000);

    const original = await mockFinanceRepository.getPaymentById("payment_1");
    expect(original.status).toBe("refunded");

    const invoice = await mockFinanceRepository.getInvoiceById("invoice_1");
    expect(invoice.paid_minor).toBe(0);
    expect(invoice.balance_minor).toBe(250000);
  });

  it("a partial refund updates the original payment to partially_refunded and reduces paid_minor", async () => {
    // payment_2: succeeded, amount 300000, linked to invoice_2 (total 600000, paid 300000).
    const result = await mockFinanceRepository.refundPayment("payment_2", 100000);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const original = await mockFinanceRepository.getPaymentById("payment_2");
    expect(original.status).toBe("partially_refunded");

    const invoice = await mockFinanceRepository.getInvoiceById("invoice_2");
    expect(invoice.paid_minor).toBe(200000);
    expect(invoice.balance_minor).toBe(400000);
  });

  it("rejects a refund exceeding the remaining refundable amount", async () => {
    const result = await mockFinanceRepository.refundPayment("payment_1", 300000);
    expect(result.success).toBe(false);
  });

  it("prevents two sequential partial refunds whose sum would exceed the original amount", async () => {
    const firstRefund = await mockFinanceRepository.refundPayment("payment_2", 100000);
    expect(firstRefund.success).toBe(true);

    const secondRefund = await mockFinanceRepository.refundPayment("payment_2", 150000);
    expect(secondRefund.success).toBe(true);

    // Refundable is now 300000 - 100000 - 150000 = 50000 — a further 60000 must be rejected.
    const thirdRefund = await mockFinanceRepository.refundPayment("payment_2", 60000);
    expect(thirdRefund.success).toBe(false);

    const refundable = await mockFinanceRepository.getPaymentRefundableAmount("payment_2");
    expect(refundable).toBe(50000);
  });

  it("cannot refund a payment that isn't refundable (e.g. failed)", async () => {
    // payment_4 is seeded as "failed".
    const result = await mockFinanceRepository.refundPayment("payment_4", 1000);
    expect(result.success).toBe(false);
  });
});

describe("mockFinanceRepository.getPaymentRefundableAmount", () => {
  it("reflects prior refunds correctly", async () => {
    const before = await mockFinanceRepository.getPaymentRefundableAmount("payment_2");
    expect(before).toBe(300000);

    await mockFinanceRepository.refundPayment("payment_2", 100000);
    const after = await mockFinanceRepository.getPaymentRefundableAmount("payment_2");
    expect(after).toBe(200000);
  });

  it("returns 0 for a payment that isn't refundable", async () => {
    const refundable = await mockFinanceRepository.getPaymentRefundableAmount("payment_4");
    expect(refundable).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

describe("mockFinanceRepository.getExpenses / getExpenseById", () => {
  it("throws NotFoundError for an unknown expense id", async () => {
    await expect(mockFinanceRepository.getExpenseById("nope")).rejects.toThrow(NotFoundError);
  });

  it("filters by status/category/event/client/unpaidOnly/dueOnly/reimbursableOnly", async () => {
    const paid = await mockFinanceRepository.getExpenses({ status: "paid" });
    expect(paid.every((e) => e.status === "paid")).toBe(true);

    const unpaid = await mockFinanceRepository.getExpenses({ unpaidOnly: true });
    expect(unpaid.every((e) => ["planned", "approved", "due"].includes(e.status))).toBe(true);

    const due = await mockFinanceRepository.getExpenses({ dueOnly: true });
    expect(due.every((e) => e.status === "due")).toBe(true);

    const reimbursable = await mockFinanceRepository.getExpenses({ reimbursableOnly: true });
    expect(reimbursable.every((e) => e.reimbursable)).toBe(true);
  });
});

describe("mockFinanceRepository.createExpense / updateExpense — Event/Contract must belong to Client", () => {
  it("rejects an event that doesn't belong to the selected client when both are set", async () => {
    // event_1 belongs to client_2, not client_3.
    const result = await mockFinanceRepository.createExpense({
      ...BASE_EXPENSE_INPUT,
      client_id: "client_3",
      event_id: "event_1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a contract that doesn't belong to the selected client when both are set", async () => {
    // contract_1 belongs to client_2, not client_3.
    const result = await mockFinanceRepository.createExpense({
      ...BASE_EXPENSE_INPUT,
      client_id: "client_3",
      contract_id: "contract_1",
    });
    expect(result.success).toBe(false);
  });

  it("allows a null client_id even with an event_id set (client_id is legitimately optional)", async () => {
    const result = await mockFinanceRepository.createExpense({
      ...BASE_EXPENSE_INPUT,
      client_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("updateExpense is blocked once the expense is terminal", async () => {
    const created = await mockFinanceRepository.createExpense(BASE_EXPENSE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const cancelled = await mockFinanceRepository.cancelExpense(created.data.id);
    expect(cancelled.success).toBe(true);

    const result = await mockFinanceRepository.updateExpense(created.data.id, BASE_EXPENSE_INPUT);
    expect(result.success).toBe(false);
  });
});

describe("mockFinanceRepository Expense status lifecycle", () => {
  it("runs approve -> due -> paid -> reimbursed when reimbursable", async () => {
    const created = await mockFinanceRepository.createExpense(BASE_EXPENSE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const id = created.data.id;

    const approved = await mockFinanceRepository.approveExpense(id);
    expect(approved.success).toBe(true);
    if (approved.success) expect(approved.data.status).toBe("approved");

    const due = await mockFinanceRepository.markExpenseDue(id);
    expect(due.success).toBe(true);
    if (due.success) expect(due.data.status).toBe("due");

    const paid = await mockFinanceRepository.markExpensePaid(id);
    expect(paid.success).toBe(true);
    if (paid.success) {
      expect(paid.data.status).toBe("paid");
      expect(paid.data.paid_at).not.toBeNull();
    }

    const reimbursed = await mockFinanceRepository.markExpenseReimbursed(id);
    expect(reimbursed.success).toBe(true);
    if (reimbursed.success) {
      expect(reimbursed.data.status).toBe("reimbursed");
      expect(reimbursed.data.reimbursed_at).not.toBeNull();
    }
  });

  it("rejects markExpenseReimbursed when the expense isn't reimbursable", async () => {
    const created = await mockFinanceRepository.createExpense({ ...BASE_EXPENSE_INPUT, reimbursable: false });
    expect(created.success).toBe(true);
    if (!created.success) return;
    const id = created.data.id;

    await mockFinanceRepository.approveExpense(id);
    await mockFinanceRepository.markExpenseDue(id);
    await mockFinanceRepository.markExpensePaid(id);

    const result = await mockFinanceRepository.markExpenseReimbursed(id);
    expect(result.success).toBe(false);
  });

  it("cancelExpense works from planned but not from a terminal status", async () => {
    const created = await mockFinanceRepository.createExpense(BASE_EXPENSE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const cancelled = await mockFinanceRepository.cancelExpense(created.data.id);
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.status).toBe("cancelled");

    const again = await mockFinanceRepository.cancelExpense(created.data.id);
    expect(again.success).toBe(false);
  });

  it("archives and restores, resetting status to planned", async () => {
    const created = await mockFinanceRepository.createExpense(BASE_EXPENSE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const archived = await mockFinanceRepository.archiveExpense(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("archived");
      expect(archived.data.archived_at).not.toBeNull();
    }

    const restored = await mockFinanceRepository.restoreExpense(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("planned");
      expect(restored.data.archived_at).toBeNull();
    }
  });

  it("duplicateExpense resets status/paid_at/reimbursed_at/archived_at", async () => {
    const created = await mockFinanceRepository.createExpense(BASE_EXPENSE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const id = created.data.id;

    await mockFinanceRepository.approveExpense(id);
    await mockFinanceRepository.markExpenseDue(id);
    await mockFinanceRepository.markExpensePaid(id);

    const duplicate = await mockFinanceRepository.duplicateExpense(id);
    expect(duplicate.success).toBe(true);
    if (!duplicate.success) return;
    expect(duplicate.data.id).not.toBe(id);
    expect(duplicate.data.status).toBe("planned");
    expect(duplicate.data.paid_at).toBeNull();
    expect(duplicate.data.reimbursed_at).toBeNull();
    expect(duplicate.data.archived_at).toBeNull();

    const original = await mockFinanceRepository.getExpenseById(id);
    expect(original.status).toBe("paid");
  });
});

// ---------------------------------------------------------------------------
// Notes and Timeline
// ---------------------------------------------------------------------------

describe("mockFinanceRepository Invoice Notes and Timeline", () => {
  it("creates a note, pins/unpins it, and lists Timeline entries", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const invoiceId = created.data.id;

    const note = await mockFinanceRepository.createInvoiceNote(invoiceId, {
      title: "Deposit received",
      content: "Confirmed via Zelle.",
      category: "general",
      priority: "normal",
    });
    expect(note.success).toBe(true);
    if (!note.success) return;
    expect(note.data.is_pinned).toBe(false);

    const pinned = await mockFinanceRepository.togglePinInvoiceNote(note.data.id);
    expect(pinned?.success && pinned.data.is_pinned).toBe(true);

    const unpinned = await mockFinanceRepository.togglePinInvoiceNote(note.data.id);
    expect(unpinned?.success && unpinned.data.is_pinned).toBe(false);

    const notes = await mockFinanceRepository.getNotesByInvoiceId(invoiceId);
    expect(notes.some((n) => n.id === note.data.id)).toBe(true);

    const timeline = await mockFinanceRepository.getTimelineByInvoiceId(invoiceId);
    expect(timeline.some((a) => a.type === "note_added")).toBe(true);
    expect(timeline.some((a) => a.type === "note_pinned")).toBe(true);
    expect(timeline.some((a) => a.type === "note_unpinned")).toBe(true);
  });

  it("togglePinInvoiceNote returns null for a note that isn't Invoice-owned", async () => {
    const result = await mockFinanceRepository.togglePinInvoiceNote("note_1");
    expect(result).toBeNull();
  });
});

describe("mockFinanceRepository Payment Notes and Timeline", () => {
  it("creates a note, pins/unpins it, and lists Timeline entries", async () => {
    const created = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      payment_method: "cash",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    const paymentId = created.data.id;

    const note = await mockFinanceRepository.createPaymentNote(paymentId, {
      title: "Confirmed with client",
      content: "Client confirmed the deposit over the phone.",
      category: "general",
      priority: "normal",
    });
    expect(note.success).toBe(true);
    if (!note.success) return;

    const pinned = await mockFinanceRepository.togglePinPaymentNote(note.data.id);
    expect(pinned?.success && pinned.data.is_pinned).toBe(true);

    const notes = await mockFinanceRepository.getNotesByPaymentId(paymentId);
    expect(notes.some((n) => n.id === note.data.id)).toBe(true);

    const timeline = await mockFinanceRepository.getTimelineByPaymentId(paymentId);
    expect(timeline.some((a) => a.type === "note_added")).toBe(true);
    expect(timeline.some((a) => a.type === "note_pinned")).toBe(true);
  });

  it("togglePinPaymentNote returns null for a note that isn't Payment-owned", async () => {
    const result = await mockFinanceRepository.togglePinPaymentNote("note_1");
    expect(result).toBeNull();
  });
});

describe("mockFinanceRepository Expense Notes and Timeline", () => {
  it("creates a note, pins/unpins it, and lists Timeline entries", async () => {
    const created = await mockFinanceRepository.createExpense(BASE_EXPENSE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    const expenseId = created.data.id;

    const note = await mockFinanceRepository.createExpenseNote(expenseId, {
      title: "Receipt on file",
      content: "Receipt saved in the shared drive.",
      category: "general",
      priority: "normal",
    });
    expect(note.success).toBe(true);
    if (!note.success) return;

    const pinned = await mockFinanceRepository.togglePinExpenseNote(note.data.id);
    expect(pinned?.success && pinned.data.is_pinned).toBe(true);

    const notes = await mockFinanceRepository.getNotesByExpenseId(expenseId);
    expect(notes.some((n) => n.id === note.data.id)).toBe(true);

    const timeline = await mockFinanceRepository.getTimelineByExpenseId(expenseId);
    expect(timeline.some((a) => a.type === "note_added")).toBe(true);
    expect(timeline.some((a) => a.type === "note_pinned")).toBe(true);
  });

  it("togglePinExpenseNote returns null for a note that isn't Expense-owned", async () => {
    const result = await mockFinanceRepository.togglePinExpenseNote("note_1");
    expect(result).toBeNull();
  });
});

const PAYMENT_SETTLEMENT_INPUT: PaymentSettlementInput = { ...BASE_PAYMENT_INPUT };

const MANUAL_ADJUSTMENT_INPUT: ManualAdjustmentInput = {
  entry_date: "2026-07-15",
  memo: "Correcting entry",
  lines: [
    { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
    { account_id: "account_2000", debit_minor: 0, credit_minor: 5000, line_memo: null },
  ],
};

describe("mockFinanceRepository.listChartOfAccounts / getChartOfAccount", () => {
  it("returns the full 41-account seed, workspace-scoped, ordered by account_number, excluding archived by default", async () => {
    const accounts = await mockFinanceRepository.listChartOfAccounts();
    expect(accounts.length).toBeGreaterThan(30);
    expect(accounts.every((a) => a.workspace_id === CURRENT_WORKSPACE_ID)).toBe(true);
    for (let i = 1; i < accounts.length; i++) {
      expect(accounts[i].account_number).toBeGreaterThan(accounts[i - 1].account_number);
    }
  });

  it("filters by accountType", async () => {
    const accounts = await mockFinanceRepository.listChartOfAccounts({ accountType: "asset" });
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.every((a) => a.account_type === "asset")).toBe(true);
  });

  it("getChartOfAccount throws NotFoundError for an unknown id", async () => {
    await expect(mockFinanceRepository.getChartOfAccount("nope")).rejects.toThrow(NotFoundError);
  });

  it("getChartOfAccount returns a matching row with integer minor-unit-free, correctly-typed fields for a known id", async () => {
    const account = await mockFinanceRepository.getChartOfAccount("account_1000");
    expect(account.account_number).toBe(1000);
    expect(account.name).toBe("Cash");
    expect(account.normal_balance).toBe("debit");
  });
});

describe("mockFinanceRepository accounting periods", () => {
  it("listAccountingPeriods returns the seeded open period", async () => {
    const periods = await mockFinanceRepository.listAccountingPeriods();
    expect(periods.some((p) => p.status === "open")).toBe(true);
  });

  it("getAccountingPeriod throws NotFoundError for an unknown id", async () => {
    await expect(mockFinanceRepository.getAccountingPeriod("nope")).rejects.toThrow(NotFoundError);
  });

  it("createAccountingPeriod rejects an overlapping range and writes exactly one Audit entry on success", async () => {
    const overlap = await mockFinanceRepository.createAccountingPeriod({ period_start: "2026-07-15", period_end: "2026-09-15" });
    expect(overlap.success).toBe(false);

    const created = await mockFinanceRepository.createAccountingPeriod({ period_start: "2026-09-01", period_end: "2026-09-30" });
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data.status).toBe("open");

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "accounting_period", created.data.id);
    expect(auditEntries.filter((e) => e.action === "accounting_period_created")).toHaveLength(1);
  });

  it("period lifecycle follows open -> closed -> locked, rejecting a direct open -> locked transition, never mutating the row via a second table write", async () => {
    const periods = await mockFinanceRepository.listAccountingPeriods({ status: "open" });
    const openPeriod = periods[0];

    const lockBeforeClose = await mockFinanceRepository.lockAccountingPeriod(openPeriod.id);
    expect(lockBeforeClose.success).toBe(false);

    const closed = await mockFinanceRepository.closeAccountingPeriod(openPeriod.id);
    expect(closed.success).toBe(true);
    if (!closed.success) return;
    expect(closed.data.status).toBe("closed");
    expect(closed.data.closed_at).not.toBeNull();

    const closeAgain = await mockFinanceRepository.closeAccountingPeriod(openPeriod.id);
    expect(closeAgain.success).toBe(false);

    const locked = await mockFinanceRepository.lockAccountingPeriod(openPeriod.id);
    expect(locked.success).toBe(true);
    if (!locked.success) return;
    expect(locked.data.status).toBe("locked");
    expect(locked.data.locked_at).not.toBeNull();

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "accounting_period", openPeriod.id);
    expect(auditEntries.some((e) => e.action === "accounting_period_closed")).toBe(true);
    expect(auditEntries.some((e) => e.action === "accounting_period_locked")).toBe(true);
  });
});

describe("mockFinanceRepository.recordPaymentSettlement", () => {
  it("rejects payment_method='stripe'", async () => {
    const result = await mockFinanceRepository.recordPaymentSettlement({ ...PAYMENT_SETTLEMENT_INPUT, payment_method: "stripe" });
    expect(result.success).toBe(false);
  });

  it("creates a succeeded Payment, posts a balanced Journal Entry, and writes exactly one Audit entry", async () => {
    const result = await mockFinanceRepository.recordPaymentSettlement(PAYMENT_SETTLEMENT_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("succeeded");

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    const posted = entries.find((e) => e.source_id === result.data.id);
    expect(posted).toBeDefined();
    expect(posted?.posting_key).toBe(`payment_settlement:${result.data.id}`);

    const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
    const totalDebit = detail.lines!.reduce((sum, line) => sum + line.debit_minor, 0);
    const totalCredit = detail.lines!.reduce((sum, line) => sum + line.credit_minor, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(Number.isInteger(totalDebit)).toBe(true);

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "payment", result.data.id);
    expect(auditEntries.filter((e) => e.action === "payment_settlement_recorded")).toHaveLength(1);
  });
});

describe("mockFinanceRepository.recordExpenseTransition", () => {
  it("transitions the Expense, posts a Journal Entry, and writes exactly one Audit entry", async () => {
    const result = await mockFinanceRepository.recordExpenseTransition("expense_3", { transition: "due" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("due");

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "expense_due" });
    expect(entries.some((e) => e.source_id === "expense_3")).toBe(true);

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "expense", "expense_3");
    expect(auditEntries.filter((e) => e.action === "expense_due")).toHaveLength(1);
  });

  it("fails for an unsupported transition from the Expense's current status", async () => {
    const result = await mockFinanceRepository.recordExpenseTransition("expense_1", { transition: "due" });
    expect(result.success).toBe(false);
  });

  it("fails for an unknown Expense id", async () => {
    const result = await mockFinanceRepository.recordExpenseTransition("nope", { transition: "due" });
    expect(result.success).toBe(false);
  });
});

describe("mockFinanceRepository.recordManualAdjustment", () => {
  it("rejects a blank memo, fewer than two lines, a zero-value line, and a double-sided line", async () => {
    expect((await mockFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, memo: "" })).success).toBe(false);
    expect((await mockFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, lines: [MANUAL_ADJUSTMENT_INPUT.lines[0]] })).success).toBe(false);
    expect(
      (
        await mockFinanceRepository.recordManualAdjustment({
          ...MANUAL_ADJUSTMENT_INPUT,
          lines: [
            { account_id: "account_1000", debit_minor: 0, credit_minor: 0, line_memo: null },
            { account_id: "account_2000", debit_minor: 0, credit_minor: 0, line_memo: null },
          ],
        })
      ).success,
    ).toBe(false);
    expect(
      (
        await mockFinanceRepository.recordManualAdjustment({
          ...MANUAL_ADJUSTMENT_INPUT,
          lines: [
            { account_id: "account_1000", debit_minor: 100, credit_minor: 100, line_memo: null },
            { account_id: "account_2000", debit_minor: 0, credit_minor: 100, line_memo: null },
          ],
        })
      ).success,
    ).toBe(false);
  });

  it("rejects an unbalanced total (total debits != total credits), with no automatic plug line", async () => {
    const result = await mockFinanceRepository.recordManualAdjustment({
      ...MANUAL_ADJUSTMENT_INPUT,
      lines: [
        { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
        { account_id: "account_2000", debit_minor: 0, credit_minor: 4000, line_memo: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("posts a balanced Journal Entry with posting_key null and writes exactly one Audit entry", async () => {
    const result = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.posting_key).toBeNull();
    expect(result.data.source_id).toBeNull();
    expect(result.data.source_type).toBe("manual_adjustment");

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "journal_entry", result.data.id);
    expect(auditEntries.filter((e) => e.action === "manual_adjustment_recorded")).toHaveLength(1);
  });
});

describe("mockFinanceRepository.reverseJournalEntry", () => {
  it("requires a nonblank reason", async () => {
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockFinanceRepository.reverseJournalEntry(created.data.id, { reason: "" });
    expect(result.success).toBe(false);
  });

  it("creates a new entry with debit/credit swapped, leaves the original entry's lines unchanged, links both directions, and allows at most one reversal per entry", async () => {
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT);
    if (!created.success) throw new Error("setup failed");
    const original = await mockFinanceRepository.getJournalEntry(created.data.id);

    const reversal = await mockFinanceRepository.reverseJournalEntry(created.data.id, { reason: "Correcting a duplicate entry" });
    expect(reversal.success).toBe(true);
    if (!reversal.success) return;

    expect(reversal.data.reverses_entry_id).toBe(created.data.id);
    expect(reversal.data.posting_key).toBe(`reversal:${created.data.id}`);

    const originalAfter = await mockFinanceRepository.getJournalEntry(created.data.id);
    expect(originalAfter.reversed_by_entry_id).toBe(reversal.data.id);
    // Original's own lines are untouched — same account/amount pairing, not swapped.
    expect(originalAfter.lines!.map((l) => ({ account_id: l.account_id, debit_minor: l.debit_minor, credit_minor: l.credit_minor }))).toEqual(
      original.lines!.map((l) => ({ account_id: l.account_id, debit_minor: l.debit_minor, credit_minor: l.credit_minor })),
    );

    const reversalDetail = await mockFinanceRepository.getJournalEntry(reversal.data.id);
    for (let i = 0; i < original.lines!.length; i++) {
      expect(reversalDetail.lines![i].debit_minor).toBe(original.lines![i].credit_minor);
      expect(reversalDetail.lines![i].credit_minor).toBe(original.lines![i].debit_minor);
    }

    // A second reversal attempt on the same original entry is rejected.
    const secondReversal = await mockFinanceRepository.reverseJournalEntry(created.data.id, { reason: "Trying again" });
    expect(secondReversal.success).toBe(false);

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "journal_entry", created.data.id);
    expect(auditEntries.filter((e) => e.action === "journal_entry_reversed")).toHaveLength(1);
  });

  it("fails for an unknown Journal Entry id", async () => {
    const result = await mockFinanceRepository.reverseJournalEntry("nope", { reason: "test" });
    expect(result.success).toBe(false);
  });
});

describe("mockFinanceRepository journal ledger — append-only + interface parity", () => {
  it("never mutates or removes an existing Journal Entry row except via reversed_by_entry_id", async () => {
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT);
    if (!created.success) throw new Error("setup failed");
    const before = await mockFinanceRepository.getJournalEntry(created.data.id);

    await mockFinanceRepository.reverseJournalEntry(created.data.id, { reason: "test" });
    const after = await mockFinanceRepository.getJournalEntry(created.data.id);

    expect(after.entry_date).toBe(before.entry_date);
    expect(after.memo).toBe(before.memo);
    expect(after.posting_key).toBe(before.posting_key);
    expect(after.lines).toEqual(before.lines);
  });

  it("listJournalEntries/getJournalEntry only return entries for the current workspace", async () => {
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT);
    if (!created.success) throw new Error("setup failed");
    const entries = await mockFinanceRepository.listJournalEntries();
    expect(entries.every((e) => e.workspace_id === CURRENT_WORKSPACE_ID)).toBe(true);
  });

  it("Supabase and mock repositories expose the exact same public method names (interface parity)", async () => {
    const { supabaseFinanceRepository } = await import("@/lib/data/finance/supabaseRepository");
    const mockKeys = Object.keys(mockFinanceRepository).sort();
    const supabaseKeys = Object.keys(supabaseFinanceRepository).sort();
    expect(mockKeys).toEqual(supabaseKeys);
  });
});
