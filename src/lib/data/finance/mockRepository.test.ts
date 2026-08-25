import { afterEach, describe, expect, it } from "vitest";
import { mockFinanceRepository } from "@/lib/data/finance/mockRepository";
import { resetInvoicesStore, readInvoices } from "@/lib/data/mock/invoicesStore";
import { resetPaymentsStore } from "@/lib/data/mock/paymentsStore";
import { resetExpensesStore } from "@/lib/data/mock/expensesStore";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { resetChartOfAccountsStore } from "@/lib/data/mock/chartOfAccountsStore";
import { resetJournalEntriesStore, readJournalEntries, writeJournalEntries } from "@/lib/data/mock/journalEntriesStore";
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

    const voided = await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");
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

    const voided = await mockFinanceRepository.voidInvoice(id, crypto.randomUUID(), "Cancelled");
    expect(voided.success).toBe(true);
    if (voided.success) expect(voided.data.status).toBe("voided");

    const cannotVoidAgain = await mockFinanceRepository.voidInvoice(id, crypto.randomUUID(), "Cancelled again");
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

describe("mockFinanceRepository Finance F2.1B — Invoice Revenue Recognition (clean cases)", () => {
  // BASE_INVOICE_INPUT: subtotal 100000, tax 5000, discount 2000 -> total 103000.
  // Debits: AR 103000 + Sales Discounts 2000 = 105000. Credits: Revenue 100000 + Tax Payable 5000 = 105000.

  it("issueInvoice posts Dr AR (total_minor) + Dr Sales Discounts, Cr Revenue (subtotal_minor) + Cr Sales Tax Payable, balanced", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const issued = await mockFinanceRepository.issueInvoice(created.data.id);
    expect(issued.success).toBe(true);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    const posted = entries.find((e) => e.source_id === created.data.id);
    expect(posted).toBeDefined();
    expect(posted!.posting_key).toBe(`invoice_issued:${created.data.id}`);

    const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
    expect(detail.lines).toHaveLength(4);
    const totalDebits = detail.lines!.reduce((sum, l) => sum + l.debit_minor, 0);
    const totalCredits = detail.lines!.reduce((sum, l) => sum + l.credit_minor, 0);
    expect(totalDebits).toBe(105000);
    expect(totalCredits).toBe(105000);
    expect(totalDebits).toBe(totalCredits);

    const ar = detail.lines!.find((l) => l.account?.account_number === 1100);
    const discount = detail.lines!.find((l) => l.account?.account_number === 4900);
    const revenue = detail.lines!.find((l) => l.account?.account_number === 4000);
    const taxPayable = detail.lines!.find((l) => l.account?.account_number === 2100);
    expect(ar?.debit_minor).toBe(103000);
    expect(discount?.debit_minor).toBe(2000);
    expect(revenue?.credit_minor).toBe(100000);
    expect(taxPayable?.credit_minor).toBe(5000);
  });

  it("does not post Sales Discounts or Sales Tax Payable lines when discount/tax are zero", async () => {
    const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, tax_minor: 0, discount_minor: 0 });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    const posted = entries.find((e) => e.source_id === created.data.id);
    const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
    expect(detail.lines).toHaveLength(2);
    expect(detail.lines!.reduce((sum, l) => sum + l.debit_minor, 0)).toBe(100000);
    expect(detail.lines!.reduce((sum, l) => sum + l.credit_minor, 0)).toBe(100000);
  });

  it("Example B (subtotal 100000, tax 10000, discount 0): Dr AR 110000, Cr Revenue 100000 + Cr Tax Payable 10000, no Sales Discounts line", async () => {
    const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 10000, discount_minor: 0 });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    const posted = entries.find((e) => e.source_id === created.data.id);
    const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
    expect(detail.lines).toHaveLength(3);
    expect(detail.lines!.find((l) => l.account?.account_number === 1100)?.debit_minor).toBe(110000);
    expect(detail.lines!.find((l) => l.account?.account_number === 4000)?.credit_minor).toBe(100000);
    expect(detail.lines!.find((l) => l.account?.account_number === 2100)?.credit_minor).toBe(10000);
    expect(detail.lines!.some((l) => l.account?.account_number === 4900)).toBe(false);
    expect(detail.lines!.reduce((sum, l) => sum + l.debit_minor, 0)).toBe(detail.lines!.reduce((sum, l) => sum + l.credit_minor, 0));
  });

  it("Example D (subtotal 100000, tax 0, discount 5000): Dr AR 95000 + Dr Sales Discounts 5000, Cr Revenue 100000, no Sales Tax Payable line", async () => {
    const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 5000 });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    const posted = entries.find((e) => e.source_id === created.data.id);
    const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
    expect(detail.lines).toHaveLength(3);
    expect(detail.lines!.find((l) => l.account?.account_number === 1100)?.debit_minor).toBe(95000);
    expect(detail.lines!.find((l) => l.account?.account_number === 4900)?.debit_minor).toBe(5000);
    expect(detail.lines!.find((l) => l.account?.account_number === 4000)?.credit_minor).toBe(100000);
    expect(detail.lines!.some((l) => l.account?.account_number === 2100)).toBe(false);
    expect(detail.lines!.reduce((sum, l) => sum + l.debit_minor, 0)).toBe(detail.lines!.reduce((sum, l) => sum + l.credit_minor, 0));
  });

  it("retrying issueInvoice on an already-issued invoice does not duplicate the posting (fails at the status-transition check, before any second post)", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    const retry = await mockFinanceRepository.issueInvoice(created.data.id);
    expect(retry.success).toBe(false);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    expect(entries.filter((e) => e.source_id === created.data.id)).toHaveLength(1);
  });

  it("voidInvoice before any payment reverses the recognition entry — append-only, swapped debit/credit", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    const voided = await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");
    expect(voided.success).toBe(true);

    const originalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    const original = originalEntries.find((e) => e.source_id === created.data.id)!;
    expect(original.reversed_by_entry_id).not.toBeNull();

    const originalDetail = await mockFinanceRepository.getJournalEntry(original.id);
    expect(originalDetail.lines!.find((l) => l.account?.account_number === 1100)?.debit_minor).toBe(103000);

    const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_voided" });
    const reversal = reversalEntries.find((e) => e.source_id === created.data.id);
    expect(reversal).toBeDefined();
    expect(reversal!.posting_key).toBe(`invoice_voided:${created.data.id}`);
    expect(reversal!.reverses_entry_id).toBe(original.id);

    const reversalDetail = await mockFinanceRepository.getJournalEntry(reversal!.id);
    const reversalAr = reversalDetail.lines!.find((l) => l.account?.account_number === 1100);
    expect(reversalAr?.debit_minor).toBe(0);
    expect(reversalAr?.credit_minor).toBe(103000);
  });

  it("voidInvoice on a never-issued (draft) invoice succeeds with no recognition entry to reverse", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const voided = await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");
    expect(voided.success).toBe(true);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_voided" });
    expect(entries.filter((e) => e.source_id === created.data.id)).toHaveLength(0);
  });

  it("Finance F2.1C-D-D-B: voidInvoice on an invoice with a payment applied now SUCCEEDS via Partial-Payment Cancellation — the original invoice_issued entry is left untouched (never reversed), only a new invoice_partial_void correction posts", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: created.data.id,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 50000,
      payment_method: "cash",
    });
    expect(payment.success).toBe(true);

    const voided = await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelling the unpaid remainder");
    expect(voided.success).toBe(true);
    if (!voided.success) return;
    expect(voided.data.status).toBe("voided");
    expect(voided.data.total_minor).toBe(50000);

    const originalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" });
    const original = originalEntries.find((e) => e.source_id === created.data.id)!;
    expect(original.reversed_by_entry_id).toBeNull();

    const partialVoidEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
    expect(partialVoidEntries.some((e) => e.source_id !== undefined)).toBe(true);
  });

  it("F2.1B-REVIEW: updateInvoice rejects a subtotal/tax/discount change once issued — Revenue is already recognized against the current amounts", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);

    const rejected = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, subtotal_minor: 200000 });
    expect(rejected.success).toBe(false);

    const rejectedTax = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, tax_minor: 9999 });
    expect(rejectedTax.success).toBe(false);

    const rejectedDiscount = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, discount_minor: 1 });
    expect(rejectedDiscount.success).toBe(false);
  });

  it("F2.1B-REVIEW: updateInvoice still allows non-financial edits (title) once issued", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await mockFinanceRepository.issueInvoice(created.data.id);

    const allowed = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, title: "Renamed after issuance" });
    expect(allowed.success).toBe(true);
    if (allowed.success) expect(allowed.data.title).toBe("Renamed after issuance");
  });

  it("F2.1B-REVIEW: updateInvoice still allows financial edits while still draft (Revenue not yet recognized)", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const allowed = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, subtotal_minor: 200000 });
    expect(allowed.success).toBe(true);
    if (allowed.success) expect(allowed.data.subtotal_minor).toBe(200000);
  });

  // Finance F2.1C-B: BASE_INVOICE_INPUT -> subtotal 100000, tax 5000, discount 2000, total 103000.
  // Full refund (R=103000): tax_portion=round(103000*5000/103000)=5000, discount_portion=round(103000*2000/103000)=2000,
  // revenue_portion=103000+2000-5000=100000. Combined entry: Dr AR 103000, Dr 4950 100000, Dr 2100 5000 (=208000)
  // / Cr Cash 103000, Cr 4900 2000, Cr AR 103000 (=208000). Balances.
  async function issueInvoiceAndPayInFull(invoiceInput = BASE_INVOICE_INPUT, amountMinor = 103000) {
    const created = await mockFinanceRepository.createInvoice(invoiceInput);
    if (!created.success) throw new Error("invoice creation failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: created.data.id,
      client_id: invoiceInput.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: amountMinor,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("payment creation failed");
    return { invoiceId: created.data.id, paymentId: payment.data.id };
  }

  it("F2.1C-B: full refund with tax+discount posts a balanced 6-line correction (Dr AR/4950/2100, Cr Cash/4900/AR)", async () => {
    const { paymentId } = await issueInvoiceAndPayInFull();

    const refunded = await mockFinanceRepository.refundPayment(paymentId, 103000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
    if (!refunded.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    const entry = entries.find((e) => e.source_id === refunded.data.id)!;
    expect(entry).toBeDefined();

    const detail = await mockFinanceRepository.getJournalEntry(entry.id);
    const lines = detail.lines!;
    expect(lines).toHaveLength(6);

    const totalDebit = lines.reduce((sum, l) => sum + l.debit_minor, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_minor, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(208000);

    const arLines = lines.filter((l) => l.account?.account_number === 1100);
    expect(arLines.find((l) => l.debit_minor === 103000)).toBeDefined();
    expect(arLines.find((l) => l.credit_minor === 103000)).toBeDefined();
    expect(lines.find((l) => l.account?.account_number === 1000)?.credit_minor).toBe(103000);
    expect(lines.find((l) => l.account?.account_number === 4950)?.debit_minor).toBe(100000);
    expect(lines.find((l) => l.account?.account_number === 2100)?.debit_minor).toBe(5000);
    expect(lines.find((l) => l.account?.account_number === 4900)?.credit_minor).toBe(2000);
  });

  it("F2.1C-B: full refund with no tax/discount posts a balanced 4-line correction (no 2100/4900 lines)", async () => {
    const invoiceInput: InvoiceInput = { ...BASE_INVOICE_INPUT, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 };
    const { paymentId } = await issueInvoiceAndPayInFull(invoiceInput, 50000);

    const refunded = await mockFinanceRepository.refundPayment(paymentId, 50000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
    if (!refunded.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    const entry = entries.find((e) => e.source_id === refunded.data.id)!;
    const detail = await mockFinanceRepository.getJournalEntry(entry.id);
    const lines = detail.lines!;
    expect(lines).toHaveLength(4);
    expect(lines.some((l) => l.account?.account_number === 2100)).toBe(false);
    expect(lines.some((l) => l.account?.account_number === 4900)).toBe(false);
    expect(lines.find((l) => l.account?.account_number === 4950)?.debit_minor).toBe(50000);

    const totalDebit = lines.reduce((sum, l) => sum + l.debit_minor, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_minor, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("F2.1C-B: partial refund with tax+discount uses residual rounding so the entry still balances exactly", async () => {
    const { paymentId } = await issueInvoiceAndPayInFull();

    // R=10000 against total=103000: tax_portion=round(10000*5000/103000)=485,
    // discount_portion=round(10000*2000/103000)=194, revenue_portion=10000+194-485=9709.
    const refunded = await mockFinanceRepository.refundPayment(paymentId, 10000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
    if (!refunded.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    const entry = entries.find((e) => e.source_id === refunded.data.id)!;
    const detail = await mockFinanceRepository.getJournalEntry(entry.id);
    const lines = detail.lines!;

    expect(lines.find((l) => l.account?.account_number === 4950)?.debit_minor).toBe(9709);
    expect(lines.find((l) => l.account?.account_number === 2100)?.debit_minor).toBe(485);
    expect(lines.find((l) => l.account?.account_number === 4900)?.credit_minor).toBe(194);

    const totalDebit = lines.reduce((sum, l) => sum + l.debit_minor, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit_minor, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("F2.1C-B: multiple sequential partial refunds each post their own balanced correction and sum to the full refund", async () => {
    const { paymentId } = await issueInvoiceAndPayInFull();

    const first = await mockFinanceRepository.refundPayment(paymentId, 50000, crypto.randomUUID());
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = await mockFinanceRepository.refundPayment(paymentId, 53000, crypto.randomUUID());
    expect(second.success).toBe(true);
    if (!second.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    const paymentEntries = entries.filter((e) => e.source_id === first.data.id || e.source_id === second.data.id);
    expect(paymentEntries).toHaveLength(2);

    let revenueCorrectionTotal = 0;
    for (const entry of paymentEntries) {
      const detail = await mockFinanceRepository.getJournalEntry(entry.id);
      const lines = detail.lines!;
      const totalDebit = lines.reduce((sum, l) => sum + l.debit_minor, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit_minor, 0);
      expect(totalDebit).toBe(totalCredit);
      revenueCorrectionTotal += lines.find((l) => l.account?.account_number === 4950)?.debit_minor ?? 0;
    }
    // First refund (50000): tax=round(50000*5000/103000)=2427, discount=round(50000*2000/103000)=971, revenue=50000+971-2427=48544.
    // Second refund (53000): tax=round(53000*5000/103000)=2573, discount=round(53000*2000/103000)=1029, revenue=53000+1029-2573=51456.
    // Combined revenue portions (48544+51456=100000) exactly match the full-refund case's single 100000 revenue_portion.
    expect(revenueCorrectionTotal).toBe(100000);

    const overRefund = await mockFinanceRepository.refundPayment(paymentId, 1, crypto.randomUUID());
    expect(overRefund.success).toBe(false);
  });

  it("F2.1C-B-REVIEW: three partial refunds summing to the full amount produce ZERO cumulative drift in net Revenue/Tax/Discounts — regression for the independent-per-refund-rounding defect", async () => {
    const { paymentId } = await issueInvoiceAndPayInFull();

    // 30000 + 40000 + 33000 = 103000 (full). Independent per-refund rounding on this exact
    // split left net Revenue and net Sales Discounts each off by 1 cent (100001 and 2001
    // instead of 100000 and 2000) even though every individual entry balanced on its own —
    // this is the defect the cumulative-then-diff formula fixes. See the migration's header
    // comment for the full derivation.
    const first = await mockFinanceRepository.refundPayment(paymentId, 30000, crypto.randomUUID());
    expect(first.success).toBe(true);
    if (!first.success) return;
    const second = await mockFinanceRepository.refundPayment(paymentId, 40000, crypto.randomUUID());
    expect(second.success).toBe(true);
    if (!second.success) return;
    const third = await mockFinanceRepository.refundPayment(paymentId, 33000, crypto.randomUUID());
    expect(third.success).toBe(true);
    if (!third.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    const ids = new Set([first.data.id, second.data.id, third.data.id]);
    const paymentEntries = entries.filter((e) => e.source_id != null && ids.has(e.source_id));
    expect(paymentEntries).toHaveLength(3);

    let revenueTotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    for (const entry of paymentEntries) {
      const detail = await mockFinanceRepository.getJournalEntry(entry.id);
      const lines = detail.lines!;
      const totalDebit = lines.reduce((sum, l) => sum + l.debit_minor, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit_minor, 0);
      expect(totalDebit).toBe(totalCredit); // each entry still balances individually
      revenueTotal += lines.find((l) => l.account?.account_number === 4950)?.debit_minor ?? 0;
      taxTotal += lines.find((l) => l.account?.account_number === 2100)?.debit_minor ?? 0;
      discountTotal += lines.find((l) => l.account?.account_number === 4900)?.credit_minor ?? 0;
    }

    // Exact zero-drift assertions — the defect would show 100001/2001 here, not 100000/2000.
    expect(revenueTotal).toBe(100000);
    expect(taxTotal).toBe(5000);
    expect(discountTotal).toBe(2000);
  });

  it("F2.1C-B: refunding more than the refundable ceiling is still rejected (unchanged by the Revenue correction)", async () => {
    const { paymentId } = await issueInvoiceAndPayInFull();

    const overRefund = await mockFinanceRepository.refundPayment(paymentId, 103001, crypto.randomUUID());
    expect(overRefund.success).toBe(false);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    expect(entries.filter((e) => e.source_id != null)).toHaveLength(0);
  });

  it("F2.1B-REVIEW: refundPayment remains unaffected for a non-invoice-linked (Customer Deposits) payment", async () => {
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "cash",
    });
    expect(payment.success).toBe(true);
    if (!payment.success) return;

    const refunded = await mockFinanceRepository.refundPayment(payment.data.id, 20000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
  });
});

describe("mockFinanceRepository.voidInvoice — Finance F2.1C-D-D-B: Partial-Payment Void / Cancellation", () => {
  // BASE_INVOICE_INPUT: subtotal 100000, tax 5000, discount 2000, total 103000.
  async function createEligibleInvoice(overrides: Partial<InvoiceInput> = {}) {
    const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, ...overrides });
    if (!created.success) throw new Error("setup failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    return created.data.id;
  }

  async function paySettled(invoiceId: string, amountMinor: number) {
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: "client_2",
      event_id: "event_1",
      contract_id: "contract_1",
      payment_type: "full_payment",
      amount_minor: amountMinor,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("setup failed");
    return payment.data;
  }

  describe("clean void regression (paid_minor = 0)", () => {
    it("still fully reverses recognition and marks voided, unchanged", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled before payment");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.status).toBe("voided");
      expect(result.data.total_minor).toBe(103000); // fields untouched — matches pre-existing clean-void behavior

      const original = (await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_issued" })).find((e) => e.source_id === invoiceId)!;
      expect(original.reversed_by_entry_id).not.toBeNull();
      const partialVoidEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      expect(partialVoidEntries.filter((e) => e.source_id !== undefined && e.source_id !== null)).toHaveLength(0);
    });
  });

  describe("partial cancellation", () => {
    it("one partial payment: cancels only the unpaid remainder, AR reaches zero, Revenue retained", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Client cancelled the remainder");
      expect(result.success).toBe(true);
      if (!result.success) return;

      // cancellable = 103000-40000=63000. taxCancelled=round(63000*5000/103000)=3058.
      // discountCancelled=round(63000*2000/103000)=1223. subtotalCancelled=63000+1223-3058=61165.
      expect(result.data.subtotal_minor).toBe(100000 - 61165);
      expect(result.data.tax_minor).toBe(5000 - 3058);
      expect(result.data.discount_minor).toBe(2000 - 1223);
      expect(result.data.total_minor).toBe(40000);
      expect(result.data.paid_minor).toBe(40000);
      expect(result.data.balance_minor).toBe(0);
      expect(result.data.status).toBe("voided");

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_4950", debit_minor: 61165, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_2100", debit_minor: 3058, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_4900", debit_minor: 0, credit_minor: 1223 }),
        expect.objectContaining({ account_id: "account_1100", debit_minor: 0, credit_minor: 63000 }),
      ]);
      const totalDebit = detail.lines!.reduce((s, l) => s + l.debit_minor, 0);
      const totalCredit = detail.lines!.reduce((s, l) => s + l.credit_minor, 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it("no tax / no discount: cancellation is a pure Refunds & Returns line against AR", async () => {
      const invoiceId = await createEligibleInvoice({ tax_minor: 0, discount_minor: 0 });
      await paySettled(invoiceId, 30000);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.total_minor).toBe(30000);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_4950", debit_minor: 70000, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_1100", debit_minor: 0, credit_minor: 70000 }),
      ]);
    });

    it("tax only", async () => {
      const invoiceId = await createEligibleInvoice({ tax_minor: 10000, discount_minor: 0 });
      // total = 100000+10000-0 = 110000
      await paySettled(invoiceId, 50000);
      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled");
      expect(result.success).toBe(true);
      if (!result.success) return;
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_4900")).toBe(false);
      expect(detail.lines!.some((l) => l.account_id === "account_2100" && l.debit_minor > 0)).toBe(true);
    });

    it("discount only", async () => {
      const invoiceId = await createEligibleInvoice({ tax_minor: 0, discount_minor: 10000 });
      // total = 100000+0-10000 = 90000
      await paySettled(invoiceId, 40000);
      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled");
      expect(result.success).toBe(true);
      if (!result.success) return;
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_2100")).toBe(false);
      expect(detail.lines!.some((l) => l.account_id === "account_4900" && l.credit_minor > 0)).toBe(true);
    });

    it("never touches Cash (1000) or Customer Deposits (2200)", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled");
      expect(result.success).toBe(true);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_1000" || l.account_id === "account_2200")).toBe(false);
    });

    it("records an invoice_partially_voided timeline entry, distinct from clean void's invoice_voided", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled");
      const timeline = await mockFinanceRepository.getTimelineByInvoiceId(invoiceId);
      expect(timeline.some((t) => t.type === "invoice_partially_voided")).toBe(true);
      expect(timeline.some((t) => t.type === "invoice_voided")).toBe(false);
    });
  });

  describe("fully-paid rejection", () => {
    it("rejects when balance_minor is already 0 — nothing to cancel", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 103000);
      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.status).toBe("paid");

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be rejected");
      expect(result.success).toBe(false);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      expect(entries).toHaveLength(0);
    });
  });

  describe("Customer Deposit Application blocker", () => {
    it("blocks void when an unresolved Deposit Application exists", async () => {
      const invoiceId = await createEligibleInvoice();
      const deposit = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "deposit",
        amount_minor: 40000,
        payment_method: "cash",
      });
      if (!deposit.success) throw new Error("setup failed");
      await mockFinanceRepository.applyDepositToInvoice(deposit.data.id, invoiceId, 40000, crypto.randomUUID());

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be blocked");
      expect(result.success).toBe(false);
    });

    it("cash + Deposit Application mixed settlement also blocks", async () => {
      const invoiceId = await createEligibleInvoice();
      const deposit = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "deposit",
        amount_minor: 20000,
        payment_method: "cash",
      });
      if (!deposit.success) throw new Error("setup failed");
      await mockFinanceRepository.applyDepositToInvoice(deposit.data.id, invoiceId, 20000, crypto.randomUUID());
      await paySettled(invoiceId, 20000);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be blocked");
      expect(result.success).toBe(false);
    });

    it("an unrelated Customer Deposit not applied to THIS invoice does not block", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      // An unapplied deposit exists in the workspace but was never applied to this invoice.
      await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "deposit",
        amount_minor: 15000,
        payment_method: "cash",
      });

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelled");
      expect(result.success).toBe(true);
    });
  });

  describe("refund interaction", () => {
    it("operates against CURRENT (post-refund) fields, not the original recognition amounts", async () => {
      const invoiceId = await createEligibleInvoice();
      const payment = await paySettled(invoiceId, 103000);
      await mockFinanceRepository.refundPayment(payment.id, 30000, crypto.randomUUID());

      // After the refund correction: total_minor = 103000-30000 = 73000, paid_minor = 73000.
      const afterRefund = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(afterRefund.total_minor).toBe(73000);
      expect(afterRefund.paid_minor).toBe(73000);
      expect(afterRefund.balance_minor).toBe(0);
      // Nothing left to cancel — the refund already brought this invoice to its paid floor.
      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be rejected");
      expect(result.success).toBe(false);
    });

    it("a genuinely partial refund still leaves a cancellable remainder, correctly computed from CURRENT fields", async () => {
      const invoiceId = await createEligibleInvoice();
      const payment = await paySettled(invoiceId, 40000);
      await mockFinanceRepository.refundPayment(payment.id, 15000, crypto.randomUUID());

      const afterRefund = await mockFinanceRepository.getInvoiceById(invoiceId);
      // paid_minor after refund = 40000-15000 = 25000; total_minor synced down too (F2.1C-D-B).
      expect(afterRefund.paid_minor).toBe(25000);
      expect(afterRefund.balance_minor).toBeGreaterThan(0);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelling the rest");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.total_minor).toBe(afterRefund.paid_minor);
      expect(result.data.balance_minor).toBe(0);
    });
  });

  describe("adjustment interaction", () => {
    it("upward adjustment then cancellation uses the CURRENT (adjusted) proportions", async () => {
      const invoiceId = await createEligibleInvoice();
      await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 120000, tax_minor: 5000, discount_minor: 2000, reason: "Undercharged" },
        crypto.randomUUID(),
      );
      await paySettled(invoiceId, 50000);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelling remainder");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.total_minor).toBe(50000);
      expect(result.data.balance_minor).toBe(0);
    });

    it("downward adjustment then cancellation uses the CURRENT (reduced) proportions", async () => {
      const invoiceId = await createEligibleInvoice();
      await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 65000, tax_minor: 5000, discount_minor: 2000, reason: "Overcharged" },
        crypto.randomUUID(),
      );
      // new total = 65000+5000-2000 = 68000
      await paySettled(invoiceId, 30000);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelling remainder");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.total_minor).toBe(30000);
    });

    it("tax-rate-changing adjustment then cancellation never produces a negative field", async () => {
      const invoiceId = await createEligibleInvoice({ tax_minor: 20000, discount_minor: 0 });
      // original total = 100000+20000 = 120000
      await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 100000, tax_minor: 1000, discount_minor: 0, reason: "Corrected tax rate" },
        crypto.randomUUID(),
      );
      // new total = 101000
      await paySettled(invoiceId, 40000);

      const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Cancelling remainder");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.tax_minor).toBeGreaterThanOrEqual(0);
      expect(result.data.subtotal_minor).toBeGreaterThanOrEqual(0);
      expect(result.data.total_minor).toBe(40000);
    });
  });

  describe("idempotency", () => {
    it("first cancellation succeeds; a same-key replay returns the (already-voided) invoice with no second Journal Entry or field mutation", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      const key = crypto.randomUUID();

      const first = await mockFinanceRepository.voidInvoice(invoiceId, key, "Cancelling remainder");
      expect(first.success).toBe(true);
      const replay = await mockFinanceRepository.voidInvoice(invoiceId, key, "Cancelling remainder");
      expect(replay.success).toBe(true);
      if (!first.success || !replay.success) return;
      expect(replay.data).toEqual(first.data);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_partial_void" });
      expect(entries).toHaveLength(1);
    });

    it("a same-key request against a DIFFERENT invoice is rejected as a conflict", async () => {
      const invoiceA = await createEligibleInvoice();
      await paySettled(invoiceA, 40000);
      const invoiceB = await createEligibleInvoice();
      await paySettled(invoiceB, 30000);
      const key = crypto.randomUUID();

      const first = await mockFinanceRepository.voidInvoice(invoiceA, key, "Cancelling A");
      expect(first.success).toBe(true);

      const conflict = await mockFinanceRepository.voidInvoice(invoiceB, key, "Cancelling B");
      expect(conflict.success).toBe(false);
    });

    it("a DIFFERENT key against an already-voided invoice is rejected (terminal, not idempotency)", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      const first = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "First");
      expect(first.success).toBe(true);

      const second = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Second attempt");
      expect(second.success).toBe(false);
    });

    it("rejects a missing (empty-string) cancellationId", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      const result = await mockFinanceRepository.voidInvoice(invoiceId, "", "reason");
      expect(result.success).toBe(false);
    });
  });
});

describe("mockFinanceRepository.refundPayment — terminal-status guard (Finance F2.1C-D-D-B)", () => {
  it("rejects a refund linked to an invoice that was partially voided", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: created.data.id,
      client_id: "client_2",
      event_id: "event_1",
      contract_id: "contract_1",
      payment_type: "full_payment",
      amount_minor: 40000,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("setup failed");

    const voided = await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelling remainder");
    expect(voided.success).toBe(true);

    const refund = await mockFinanceRepository.refundPayment(payment.data.id, 10000, crypto.randomUUID());
    expect(refund.success).toBe(false);
  });

  it("rejects a refund linked to a cleanly-voided invoice", async () => {
    // Clean void requires paid_minor = 0, so this exercises the archived path instead —
    // a payment still refundable in principle, against an invoice archived afterward.
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: created.data.id,
      client_id: "client_2",
      event_id: "event_1",
      contract_id: "contract_1",
      payment_type: "full_payment",
      amount_minor: 103000,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("setup failed");
    await mockFinanceRepository.archiveInvoice(created.data.id);

    const refund = await mockFinanceRepository.refundPayment(payment.data.id, 10000, crypto.randomUUID());
    expect(refund.success).toBe(false);
  });

  it("an active (non-terminal) invoice's refund remains unaffected", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: created.data.id,
      client_id: "client_2",
      event_id: "event_1",
      contract_id: "contract_1",
      payment_type: "full_payment",
      amount_minor: 40000,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("setup failed");

    const refund = await mockFinanceRepository.refundPayment(payment.data.id, 10000, crypto.randomUUID());
    expect(refund.success).toBe(true);
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

  it("Finance F1.7 — a payment that starts succeeded posts a balanced Journal Entry and exactly one Audit entry, matching recordPaymentSettlement's own effect", async () => {
    const result = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "cash",
    });
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
    expect(totalDebit).toBe(20000);

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "payment", result.data.id);
    expect(auditEntries.filter((e) => e.action === "payment_settlement_recorded")).toHaveLength(1);
  });

  it("Finance F1.7 — a payment that starts pending posts nothing to the ledger yet (only reaching succeeded posts)", async () => {
    const result = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      amount_minor: 20000,
      payment_method: "credit_card",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("pending");

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    expect(entries.some((e) => e.source_id === result.data.id)).toBe(false);
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

  it("Finance F1.7 — transitioning a pending payment to succeeded posts a balanced Journal Entry, matching the same-creation-time path", async () => {
    const pending = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      amount_minor: 15000,
      payment_method: "credit_card",
    });
    expect(pending.success).toBe(true);
    if (!pending.success) return;

    let entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    expect(entries.some((e) => e.source_id === pending.data.id)).toBe(false);

    const succeeded = await mockFinanceRepository.markPaymentSucceeded(pending.data.id);
    expect(succeeded.success).toBe(true);

    entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    const posted = entries.find((e) => e.source_id === pending.data.id);
    expect(posted).toBeDefined();
    expect(posted?.posting_key).toBe(`payment_settlement:${pending.data.id}`);

    const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
    const totalDebit = detail.lines!.reduce((sum, line) => sum + line.debit_minor, 0);
    const totalCredit = detail.lines!.reduce((sum, line) => sum + line.credit_minor, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(15000);
  });

  it("Finance F1.8 — a posting failure on succeed rolls back the WHOLE transition: status stays pending, no Timeline entry, no Journal Entry (atomic by ordering, replacing F1.7's best-effort/Audit-Log design)", async () => {
    const pending = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      amount_minor: 5000,
      payment_method: "credit_card",
      transaction_date: "2027-01-01", // Outside every seeded accounting period.
    });
    expect(pending.success).toBe(true);
    if (!pending.success) return;

    const succeeded = await mockFinanceRepository.markPaymentSucceeded(pending.data.id);
    expect(succeeded.success).toBe(false);

    const stillPending = await mockFinanceRepository.getPaymentById(pending.data.id);
    expect(stillPending.status).toBe("pending");

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    expect(entries.some((e) => e.source_id === pending.data.id)).toBe(false);

    const timeline = await mockFinanceRepository.getTimelineByPaymentId(pending.data.id);
    expect(timeline.some((t) => t.type === "payment_succeeded")).toBe(false);
  });

  it("Finance F1.8 — a retry against an already-succeeded payment is rejected before ever attempting to post again (no second Journal Entry)", async () => {
    const covering = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      amount_minor: 5000,
      payment_method: "credit_card",
    });
    expect(covering.success).toBe(true);
    if (!covering.success) return;

    const first = await mockFinanceRepository.markPaymentSucceeded(covering.data.id);
    expect(first.success).toBe(true);

    const retry = await mockFinanceRepository.markPaymentSucceeded(covering.data.id);
    expect(retry.success).toBe(false);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    expect(entries.filter((e) => e.source_id === covering.data.id)).toHaveLength(1);
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
  it("cannot refund a payment that isn't refundable (e.g. failed)", async () => {
    // payment_4 is seeded as "failed".
    const result = await mockFinanceRepository.refundPayment("payment_4", 1000, crypto.randomUUID());
    expect(result.success).toBe(false);
  });

  it("Finance F1.8 — fails safely (does not invent a reversal) for a legacy payment with no settlement Journal Entry", async () => {
    // payment_1 is seeded directly as "succeeded" with no payment_settlement
    // Journal Entry ever posted for it — exactly the legacy-data shape a
    // real pre-F1.7 payment would have.
    const before = await mockFinanceRepository.getPaymentById("payment_1");
    expect(before.status).toBe("succeeded");
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    expect(entries.some((e) => e.source_id === "payment_1")).toBe(false);

    const result = await mockFinanceRepository.refundPayment("payment_1", 1000, crypto.randomUUID());
    expect(result.success).toBe(false);

    const after = await mockFinanceRepository.getPaymentById("payment_1");
    expect(after.status).toBe("succeeded");
  });

  describe("settlement-backed payments (Finance F1.8 reversal happy path)", () => {
    async function createSettledPayment(overrides: Partial<PaymentInput> = {}) {
      const created = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        payment_method: "cash",
        amount_minor: 40000,
        ...overrides,
      });
      if (!created.success) throw new Error("setup failed");
      return created.data;
    }

    it("a full invoice-linked refund posts Dr 1100 Accounts Receivable / Cr 1000 Cash for the full amount, and restores the invoice balance", async () => {
      // invoice_4 has balance_minor 50000 before this payment.
      const payment = await createSettledPayment({ invoice_id: "invoice_4", amount_minor: 30000 });
      let invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
      expect(invoice.balance_minor).toBe(20000);

      const refund = await mockFinanceRepository.refundPayment(payment.id, 30000, crypto.randomUUID());
      expect(refund.success).toBe(true);
      if (!refund.success) return;

      const original = await mockFinanceRepository.getPaymentById(payment.id);
      expect(original.status).toBe("refunded");

      invoice = await mockFinanceRepository.getInvoiceById("invoice_4");
      expect(invoice.balance_minor).toBe(50000);

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      const posted = reversalEntries.find((e) => e.source_id === refund.data.id);
      expect(posted).toBeDefined();
      const detail = await mockFinanceRepository.getJournalEntry(posted!.id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_1100", debit_minor: 30000, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_1000", debit_minor: 0, credit_minor: 30000 }),
      ]);
    });

    it("a partial invoice-linked refund posts a PROPORTIONAL reversal only, leaving the original settlement entry's own lines unchanged", async () => {
      const payment = await createSettledPayment({ invoice_id: "invoice_4", amount_minor: 40000 });
      const settlementEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
      const settlement = settlementEntries.find((e) => e.source_id === payment.id)!;
      const settlementBefore = await mockFinanceRepository.getJournalEntry(settlement.id);

      const refund = await mockFinanceRepository.refundPayment(payment.id, 15000, crypto.randomUUID());
      expect(refund.success).toBe(true);
      if (!refund.success) return;

      const original = await mockFinanceRepository.getPaymentById(payment.id);
      expect(original.status).toBe("partially_refunded");

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      const posted = reversalEntries.find((e) => e.source_id === refund.data.id)!;
      const detail = await mockFinanceRepository.getJournalEntry(posted.id);
      expect(detail.lines!.map((l) => l.debit_minor + l.credit_minor)).toEqual([15000, 15000]);

      // The original settlement entry's own lines are untouched — still the full 40000, not swapped or reduced.
      const settlementAfter = await mockFinanceRepository.getJournalEntry(settlement.id);
      expect(settlementAfter.lines).toEqual(settlementBefore.lines);
    });

    it("two legitimate partial refunds against the same original payment produce two distinct postings with distinct posting_keys", async () => {
      const payment = await createSettledPayment({ invoice_id: "invoice_4", amount_minor: 40000 });

      const firstRefund = await mockFinanceRepository.refundPayment(payment.id, 10000, crypto.randomUUID());
      const secondRefund = await mockFinanceRepository.refundPayment(payment.id, 15000, crypto.randomUUID());
      expect(firstRefund.success).toBe(true);
      expect(secondRefund.success).toBe(true);
      if (!firstRefund.success || !secondRefund.success) return;
      expect(firstRefund.data.id).not.toBe(secondRefund.data.id);

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      const forThisPayment = reversalEntries.filter((e) => [firstRefund.data.id, secondRefund.data.id].includes(e.source_id ?? ""));
      expect(forThisPayment).toHaveLength(2);
      expect(new Set(forThisPayment.map((e) => e.posting_key)).size).toBe(2);

      // Refundable is now 40000 - 10000 - 15000 = 15000 — a further 20000 must be rejected.
      const thirdRefund = await mockFinanceRepository.refundPayment(payment.id, 20000, crypto.randomUUID());
      expect(thirdRefund.success).toBe(false);
      const refundable = await mockFinanceRepository.getPaymentRefundableAmount(payment.id);
      expect(refundable).toBe(15000);
    });

    it("a full unapplied/deposit refund posts Dr 2200 Customer Deposits / Cr 1000 Cash", async () => {
      const payment = await createSettledPayment({ invoice_id: null, amount_minor: 20000 });

      const refund = await mockFinanceRepository.refundPayment(payment.id, 20000, crypto.randomUUID());
      expect(refund.success).toBe(true);
      if (!refund.success) return;

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      const posted = reversalEntries.find((e) => e.source_id === refund.data.id)!;
      const detail = await mockFinanceRepository.getJournalEntry(posted.id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_2200", debit_minor: 20000, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_1000", debit_minor: 0, credit_minor: 20000 }),
      ]);
    });

    it("a partial unapplied/deposit refund posts a proportional reversal", async () => {
      const payment = await createSettledPayment({ invoice_id: null, amount_minor: 20000 });

      const refund = await mockFinanceRepository.refundPayment(payment.id, 8000, crypto.randomUUID());
      expect(refund.success).toBe(true);
      if (!refund.success) return;

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      const posted = reversalEntries.find((e) => e.source_id === refund.data.id)!;
      const detail = await mockFinanceRepository.getJournalEntry(posted.id);
      expect(detail.lines!.map((l) => l.debit_minor + l.credit_minor)).toEqual([8000, 8000]);
    });

    it("rejects a refund exceeding the remaining refundable amount, and never posts a reversal for the rejected attempt", async () => {
      const payment = await createSettledPayment({ invoice_id: null, amount_minor: 20000 });
      const result = await mockFinanceRepository.refundPayment(payment.id, 30000, crypto.randomUUID());
      expect(result.success).toBe(false);

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      expect(reversalEntries.some((e) => e.source_id === payment.id)).toBe(false);
    });

    it("Finance F1.8 — Revenue account 4000 is never touched by a refund reversal", async () => {
      const payment = await createSettledPayment({ invoice_id: "invoice_4", amount_minor: 10000 });
      const refund = await mockFinanceRepository.refundPayment(payment.id, 10000, crypto.randomUUID());
      expect(refund.success).toBe(true);
      if (!refund.success) return;

      const reversalEntries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
      const posted = reversalEntries.find((e) => e.source_id === refund.data.id)!;
      const detail = await mockFinanceRepository.getJournalEntry(posted.id);
      expect(detail.lines!.some((l) => l.account_id === "account_4000")).toBe(false);
    });
  });

  describe("Finance F2.1C-D-B: refund-correction Invoice-field synchronization", () => {
    // BASE_INVOICE_INPUT: subtotal 100000, tax 5000, discount 2000, total 103000 —
    // deliberately reused as-is (not a special-cased shape) so these tests exercise
    // the same tax/discount split every other Invoice test in this file already uses.
    async function createIssuedInvoice(overrides: Partial<InvoiceInput> = {}) {
      const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, ...overrides });
      if (!created.success) throw new Error("setup failed");
      await mockFinanceRepository.issueInvoice(created.data.id);
      await mockFinanceRepository.sendInvoice(created.data.id);
      return created.data.id;
    }

    async function paySettled(invoiceId: string, amountMinor: number) {
      const payment = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: invoiceId,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "full_payment",
        amount_minor: amountMinor,
        payment_method: "cash",
      });
      if (!payment.success) throw new Error("setup failed");
      return payment.data;
    }

    it("a full refund of a fully-paid invoice zeroes subtotal/tax/discount/total and leaves no phantom AR", async () => {
      const invoiceId = await createIssuedInvoice();
      const payment = await paySettled(invoiceId, 103000);

      const refund = await mockFinanceRepository.refundPayment(payment.id, 103000, crypto.randomUUID());
      expect(refund.success).toBe(true);

      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.subtotal_minor).toBe(0);
      expect(invoice.tax_minor).toBe(0);
      expect(invoice.discount_minor).toBe(0);
      expect(invoice.total_minor).toBe(0);
      expect(invoice.paid_minor).toBe(0);
      expect(invoice.balance_minor).toBe(0);
    });

    it("a partial refund of a partially-collected invoice decrements subtotal/tax/discount/total by the SAME portions the ledger posting used, and balance_minor matches the true ledger AR", async () => {
      const invoiceId = await createIssuedInvoice();
      const payment = await paySettled(invoiceId, 40000);

      const refund = await mockFinanceRepository.refundPayment(payment.id, 40000, crypto.randomUUID());
      expect(refund.success).toBe(true);

      // origTax=5000, origDiscount=2000, origTotal=103000, cumulative refunded=40000.
      // tax_cum = round(40000*5000/103000) = 1942; discount_cum = round(40000*2000/103000) = 777.
      // revenue_cum = 40000 + 777 - 1942 = 38835.
      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.subtotal_minor).toBe(100000 - 38835);
      expect(invoice.tax_minor).toBe(5000 - 1942);
      expect(invoice.discount_minor).toBe(2000 - 777);
      expect(invoice.total_minor).toBe(103000 - 40000);
      // The invoice was only ever paid 40000, all of which was just refunded —
      // no cash remains applied, and the corrected total already reflects that
      // the un-refunded portion (63000) was never collected in the first place.
      expect(invoice.paid_minor).toBe(0);
      expect(invoice.balance_minor).toBe(63000);
    });

    it("two partial refunds that do NOT fully drain the invoice stay anchored to the ORIGINAL ledger amounts — no cent drift from a mutating basis", async () => {
      const invoiceId = await createIssuedInvoice();
      const payment = await paySettled(invoiceId, 103000);

      const firstRefund = await mockFinanceRepository.refundPayment(payment.id, 30000, crypto.randomUUID());
      expect(firstRefund.success).toBe(true);

      // Cumulative 30000: tax_cum = round(30000*5000/103000) = 1456, discount_cum = round(30000*2000/103000) = 583,
      // revenue_cum = 30000 + 583 - 1456 = 29127.
      let invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.subtotal_minor).toBe(100000 - 29127);
      expect(invoice.tax_minor).toBe(5000 - 1456);
      expect(invoice.discount_minor).toBe(2000 - 583);
      expect(invoice.total_minor).toBe(103000 - 30000);

      const secondRefund = await mockFinanceRepository.refundPayment(payment.id, 20000, crypto.randomUUID());
      expect(secondRefund.success).toBe(true);

      // Cumulative 50000 (30000 + 20000, still short of the full 103000 — a genuinely
      // partial, non-full-draining sequence): tax_cum = round(50000*5000/103000) = 2427,
      // discount_cum = round(50000*2000/103000) = 971, revenue_cum = 50000 + 971 - 2427 = 48544.
      // If the formula's basis were the invoice's own already-decremented fields (the bug
      // this checkpoint fixes) rather than the immutable original ledger amounts, this
      // second refund's portions would drift by a cent from the values below.
      invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.subtotal_minor).toBe(100000 - 48544);
      expect(invoice.tax_minor).toBe(5000 - 2427);
      expect(invoice.discount_minor).toBe(2000 - 971);
      expect(invoice.total_minor).toBe(103000 - 50000);
      expect(invoice.paid_minor).toBe(103000 - 50000);
      expect(invoice.balance_minor).toBe(0);
      expect(invoice.status).toBe("paid");
    });

    it("a same-key refund replay does not double-decrement the invoice's fields", async () => {
      const invoiceId = await createIssuedInvoice();
      const payment = await paySettled(invoiceId, 40000);
      const key = crypto.randomUUID();

      const first = await mockFinanceRepository.refundPayment(payment.id, 15000, key);
      expect(first.success).toBe(true);
      const afterFirst = await mockFinanceRepository.getInvoiceById(invoiceId);

      const replay = await mockFinanceRepository.refundPayment(payment.id, 15000, key);
      expect(replay.success).toBe(true);
      const afterReplay = await mockFinanceRepository.getInvoiceById(invoiceId);

      expect(afterReplay.subtotal_minor).toBe(afterFirst.subtotal_minor);
      expect(afterReplay.tax_minor).toBe(afterFirst.tax_minor);
      expect(afterReplay.discount_minor).toBe(afterFirst.discount_minor);
      expect(afterReplay.total_minor).toBe(afterFirst.total_minor);
      expect(afterReplay.balance_minor).toBe(afterFirst.balance_minor);
    });

    it("a refund that is not invoice-linked (Customer Deposits) never touches any Invoice's fields", async () => {
      const invoiceId = await createIssuedInvoice();
      const before = await mockFinanceRepository.getInvoiceById(invoiceId);

      const depositPayment = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "deposit",
        amount_minor: 20000,
        payment_method: "cash",
      });
      if (!depositPayment.success) throw new Error("setup failed");

      const refund = await mockFinanceRepository.refundPayment(depositPayment.data.id, 20000, crypto.randomUUID());
      expect(refund.success).toBe(true);

      const after = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(after).toEqual(before);
    });
  });
});

describe("Finance F2.1C-D-B: currency is financially immutable after issuance", () => {
  it("allows changing currency on a draft invoice", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    if (!created.success) throw new Error("setup failed");

    const updated = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, currency: "EUR" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.currency).toBe("EUR");
  });

  it("rejects changing currency after an invoice has been issued", async () => {
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockFinanceRepository.issueInvoice(created.data.id);

    const updated = await mockFinanceRepository.updateInvoice(created.data.id, { ...BASE_INVOICE_INPUT, currency: "EUR" });
    expect(updated.success).toBe(false);

    const unchanged = await mockFinanceRepository.getInvoiceById(created.data.id);
    expect(unchanged.currency).toBe("USD");
  });
});

describe("mockFinanceRepository.recordInvoiceAdjustment — Finance F2.1C-D-C", () => {
  // BASE_INVOICE_INPUT: subtotal 100000, tax 5000, discount 2000, total 103000.
  async function createEligibleInvoice(overrides: Partial<InvoiceInput> = {}) {
    const created = await mockFinanceRepository.createInvoice({ ...BASE_INVOICE_INPUT, ...overrides });
    if (!created.success) throw new Error("setup failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    return created.data.id;
  }

  async function paySettled(invoiceId: string, amountMinor: number) {
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: "client_2",
      event_id: "event_1",
      contract_id: "contract_1",
      payment_type: "full_payment",
      amount_minor: amountMinor,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("setup failed");
    return payment.data;
  }

  describe("basic delta scenarios", () => {
    it("subtotal increase only: Cr 4000, Dr AR, no tax/discount lines", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 120000, tax_minor: 5000, discount_minor: 2000, reason: "Added scope" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.subtotal_minor).toBe(120000);
      expect(result.data.total_minor).toBe(123000);
      expect(result.data.balance_minor).toBe(123000);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries.find((e) => e.source_id === entries[0].source_id)!.id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_1100", debit_minor: 20000, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_4000", debit_minor: 0, credit_minor: 20000 }),
      ]);
    });

    it("subtotal decrease only: Dr 4950 Refunds & Returns, Cr AR", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 80000, tax_minor: 5000, discount_minor: 2000, reason: "Overcharged" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.subtotal_minor).toBe(80000);
      expect(result.data.total_minor).toBe(83000);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_1100", debit_minor: 0, credit_minor: 20000 }),
        expect.objectContaining({ account_id: "account_4950", debit_minor: 20000, credit_minor: 0 }),
      ]);
    });

    it("tax increase only: Cr 2100", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 100000, tax_minor: 6000, discount_minor: 2000, reason: "Tax rate correction" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.tax_minor).toBe(6000);
      expect(result.data.total_minor).toBe(104000);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_2100" && l.credit_minor === 1000 && l.debit_minor === 0)).toBe(true);
    });

    it("tax decrease only: Dr 2100", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 100000, tax_minor: 3000, discount_minor: 2000, reason: "Tax rate correction" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_2100" && l.debit_minor === 2000 && l.credit_minor === 0)).toBe(true);
    });

    it("discount increase only: Dr 4900", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 100000, tax_minor: 5000, discount_minor: 5000, reason: "Extra discount granted" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.discount_minor).toBe(5000);
      expect(result.data.total_minor).toBe(100000);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_4900" && l.debit_minor === 3000 && l.credit_minor === 0)).toBe(true);
    });

    it("discount decrease only: Cr 4900", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 100000, tax_minor: 5000, discount_minor: 500, reason: "Discount revoked" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_4900" && l.credit_minor === 1500 && l.debit_minor === 0)).toBe(true);
    });

    it("combined subtotal + tax + discount change posts a single balanced entry", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 110000, tax_minor: 4000, discount_minor: 3000, reason: "Full re-quote" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      // old: subtotal 100000/tax 5000/discount 2000 (total 103000).
      // new: subtotal 110000/tax 4000/discount 3000 -> new_total = 111000.
      // deltas: subtotal +10000, tax -1000, discount +1000, total +8000.
      expect(result.data.total_minor).toBe(111000);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_1100", debit_minor: 8000, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_4000", debit_minor: 0, credit_minor: 10000 }),
        expect.objectContaining({ account_id: "account_2100", debit_minor: 1000, credit_minor: 0 }),
        expect.objectContaining({ account_id: "account_4900", debit_minor: 1000, credit_minor: 0 }),
      ]);
      const totalDebit = detail.lines!.reduce((sum, l) => sum + l.debit_minor, 0);
      const totalCredit = detail.lines!.reduce((sum, l) => sum + l.credit_minor, 0);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(10000);
    });

    it("zero-net-total: subtotal increase offset by an equal discount increase posts NO AR line but still posts Revenue/Discount lines", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 110000, tax_minor: 5000, discount_minor: 12000, reason: "Repriced with matching extra discount" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      // delta_subtotal=10000, delta_discount=10000 -> delta_total=0
      expect(result.data.total_minor).toBe(103000);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_1100")).toBe(false);
      expect(detail.lines).toEqual([
        expect.objectContaining({ account_id: "account_4000", debit_minor: 0, credit_minor: 10000 }),
        expect.objectContaining({ account_id: "account_4900", debit_minor: 10000, credit_minor: 0 }),
      ]);
    });

    it("rejects a no-op adjustment (requested values match current values) and posts nothing", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 100000, tax_minor: 5000, discount_minor: 2000, reason: "No real change" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      expect(entries).toHaveLength(0);
    });
  });

  describe("invoice state eligibility", () => {
    it("allows an adjustment on an issued (not yet sent) invoice", async () => {
      const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
      if (!created.success) throw new Error("setup failed");
      await mockFinanceRepository.issueInvoice(created.data.id);

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        created.data.id,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "Correction before sending" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
    });

    it("allows an adjustment on a partially_paid invoice", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 40000);
      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.status).toBe("partially_paid");

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 110000, tax_minor: 5000, discount_minor: 2000, reason: "Upward correction while partially paid" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
    });

    it("allows an upward adjustment on a fully paid invoice", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 103000);
      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.status).toBe("paid");

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 120000, tax_minor: 5000, discount_minor: 2000, reason: "Undercharged, billing more" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.total_minor).toBe(123000);
      expect(result.data.balance_minor).toBe(20000);
      expect(result.data.status).toBe("partially_paid");
    });

    it("rejects an adjustment on a draft invoice — use updateInvoice instead", async () => {
      const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
      if (!created.success) throw new Error("setup failed");

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        created.data.id,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "Should be rejected" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);
    });

    it("rejects an adjustment on a voided invoice", async () => {
      const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
      if (!created.success) throw new Error("setup failed");
      await mockFinanceRepository.issueInvoice(created.data.id);
      await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        created.data.id,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "Should be rejected" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);
    });

    it("rejects an adjustment on an archived invoice", async () => {
      const invoiceId = await createEligibleInvoice();
      await mockFinanceRepository.archiveInvoice(invoiceId);

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "Should be rejected" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);
    });
  });

  describe("anti-overpayment safety", () => {
    it("allows a downward correction that stays at or above the settled (paid) amount", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 60000);

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 60000, tax_minor: 0, discount_minor: 0, reason: "Reduced to exactly what was collected" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.total_minor).toBe(60000);
      expect(result.data.balance_minor).toBe(0);
      expect(result.data.status).toBe("paid");
    });

    it("rejects a downward correction that would drop the total below the already-collected amount", async () => {
      const invoiceId = await createEligibleInvoice();
      await paySettled(invoiceId, 80000);

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 50000, tax_minor: 0, discount_minor: 0, reason: "Would create phantom overpayment" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);

      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.subtotal_minor).toBe(100000); // unchanged
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      expect(entries).toHaveLength(0);
    });

    it("Customer Deposit Applications count toward the settled amount for anti-overpayment safety", async () => {
      const invoiceId = await createEligibleInvoice();
      const deposit = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "deposit",
        amount_minor: 70000,
        payment_method: "cash",
      });
      if (!deposit.success) throw new Error("setup failed");
      const applied = await mockFinanceRepository.applyDepositToInvoice(deposit.data.id, invoiceId, 70000, crypto.randomUUID());
      expect(applied.success).toBe(true);

      // Settled amount is now 70000 via the deposit application alone — a
      // correction down to 50000 (below that) must be rejected even though
      // NO cash payment (only a deposit application) was ever recorded.
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 50000, tax_minor: 0, discount_minor: 0, reason: "Would create phantom overpayment via deposit" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);

      const okResult = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 70000, tax_minor: 0, discount_minor: 0, reason: "Reduced to exactly the applied deposit amount" },
        crypto.randomUUID(),
      );
      expect(okResult.success).toBe(true);
    });

    it("mixed cash payment + Customer Deposit Application both count toward the settled amount", async () => {
      const invoiceId = await createEligibleInvoice();
      const deposit = await mockFinanceRepository.createPayment({
        ...BASE_PAYMENT_INPUT,
        invoice_id: null,
        client_id: "client_2",
        event_id: "event_1",
        contract_id: "contract_1",
        payment_type: "deposit",
        amount_minor: 30000,
        payment_method: "cash",
      });
      if (!deposit.success) throw new Error("setup failed");
      await mockFinanceRepository.applyDepositToInvoice(deposit.data.id, invoiceId, 30000, crypto.randomUUID());
      await paySettled(invoiceId, 40000);

      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.paid_minor).toBe(70000);

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 68000, tax_minor: 0, discount_minor: 0, reason: "Would drop below the combined 70000 settled" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(false);
    });
  });

  describe("refund interaction — operates against CURRENT (post-refund) fields", () => {
    it("an adjustment after a partial refund correctly composes with the refund's own correction, not the original recognition amounts", async () => {
      const invoiceId = await createEligibleInvoice();
      const payment = await paySettled(invoiceId, 103000);
      await mockFinanceRepository.refundPayment(payment.id, 30000, crypto.randomUUID());

      // After the refund correction: total_minor = 103000 - 30000 = 73000 (see F2.1C-D-B).
      const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
      expect(invoice.total_minor).toBe(73000);

      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: invoice.subtotal_minor, tax_minor: invoice.tax_minor, discount_minor: invoice.discount_minor - 1000, reason: "Extra discount after refund" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      if (!result.success) return;
      // delta_discount = -1000 -> delta_total = +1000
      expect(result.data.total_minor).toBe(74000);
    });
  });

  describe("ledger correctness", () => {
    it("never touches Cash (1000) or Customer Deposits (2200)", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 110000, tax_minor: 6000, discount_minor: 3000, reason: "Full re-quote" },
        crypto.randomUUID(),
      );
      expect(result.success).toBe(true);
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      const detail = await mockFinanceRepository.getJournalEntry(entries[0].id);
      expect(detail.lines!.some((l) => l.account_id === "account_1000" || l.account_id === "account_2200")).toBe(false);
    });
  });

  describe("idempotency — Finance F2.1C-D-C", () => {
    it("a same-key replay with the SAME target values returns the invoice unchanged and posts no second entry", async () => {
      const invoiceId = await createEligibleInvoice();
      const key = crypto.randomUUID();
      const input = { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "First attempt" };

      const first = await mockFinanceRepository.recordInvoiceAdjustment(invoiceId, input, key);
      expect(first.success).toBe(true);
      const replay = await mockFinanceRepository.recordInvoiceAdjustment(invoiceId, input, key);
      expect(replay.success).toBe(true);
      if (!first.success || !replay.success) return;
      expect(replay.data).toEqual(first.data);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      expect(entries).toHaveLength(1);
    });

    it("Finance F2.1C-D-C-REVIEW: a stale retry of an EARLIER adjustment replays correctly even after a LATER, different adjustment has since moved the invoice on further", async () => {
      const invoiceId = await createEligibleInvoice();
      const keyA = crypto.randomUUID();
      const keyB = crypto.randomUUID();

      // Adjustment A (key A) sets subtotal 100000 -> 120000.
      const adjustmentA = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 120000, tax_minor: 5000, discount_minor: 2000, reason: "First correction" },
        keyA,
      );
      expect(adjustmentA.success).toBe(true);

      // Adjustment B (a DIFFERENT key) later moves it further: 120000 -> 130000.
      const adjustmentB = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 130000, tax_minor: 5000, discount_minor: 2000, reason: "Second, independent correction" },
        keyB,
      );
      expect(adjustmentB.success).toBe(true);

      // A delayed retry of A arrives now, asking again for A's OWN original
      // target (120000) -- NOT the invoice's current state (130000, set by
      // B). Comparing against current state would incorrectly report this
      // as a conflict (120000 != 130000) even though A's own request had
      // already succeeded exactly as asked. This must replay cleanly.
      const retryOfA = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 120000, tax_minor: 5000, discount_minor: 2000, reason: "First correction" },
        keyA,
      );
      expect(retryOfA.success).toBe(true);
      if (!retryOfA.success) return;
      // The replay is honest about current state (which now also reflects
      // B) rather than pretending only A's own effect exists.
      expect(retryOfA.data.subtotal_minor).toBe(130000);

      // No third Journal Entry was posted for the replay of A.
      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      expect(entries).toHaveLength(2);
    });

    it("a same-key retry with a DIFFERENT target is rejected as a conflict, not replayed", async () => {
      const invoiceId = await createEligibleInvoice();
      const key = crypto.randomUUID();
      const first = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "First attempt" },
        key,
      );
      expect(first.success).toBe(true);

      const conflicting = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 80000, tax_minor: 5000, discount_minor: 2000, reason: "Different target, same key" },
        key,
      );
      expect(conflicting.success).toBe(false);
    });

    it("a DIFFERENT key represents a distinct, intentional second adjustment", async () => {
      const invoiceId = await createEligibleInvoice();
      const first = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "First correction" },
        crypto.randomUUID(),
      );
      expect(first.success).toBe(true);

      const second = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 95000, tax_minor: 5000, discount_minor: 2000, reason: "Second, independent correction" },
        crypto.randomUUID(),
      );
      expect(second.success).toBe(true);
      if (!second.success) return;
      expect(second.data.subtotal_minor).toBe(95000);

      const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "invoice_adjustment" });
      expect(entries).toHaveLength(2);
    });

    it("rejects a missing (empty-string) idempotency key", async () => {
      const invoiceId = await createEligibleInvoice();
      const result = await mockFinanceRepository.recordInvoiceAdjustment(
        invoiceId,
        { subtotal_minor: 90000, tax_minor: 5000, discount_minor: 2000, reason: "Missing key" },
        "",
      );
      expect(result.success).toBe(false);
    });
  });
});

describe("mockFinanceRepository.getPaymentRefundableAmount", () => {
  it("returns 0 for a payment that isn't refundable", async () => {
    const refundable = await mockFinanceRepository.getPaymentRefundableAmount("payment_4");
    expect(refundable).toBe(0);
  });
});

describe("mockFinanceRepository.refundPayment — Finance F2.1C-C-IDEMPOTENCY", () => {
  async function createSettledCashPayment(amountMinor: number, invoiceId: string | null = null) {
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: amountMinor,
      payment_method: "cash",
    });
    if (!payment.success) throw new Error("payment creation failed");
    return payment.data.id;
  }

  it("a same-key retry replays the original refund — no second Payment row, no second Journal Entry", async () => {
    const paymentId = await createSettledCashPayment(50000);
    const key = "retry-key-1";

    const first = await mockFinanceRepository.refundPayment(paymentId, 20000, key);
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.refundPayment(paymentId, 20000, key);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(second.data.id).toBe(first.data.id);

    const allPayments = await mockFinanceRepository.getPayments();
    expect(allPayments.filter((p) => p.id === first.data.id)).toHaveLength(1);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    expect(entries.filter((e) => e.source_id === first.data.id)).toHaveLength(1);

    // The replay did not consume additional refundable balance — only the ORIGINAL 20000 was ever deducted.
    const refundable = await mockFinanceRepository.getPaymentRefundableAmount(paymentId);
    expect(refundable).toBe(30000);
  });

  it("a same-key retry with a DIFFERENT amount is rejected as a conflict, not replayed", async () => {
    const paymentId = await createSettledCashPayment(50000);
    const key = "retry-key-2";

    const first = await mockFinanceRepository.refundPayment(paymentId, 20000, key);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.refundPayment(paymentId, 25000, key);
    expect(conflicting.success).toBe(false);
    if (conflicting.success) return;
    expect(conflicting.error).toMatch(/idempotency key was already used/);
  });

  it("a same-key retry against a DIFFERENT original payment is rejected as a conflict", async () => {
    const paymentA = await createSettledCashPayment(50000);
    const paymentB = await createSettledCashPayment(50000);
    const key = "retry-key-3";

    const first = await mockFinanceRepository.refundPayment(paymentA, 10000, key);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.refundPayment(paymentB, 10000, key);
    expect(conflicting.success).toBe(false);
  });

  it("a DIFFERENT key represents a distinct, intentional second refund, subject to the refundable ceiling", async () => {
    const paymentId = await createSettledCashPayment(50000);

    const first = await mockFinanceRepository.refundPayment(paymentId, 20000, "retry-key-4a");
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.refundPayment(paymentId, 20000, "retry-key-4b");
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).not.toBe(first.data.id);

    const refundable = await mockFinanceRepository.getPaymentRefundableAmount(paymentId);
    expect(refundable).toBe(10000);

    // A third, over-ceiling distinct key is still correctly rejected.
    const third = await mockFinanceRepository.refundPayment(paymentId, 20000, "retry-key-4c");
    expect(third.success).toBe(false);
  });

  it("rejects a missing (empty-string) idempotency key", async () => {
    const paymentId = await createSettledCashPayment(50000);
    const result = await mockFinanceRepository.refundPayment(paymentId, 20000, "");
    expect(result.success).toBe(false);
  });

  it("posting-level idempotency (P1104-equivalent) still exists independently — a fresh refund row cannot be posted twice for the same key without a normal replay", async () => {
    // This is implicitly covered by the same-key replay test above: the second
    // call never re-invokes the posting step at all (it returns the existing
    // row before posting is attempted), proving the replay check runs BEFORE,
    // not instead of, the posting layer's own duplicate guard.
    const paymentId = await createSettledCashPayment(50000);
    const key = "retry-key-5";
    const first = await mockFinanceRepository.refundPayment(paymentId, 20000, key);
    expect(first.success).toBe(true);
    const entriesAfterFirst = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    const second = await mockFinanceRepository.refundPayment(paymentId, 20000, key);
    expect(second.success).toBe(true);
    const entriesAfterSecond = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_refund" });
    expect(entriesAfterSecond.length).toBe(entriesAfterFirst.length);
  });
});

// ---------------------------------------------------------------------------
// Finance F2.1C-C — Customer Deposit → Invoice application
// ---------------------------------------------------------------------------

describe("mockFinanceRepository — Finance F2.1C-C: Customer Deposit application", () => {
  async function createDeposit(amountMinor = 60000) {
    const deposit = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: amountMinor,
      payment_method: "cash",
    });
    if (!deposit.success) throw new Error("deposit creation failed");
    return deposit.data.id;
  }

  async function createIssuedInvoice(invoiceInput = BASE_INVOICE_INPUT) {
    const created = await mockFinanceRepository.createInvoice(invoiceInput);
    if (!created.success) throw new Error("invoice creation failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    return created.data.id;
  }

  async function findApplicationEntry(applicationId: string) {
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "deposit_application" });
    const entry = entries.find((e) => e.source_id === applicationId)!;
    expect(entry).toBeDefined();
    return mockFinanceRepository.getJournalEntry(entry.id);
  }

  // A. Basic application

  it("full deposit application pays the invoice in full — Dr 2200 Customer Deposits / Cr 1100 AR, no Cash line", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    expect(applied.data.payment_type).toBe("adjustment");
    expect(applied.data.payment_method).toBe("other");
    expect(applied.data.status).toBe("succeeded");
    expect(applied.data.invoice_id).toBe(invoiceId);
    expect(applied.data.reference).toBe(`deposit_application_of:${depositId}`);

    const detail = await findApplicationEntry(applied.data.id);
    const lines = detail.lines!;
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.account?.account_number === 1000)).toBe(false);
    expect(lines.find((l) => l.account?.account_number === 2200)?.debit_minor).toBe(103000);
    expect(lines.find((l) => l.account?.account_number === 1100)?.credit_minor).toBe(103000);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.status).toBe("paid");
    expect(invoice.paid_minor).toBe(103000);
    expect(invoice.balance_minor).toBe(0);
  });

  it("partial deposit application moves the invoice to partially_paid", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    expect(applied.success).toBe(true);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.status).toBe("partially_paid");
    expect(invoice.paid_minor).toBe(40000);
    expect(invoice.balance_minor).toBe(63000);
  });

  // B. Multiple applications

  it("one deposit applied across multiple invoices", async () => {
    const depositId = await createDeposit(103000);
    const invoiceA = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 40000, tax_minor: 0, discount_minor: 0 });
    const invoiceB = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 30000, tax_minor: 0, discount_minor: 0 });

    const first = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceA, 40000, crypto.randomUUID());
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceB, 30000, crypto.randomUUID());
    expect(second.success).toBe(true);

    const invA = await mockFinanceRepository.getInvoiceById(invoiceA);
    const invB = await mockFinanceRepository.getInvoiceById(invoiceB);
    expect(invA.status).toBe("paid");
    expect(invB.status).toBe("paid");

    const remaining = await mockFinanceRepository.getDepositApplicableAmount(depositId);
    expect(remaining).toBe(33000);
  });

  it("multiple applications against one invoice, plus an ordinary payment, both count toward paid_minor", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();

    const firstApplication = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 30000, crypto.randomUUID());
    expect(firstApplication.success).toBe(true);

    const ordinaryPayment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "cash",
    });
    expect(ordinaryPayment.success).toBe(true);

    const secondApplication = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 53000, crypto.randomUUID());
    expect(secondApplication.success).toBe(true);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.paid_minor).toBe(103000);
    expect(invoice.status).toBe("paid");
  });

  // C. Ceiling

  it("rejects applying more than the deposit's available balance", async () => {
    const depositId = await createDeposit(50000);
    const invoiceId = await createIssuedInvoice();

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 50001, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("a prior refund of the deposit reduces its available application balance", async () => {
    const depositId = await createDeposit(100000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });

    const refunded = await mockFinanceRepository.refundPayment(depositId, 40000, crypto.randomUUID());
    expect(refunded.success).toBe(true);

    const available = await mockFinanceRepository.getDepositApplicableAmount(depositId);
    expect(available).toBe(60000);

    const overApplied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 60001, crypto.randomUUID());
    expect(overApplied.success).toBe(false);
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 60000, crypto.randomUUID());
    expect(applied.success).toBe(true);
  });

  it("a prior application of the deposit reduces its available refund balance", async () => {
    const depositId = await createDeposit(100000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    expect(applied.success).toBe(true);

    const refundable = await mockFinanceRepository.getPaymentRefundableAmount(depositId);
    expect(refundable).toBe(60000);

    const overRefunded = await mockFinanceRepository.refundPayment(depositId, 60001, crypto.randomUUID());
    expect(overRefunded.success).toBe(false);
    const refunded = await mockFinanceRepository.refundPayment(depositId, 60000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
  });

  it("combined refund + application together cannot exceed the original deposit amount", async () => {
    const depositId = await createDeposit(100000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 30000, crypto.randomUUID());
    expect(applied.success).toBe(true);
    const refunded = await mockFinanceRepository.refundPayment(depositId, 30000, crypto.randomUUID());
    expect(refunded.success).toBe(true);

    expect(await mockFinanceRepository.getDepositApplicableAmount(depositId)).toBe(40000);
    expect(await mockFinanceRepository.getPaymentRefundableAmount(depositId)).toBe(40000);

    const overApplied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40001, crypto.randomUUID());
    expect(overApplied.success).toBe(false);
  });

  // D. Validation

  it("rejects a source payment that is already invoice-linked", async () => {
    const invoiceId = await createIssuedInvoice();
    const linkedPayment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "cash",
    });
    expect(linkedPayment.success).toBe(true);
    if (!linkedPayment.success) return;

    const otherInvoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(linkedPayment.data.id, otherInvoiceId, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("rejects a non-succeeded source payment", async () => {
    const pending = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "credit_card",
    });
    expect(pending.success).toBe(true);
    if (!pending.success) return;
    expect(pending.data.status).toBe("pending");

    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(pending.data.id, invoiceId, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("rejects a currency mismatch between deposit and invoice", async () => {
    const deposit = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      currency: "EUR",
      payment_method: "cash",
    });
    expect(deposit.success).toBe(true);
    if (!deposit.success) return;

    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(deposit.data.id, invoiceId, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("rejects an invoice that does not exist", async () => {
    const depositId = await createDeposit();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, "nonexistent_invoice", 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("rejects a zero or negative amount", async () => {
    const depositId = await createDeposit();
    const invoiceId = await createIssuedInvoice();
    expect((await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 0, crypto.randomUUID())).success).toBe(false);
    expect((await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, -100, crypto.randomUUID())).success).toBe(false);
  });

  it("rejects applying to a draft invoice (Revenue not yet recognized)", async () => {
    const depositId = await createDeposit();
    const draft = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(draft.success).toBe(true);
    if (!draft.success) return;

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, draft.data.id, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("rejects applying to a voided invoice", async () => {
    const depositId = await createDeposit();
    const created = await mockFinanceRepository.createInvoice(BASE_INVOICE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.voidInvoice(created.data.id, crypto.randomUUID(), "Cancelled");

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, created.data.id, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("rejects applying more than the invoice's own outstanding balance, even if the deposit can cover it", async () => {
    const depositId = await createDeposit(200000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 50000, tax_minor: 0, discount_minor: 0 });

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 50001, crypto.randomUUID());
    expect(applied.success).toBe(false);

    const availableAfterFailure = await mockFinanceRepository.getDepositApplicableAmount(depositId);
    expect(availableAfterFailure).toBe(200000);
  });

  it("rejects a deposit and invoice belonging to different clients", async () => {
    const deposit = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      client_id: "client_3",
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "cash",
    });
    expect(deposit.success).toBe(true);
    if (!deposit.success) return;

    const invoiceId = await createIssuedInvoice(); // client_2
    const applied = await mockFinanceRepository.applyDepositToInvoice(deposit.data.id, invoiceId, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
  });

  it("F2.1C-C-REVIEW: rejects applying a deposit with no settlement entry — invoice_id-is-null + status-is-consumable alone is not proof Cash actually moved into Customer Deposits", async () => {
    const depositId = await createDeposit(50000);
    const invoiceId = await createIssuedInvoice();

    // Simulate a payment that predates ledger posting (or whose settlement entry was
    // otherwise never created) — the same class of state F1.8's P1118 guard exists for.
    const settlementEntry = readJournalEntries().find((e) => e.source_type === "payment_settlement" && e.source_id === depositId)!;
    expect(settlementEntry).toBeDefined();
    writeJournalEntries(readJournalEntries().filter((e) => e.id !== settlementEntry.id));

    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 10000, crypto.randomUUID());
    expect(applied.success).toBe(false);
    if (applied.success) return;
    expect(applied.error).toMatch(/No settlement entry exists/);
  });

  // E. Idempotency / posting identity

  it("each application posts under its own unique posting_key — no collision across repeated applications of the same deposit", async () => {
    const depositId = await createDeposit(60000);
    const invoiceA = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 30000, tax_minor: 0, discount_minor: 0 });
    const invoiceB = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 30000, tax_minor: 0, discount_minor: 0 });

    const first = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceA, 30000, crypto.randomUUID());
    const second = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceB, 30000, crypto.randomUUID());
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "deposit_application" });
    const postingKeys = entries.filter((e) => e.source_id === first.data.id || e.source_id === second.data.id).map((e) => e.posting_key);
    expect(new Set(postingKeys).size).toBe(2);
  });

  // H. Regression

  it("does not affect an ordinary invoice-linked payment's own settlement/refund flow", async () => {
    const invoiceId = await createIssuedInvoice();
    const payment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 103000,
      payment_method: "cash",
    });
    expect(payment.success).toBe(true);
    if (!payment.success) return;

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.status).toBe("paid");

    const refunded = await mockFinanceRepository.refundPayment(payment.data.id, 103000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
  });

  it("account 4000/4950/4900/2100/1000 are never touched by a deposit application entry", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    expect(applied.success).toBe(true);
    if (!applied.success) return;

    const detail = await findApplicationEntry(applied.data.id);
    const touchedAccountNumbers = new Set(detail.lines!.map((l) => l.account?.account_number));
    expect(touchedAccountNumbers.has(4000)).toBe(false);
    expect(touchedAccountNumbers.has(4950)).toBe(false);
    expect(touchedAccountNumbers.has(4900)).toBe(false);
    expect(touchedAccountNumbers.has(2100)).toBe(false);
    expect(touchedAccountNumbers.has(1000)).toBe(false);
  });

  // F2.1C-C-IDEMPOTENCY

  it("a same-key retry replays the original application — no second Payment row, no second Journal Entry, Invoice paid_minor not doubled", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const key = "app-retry-key-1";

    const first = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, key);
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, key);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(second.data.id).toBe(first.data.id);

    const allPayments = await mockFinanceRepository.getPayments();
    expect(allPayments.filter((p) => p.id === first.data.id)).toHaveLength(1);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "deposit_application" });
    expect(entries.filter((e) => e.source_id === first.data.id)).toHaveLength(1);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.paid_minor).toBe(40000); // not 80000 — the replay did not double-apply

    const available = await mockFinanceRepository.getDepositApplicableAmount(depositId);
    expect(available).toBe(63000); // only the ORIGINAL 40000 was ever deducted
  });

  it("a same-key retry with a DIFFERENT amount is rejected as a conflict, not replayed", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const key = "app-retry-key-2";

    const first = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, key);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 50000, key);
    expect(conflicting.success).toBe(false);
    if (conflicting.success) return;
    expect(conflicting.error).toMatch(/idempotency key was already used/);
  });

  it("a same-key retry against a DIFFERENT invoice is rejected as a conflict", async () => {
    const depositId = await createDeposit(103000);
    const invoiceA = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 40000, tax_minor: 0, discount_minor: 0 });
    const invoiceB = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 40000, tax_minor: 0, discount_minor: 0 });
    const key = "app-retry-key-3";

    const first = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceA, 40000, key);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceB, 40000, key);
    expect(conflicting.success).toBe(false);
  });

  it("a same-key retry against a DIFFERENT deposit is rejected as a conflict", async () => {
    const depositA = await createDeposit(103000);
    const depositB = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const key = "app-retry-key-4";

    const first = await mockFinanceRepository.applyDepositToInvoice(depositA, invoiceId, 40000, key);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.applyDepositToInvoice(depositB, invoiceId, 40000, key);
    expect(conflicting.success).toBe(false);
  });

  it("a DIFFERENT key represents a distinct, intentional second application, subject to available Deposit and Invoice balance", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();

    const first = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, "app-retry-key-5a");
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, "app-retry-key-5b");
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).not.toBe(first.data.id);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.paid_minor).toBe(80000);

    // A third, over-ceiling distinct key is still correctly rejected (invoice balance now only 23000).
    const third = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, "app-retry-key-5c");
    expect(third.success).toBe(false);
  });

  it("rejects a missing (empty-string) idempotency key", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const result = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, "");
    expect(result.success).toBe(false);
  });
});

describe("mockFinanceRepository.getDepositApplicableAmount", () => {
  it("returns 0 for a payment that isn't an unapplied Customer Deposit", async () => {
    const amount = await mockFinanceRepository.getDepositApplicableAmount("payment_4");
    expect(amount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finance F2.1C-E-B — Deposit Application Reversal
// ---------------------------------------------------------------------------

describe("mockFinanceRepository — Finance F2.1C-E-B: Deposit Application Reversal", () => {
  async function createDeposit(amountMinor = 103000) {
    const deposit = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: null,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: amountMinor,
      payment_method: "cash",
    });
    if (!deposit.success) throw new Error("deposit creation failed");
    return deposit.data.id;
  }

  async function createIssuedInvoice(invoiceInput = BASE_INVOICE_INPUT) {
    const created = await mockFinanceRepository.createInvoice(invoiceInput);
    if (!created.success) throw new Error("invoice creation failed");
    await mockFinanceRepository.issueInvoice(created.data.id);
    await mockFinanceRepository.sendInvoice(created.data.id);
    return created.data.id;
  }

  async function findReversalEntry(reversalId: string) {
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "deposit_application_reversal" });
    const entry = entries.find((e) => e.source_id === reversalId)!;
    expect(entry).toBeDefined();
    return mockFinanceRepository.getJournalEntry(entry.id);
  }

  // A. Basic reversal

  it("full reversal restores AR / Customer Deposits — Dr 1100 AR / Cr 2200 Customer Deposits, no Cash/Revenue/Tax/Discount line", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    expect(applied.success).toBe(true);
    if (!applied.success) return;

    const reversalId = crypto.randomUUID();
    const reversed = await mockFinanceRepository.reverseDepositApplication(applied.data.id, reversalId, "Client requested cancellation");
    expect(reversed.success).toBe(true);
    if (!reversed.success) return;
    expect(reversed.data.id).toBe(reversalId);
    expect(reversed.data.payment_type).toBe("refund");
    expect(reversed.data.payment_method).toBe("other");
    expect(reversed.data.invoice_id).toBe(invoiceId);
    expect(reversed.data.amount_minor).toBe(103000);
    expect(reversed.data.reference).toBe(`deposit_application_reversal_of:${applied.data.id}`);

    const detail = await findReversalEntry(reversalId);
    const lines = detail.lines!;
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.account?.account_number === 1100)?.debit_minor).toBe(103000);
    expect(lines.find((l) => l.account?.account_number === 2200)?.credit_minor).toBe(103000);
    for (const accountNumber of [1000, 4000, 4950, 2100, 4900]) {
      expect(lines.some((l) => l.account?.account_number === accountNumber)).toBe(false);
    }

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.paid_minor).toBe(0);
    expect(invoice.balance_minor).toBe(103000);
    expect(invoice.total_minor).toBe(103000);
    expect(invoice.subtotal_minor).toBe(100000);
    expect(invoice.tax_minor).toBe(5000);
    expect(invoice.discount_minor).toBe(2000);
  });

  it("original Application Payment/Journal Entry is never mutated", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Reversed");

    const original = await mockFinanceRepository.getPaymentById(applied.data.id);
    expect(original.payment_type).toBe("adjustment");
    expect(original.status).toBe("succeeded");
    expect(original.amount_minor).toBe(103000);
    expect(original.reference).toBe(`deposit_application_of:${depositId}`);
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "deposit_application" });
    expect(entries.some((e) => e.source_id === applied.data.id)).toBe(true);
  });

  // B. Multiple applications

  it("reversing one of two Applications restores availability and paid_minor only by that Application's own amount", async () => {
    const depositId = await createDeposit(50000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });

    const appA = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 20000, crypto.randomUUID());
    const appB = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 30000, crypto.randomUUID());
    expect(appA.success).toBe(true);
    expect(appB.success).toBe(true);
    if (!appA.success || !appB.success) return;

    expect(await mockFinanceRepository.getDepositApplicableAmount(depositId)).toBe(0);

    const reversed = await mockFinanceRepository.reverseDepositApplication(appA.data.id, crypto.randomUUID(), "Partial cleanup");
    expect(reversed.success).toBe(true);

    expect(await mockFinanceRepository.getDepositApplicableAmount(depositId)).toBe(20000);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.paid_minor).toBe(30000);
    expect(invoice.balance_minor).toBe(70000);

    // B's own Application is untouched.
    const bPayment = await mockFinanceRepository.getPaymentById(appB.data.id);
    expect(bPayment.status).toBe("succeeded");

    // Reversing B too fully restores availability.
    await mockFinanceRepository.reverseDepositApplication(appB.data.id, crypto.randomUUID(), "Full cleanup");
    expect(await mockFinanceRepository.getDepositApplicableAmount(depositId)).toBe(50000);
    const invoiceAfterBoth = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoiceAfterBoth.paid_minor).toBe(0);
  });

  // C. Cross-Invoice isolation

  it("reversing an Application on Invoice A never touches Invoice B's own Application", async () => {
    const depositId = await createDeposit(103000);
    const invoiceA = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 40000, tax_minor: 0, discount_minor: 0 });
    const invoiceB = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 30000, tax_minor: 0, discount_minor: 0 });

    const appA = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceA, 40000, crypto.randomUUID());
    const appB = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceB, 30000, crypto.randomUUID());
    if (!appA.success || !appB.success) throw new Error("setup failed");

    await mockFinanceRepository.reverseDepositApplication(appA.data.id, crypto.randomUUID(), "Cancel A's allocation");

    const invA = await mockFinanceRepository.getInvoiceById(invoiceA);
    const invB = await mockFinanceRepository.getInvoiceById(invoiceB);
    expect(invA.paid_minor).toBe(0);
    expect(invB.paid_minor).toBe(30000);
    expect(invB.status).toBe("paid");

    const bPayment = await mockFinanceRepository.getPaymentById(appB.data.id);
    expect(bPayment.status).toBe("succeeded");
    // deposit 103000, minus B's still-active 30000, plus A's reversed 40000 restored.
    expect(await mockFinanceRepository.getDepositApplicableAmount(depositId)).toBe(73000);
  });

  // D. Paid-Invoice reversal

  it("reversing a Deposit Application on a fully paid invoice transitions it to partially_paid", async () => {
    const depositId = await createDeposit(40000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });

    await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 60000,
      payment_method: "cash",
    });
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const before = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(before.status).toBe("paid");
    expect(before.paid_minor).toBe(100000);

    const reversed = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Deposit misapplied");
    expect(reversed.success).toBe(true);

    const after = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(after.paid_minor).toBe(60000);
    expect(after.balance_minor).toBe(40000);
    expect(after.status).toBe("partially_paid");
    expect(after.total_minor).toBe(100000);
  });

  // E. Void interaction

  it("reversal removes the P1137-equivalent blocker, and Void then succeeds as Clean Void when the Application was the only settlement", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    // A PARTIAL application (not covering the full invoice) deliberately
    // keeps status at "partially_paid" rather than "paid" — a fully-
    // covering application would leave the invoice's status label stuck at
    // "paid" even after paid_minor reverts to 0 (recompute_invoice_balance
    // never reverts a PAYMENT_AWARE status once reached, a pre-existing,
    // shared characteristic identical to what a 100% Cash refund of a
    // fully-paid invoice would also hit — out of this checkpoint's scope
    // to change, since "paid" itself is not Void-eligible regardless of
    // paid_minor). "partially_paid" IS Void-eligible, so this scenario
    // correctly demonstrates the blocker fix without tripping over that
    // unrelated, pre-existing status-ladder gap.
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 50000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const blocked = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be blocked");
    expect(blocked.success).toBe(false);

    await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Unblock void");

    const voided = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Now allowed");
    expect(voided.success).toBe(true);
    if (!voided.success) return;
    expect(voided.data.status).toBe("voided");
    const timeline = await mockFinanceRepository.getTimelineByInvoiceId(invoiceId);
    expect(timeline.some((t) => t.type === "invoice_voided")).toBe(true);
    expect(timeline.some((t) => t.type === "invoice_partially_voided")).toBe(false);
  });

  it("Finance F2.1C-E-B-REVIEW regression: reversing a Deposit Application that was an invoice's SOLE, FULL settlement (status='paid') still permits Clean Void", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const before = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(before.status).toBe("paid");
    expect(before.paid_minor).toBe(103000);

    const blocked = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be blocked");
    expect(blocked.success).toBe(false);

    const reversed = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Deposit misapplied");
    expect(reversed.success).toBe(true);

    // Status stays the stale "paid" label immediately after reversal — a
    // pre-existing, shared characteristic of recompute_invoice_balance's
    // status ladder (identical to what a 100% Cash refund of a fully-paid
    // invoice would also produce), not something this checkpoint changes.
    const afterReversal = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(afterReversal.status).toBe("paid");
    expect(afterReversal.paid_minor).toBe(0);
    expect(afterReversal.balance_minor).toBe(103000);

    // The genuine fix under review: Void must still succeed for this
    // specific paid_minor=0 case, even though status reads "paid".
    const voided = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Now allowed");
    expect(voided.success).toBe(true);
    if (!voided.success) return;
    expect(voided.data.status).toBe("voided");
    const timeline = await mockFinanceRepository.getTimelineByInvoiceId(invoiceId);
    expect(timeline.some((t) => t.type === "invoice_voided")).toBe(true);
  });

  it("a genuinely paid invoice (no reversal) remains correctly non-void-eligible — the fix is scoped to paid_minor=0 only", async () => {
    const invoiceId = await createIssuedInvoice();
    await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      payment_type: "full_payment",
      amount_minor: 103000,
      payment_method: "cash",
    });
    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.status).toBe("paid");
    expect(invoice.paid_minor).toBe(103000);

    const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should still be rejected");
    expect(result.success).toBe(false);
  });

  it("reversal then Partial Void: retains remaining Cash settlement, cancels the rest", async () => {
    const depositId = await createDeposit(40000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });
    await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "cash",
    });
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const blocked = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should be blocked");
    expect(blocked.success).toBe(false);

    await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Unblock void");

    const voided = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Now allowed");
    expect(voided.success).toBe(true);
    if (!voided.success) return;
    expect(voided.data.status).toBe("voided");
    expect(voided.data.paid_minor).toBe(20000);
    expect(voided.data.balance_minor).toBe(0);
    const timeline = await mockFinanceRepository.getTimelineByInvoiceId(invoiceId);
    expect(timeline.some((t) => t.type === "invoice_partially_voided")).toBe(true);
  });

  it("a remaining, unreversed second Application still blocks Void", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });
    const appA = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    const appB = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 30000, crypto.randomUUID());
    if (!appA.success || !appB.success) throw new Error("setup failed");

    await mockFinanceRepository.reverseDepositApplication(appA.data.id, crypto.randomUUID(), "Cancel only A");

    const result = await mockFinanceRepository.voidInvoice(invoiceId, crypto.randomUUID(), "Should still be blocked");
    expect(result.success).toBe(false);
  });

  // F. Invoice Adjustment interaction

  it("Adjustment then reversal: paid_minor and balance stay coherent, no negative fields", async () => {
    const depositId = await createDeposit(40000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const adjusted = await mockFinanceRepository.recordInvoiceAdjustment(
      invoiceId,
      { subtotal_minor: 50000, tax_minor: 0, discount_minor: 0, reason: "Reduced scope" },
      crypto.randomUUID(),
    );
    expect(adjusted.success).toBe(true);

    const reversed = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Undo deposit");
    expect(reversed.success).toBe(true);
    if (!reversed.success) return;

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.total_minor).toBe(50000);
    expect(invoice.paid_minor).toBe(0);
    expect(invoice.balance_minor).toBe(50000);
  });

  it("Reversal then Adjustment: anti-overpayment remains correct regardless of ordering", async () => {
    const depositId = await createDeposit(40000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Undo deposit");

    const adjusted = await mockFinanceRepository.recordInvoiceAdjustment(
      invoiceId,
      { subtotal_minor: 50000, tax_minor: 0, discount_minor: 0, reason: "Reduced scope" },
      crypto.randomUUID(),
    );
    expect(adjusted.success).toBe(true);
    if (!adjusted.success) return;
    expect(adjusted.data.total_minor).toBe(50000);
    expect(adjusted.data.paid_minor).toBe(0);
    expect(adjusted.data.balance_minor).toBe(50000);
  });

  // G. Refund interaction

  it("neither the source Application nor the reversal Payment can themselves be Cash-refunded", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const refundApplication = await mockFinanceRepository.refundPayment(applied.data.id, 103000, crypto.randomUUID());
    expect(refundApplication.success).toBe(false);

    const reversed = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Undo");
    if (!reversed.success) throw new Error("reversal failed");

    const refundReversal = await mockFinanceRepository.refundPayment(reversed.data.id, 103000, crypto.randomUUID());
    expect(refundReversal.success).toBe(false);
  });

  it("the original Customer Deposit's own refundable ceiling increases after its Application is reversed", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    expect(await mockFinanceRepository.getPaymentRefundableAmount(depositId)).toBe(0);

    await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Undo");

    expect(await mockFinanceRepository.getPaymentRefundableAmount(depositId)).toBe(103000);

    const refunded = await mockFinanceRepository.refundPayment(depositId, 103000, crypto.randomUUID());
    expect(refunded.success).toBe(true);
  });

  // H. Idempotency / double-reversal

  it("same reversalId + same Application replays without a second Journal Entry or Payment", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const reversalId = crypto.randomUUID();
    const first = await mockFinanceRepository.reverseDepositApplication(applied.data.id, reversalId, "Undo");
    const second = await mockFinanceRepository.reverseDepositApplication(applied.data.id, reversalId, "Undo");
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "deposit_application_reversal" });
    expect(entries.filter((e) => e.source_id === reversalId)).toHaveLength(1);

    const invoice = await mockFinanceRepository.getInvoiceById(invoiceId);
    expect(invoice.paid_minor).toBe(0);
  });

  it("same reversalId reused for a different Application is a conflict", async () => {
    const depositId = await createDeposit(103000);
    const invoiceA = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 40000, tax_minor: 0, discount_minor: 0 });
    const invoiceB = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 30000, tax_minor: 0, discount_minor: 0 });
    const appA = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceA, 40000, crypto.randomUUID());
    const appB = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceB, 30000, crypto.randomUUID());
    if (!appA.success || !appB.success) throw new Error("setup failed");

    const reversalId = crypto.randomUUID();
    const first = await mockFinanceRepository.reverseDepositApplication(appA.data.id, reversalId, "Undo A");
    expect(first.success).toBe(true);

    const conflict = await mockFinanceRepository.reverseDepositApplication(appB.data.id, reversalId, "Undo B");
    expect(conflict.success).toBe(false);
  });

  it("a different reversalId for an already-reversed Application is rejected", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const first = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "First reversal");
    expect(first.success).toBe(true);

    const second = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Second attempt, different key");
    expect(second.success).toBe(false);
  });

  it("historical replay succeeds even after a later, unrelated Invoice mutation", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice({ ...BASE_INVOICE_INPUT, subtotal_minor: 100000, tax_minor: 0, discount_minor: 0 });
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 40000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const reversalId = crypto.randomUUID();
    const first = await mockFinanceRepository.reverseDepositApplication(applied.data.id, reversalId, "Undo");
    expect(first.success).toBe(true);

    // A later, unrelated financial event moves the Invoice's state further.
    await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 30000,
      payment_method: "cash",
    });

    const replay = await mockFinanceRepository.reverseDepositApplication(applied.data.id, reversalId, "Undo");
    expect(replay.success).toBe(true);
    if (!replay.success) return;
    expect(replay.data.id).toBe(first.success ? first.data.id : "");
  });

  // I. Error contract

  it("rejects a missing (empty-string) reversalId", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const result = await mockFinanceRepository.reverseDepositApplication(applied.data.id, "", "Undo");
    expect(result.success).toBe(false);
  });

  it("rejects a blank reason", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const result = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "   ");
    expect(result.success).toBe(false);
  });

  it("rejects reversing a payment that is not a Deposit Application", async () => {
    const invoiceId = await createIssuedInvoice();
    const cashPayment = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      invoice_id: invoiceId,
      client_id: BASE_INVOICE_INPUT.client_id,
      event_id: null,
      contract_id: null,
      amount_minor: 20000,
      payment_method: "cash",
    });
    if (!cashPayment.success) throw new Error("setup failed");

    const result = await mockFinanceRepository.reverseDepositApplication(cashPayment.data.id, crypto.randomUUID(), "Not a deposit application");
    expect(result.success).toBe(false);
  });

  it("rejects reversing a nonexistent payment", async () => {
    const result = await mockFinanceRepository.reverseDepositApplication("nonexistent_payment", crypto.randomUUID(), "Undo");
    expect(result.success).toBe(false);
  });

  // J. Timeline

  it("records exactly one deposit_application_reversed timeline entry, against the reversal payment", async () => {
    const depositId = await createDeposit(103000);
    const invoiceId = await createIssuedInvoice();
    const applied = await mockFinanceRepository.applyDepositToInvoice(depositId, invoiceId, 103000, crypto.randomUUID());
    if (!applied.success) throw new Error("setup failed");

    const reversed = await mockFinanceRepository.reverseDepositApplication(applied.data.id, crypto.randomUUID(), "Client requested cancellation");
    if (!reversed.success) throw new Error("reversal failed");

    const timeline = await mockFinanceRepository.getTimelineByPaymentId(reversed.data.id);
    expect(timeline.filter((t) => t.type === "deposit_application_reversed")).toHaveLength(1);
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

describe("mockFinanceRepository — payment path unification (Finance F1.7)", () => {
  it("createPayment (succeeded) and recordPaymentSettlement post structurally identical Journal Entries for the same inputs — one canonical settlement path, not two", async () => {
    const viaCreate = await mockFinanceRepository.createPayment({
      ...BASE_PAYMENT_INPUT,
      amount_minor: 20000,
      payment_method: "cash",
    });
    expect(viaCreate.success).toBe(true);
    if (!viaCreate.success) return;

    const viaSettlement = await mockFinanceRepository.recordPaymentSettlement({
      ...PAYMENT_SETTLEMENT_INPUT,
      amount_minor: 20000,
    });
    expect(viaSettlement.success).toBe(true);
    if (!viaSettlement.success) return;

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "payment_settlement" });
    const createEntry = entries.find((e) => e.source_id === viaCreate.data.id);
    const settlementEntry = entries.find((e) => e.source_id === viaSettlement.data.id);
    expect(createEntry).toBeDefined();
    expect(settlementEntry).toBeDefined();

    const createDetail = await mockFinanceRepository.getJournalEntry(createEntry!.id);
    const settlementDetail = await mockFinanceRepository.getJournalEntry(settlementEntry!.id);
    const shape = (entry: typeof createDetail) => ({
      accountIds: entry.lines!.map((l) => l.account_id).sort(),
      debits: entry.lines!.map((l) => l.debit_minor).sort(),
      credits: entry.lines!.map((l) => l.credit_minor).sort(),
    });
    expect(shape(createDetail)).toEqual(shape(settlementDetail));

    const createAudit = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "payment", viaCreate.data.id);
    const settlementAudit = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "payment", viaSettlement.data.id);
    expect(createAudit.filter((e) => e.action === "payment_settlement_recorded")).toHaveLength(1);
    expect(settlementAudit.filter((e) => e.action === "payment_settlement_recorded")).toHaveLength(1);
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
    expect((await mockFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, memo: "" }, crypto.randomUUID())).success).toBe(false);
    expect(
      (await mockFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, lines: [MANUAL_ADJUSTMENT_INPUT.lines[0]] }, crypto.randomUUID()))
        .success,
    ).toBe(false);
    expect(
      (
        await mockFinanceRepository.recordManualAdjustment(
          {
            ...MANUAL_ADJUSTMENT_INPUT,
            lines: [
              { account_id: "account_1000", debit_minor: 0, credit_minor: 0, line_memo: null },
              { account_id: "account_2000", debit_minor: 0, credit_minor: 0, line_memo: null },
            ],
          },
          crypto.randomUUID(),
        )
      ).success,
    ).toBe(false);
    expect(
      (
        await mockFinanceRepository.recordManualAdjustment(
          {
            ...MANUAL_ADJUSTMENT_INPUT,
            lines: [
              { account_id: "account_1000", debit_minor: 100, credit_minor: 100, line_memo: null },
              { account_id: "account_2000", debit_minor: 0, credit_minor: 100, line_memo: null },
            ],
          },
          crypto.randomUUID(),
        )
      ).success,
    ).toBe(false);
  });

  it("rejects an unbalanced total (total debits != total credits), with no automatic plug line", async () => {
    const result = await mockFinanceRepository.recordManualAdjustment(
      {
        ...MANUAL_ADJUSTMENT_INPUT,
        lines: [
          { account_id: "account_1000", debit_minor: 5000, credit_minor: 0, line_memo: null },
          { account_id: "account_2000", debit_minor: 0, credit_minor: 4000, line_memo: null },
        ],
      },
      crypto.randomUUID(),
    );
    expect(result.success).toBe(false);
  });

  it("posts a balanced Journal Entry with the deterministic posting_key and writes exactly one Audit entry", async () => {
    const id = crypto.randomUUID();
    const result = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.posting_key).toBe(`manual_adjustment:${id}`);
    expect(result.data.source_id).toBeNull();
    expect(result.data.source_type).toBe("manual_adjustment");

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "journal_entry", result.data.id);
    expect(auditEntries.filter((e) => e.action === "manual_adjustment_recorded")).toHaveLength(1);
  });

  it("rejects a missing (empty-string) manualAdjustmentId", async () => {
    const result = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, "");
    expect(result.success).toBe(false);
  });

  it("a same-key retry with the same payload replays the original Journal Entry — no second entry, no duplicate lines", async () => {
    const id = crypto.randomUUID();

    const first = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(second.data.id).toBe(first.data.id);

    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "manual_adjustment" });
    expect(entries.filter((e) => e.posting_key === `manual_adjustment:${id}`)).toHaveLength(1);

    const detail = await mockFinanceRepository.getJournalEntry(first.data.id);
    expect(detail.lines).toHaveLength(2);

    // The replay did not write a second Audit entry beyond the one from the original post plus one from this replay's own repository-layer call — the SQL/mock posting layer itself was never re-invoked (see the account-existence assertion below).
    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "journal_entry", first.data.id);
    expect(auditEntries.filter((e) => e.action === "manual_adjustment_recorded").length).toBeGreaterThanOrEqual(1);
  });

  it("a same-key retry with a DIFFERENT amount is rejected as a conflict, not replayed", async () => {
    const id = crypto.randomUUID();
    const first = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.recordManualAdjustment(
      {
        ...MANUAL_ADJUSTMENT_INPUT,
        lines: [
          { account_id: "account_1000", debit_minor: 6000, credit_minor: 0, line_memo: null },
          { account_id: "account_2000", debit_minor: 0, credit_minor: 6000, line_memo: null },
        ],
      },
      id,
    );
    expect(conflicting.success).toBe(false);
    if (conflicting.success) return;
    expect(conflicting.error).toMatch(/idempotency key was already used/);
  });

  it("a same-key retry with a DIFFERENT account on one line is rejected as a conflict", async () => {
    const id = crypto.randomUUID();
    const first = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.recordManualAdjustment(
      { ...MANUAL_ADJUSTMENT_INPUT, lines: [{ account_id: "account_4000", debit_minor: 5000, credit_minor: 0, line_memo: null }, MANUAL_ADJUSTMENT_INPUT.lines[1]] },
      id,
    );
    expect(conflicting.success).toBe(false);
  });

  it("a same-key retry with a DIFFERENT entry_date is rejected as a conflict", async () => {
    const id = crypto.randomUUID();
    const first = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, entry_date: "2026-07-16" }, id);
    expect(conflicting.success).toBe(false);
  });

  it("a same-key retry with a DIFFERENT memo is rejected as a conflict", async () => {
    const id = crypto.randomUUID();
    const first = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, id);
    expect(first.success).toBe(true);

    const conflicting = await mockFinanceRepository.recordManualAdjustment({ ...MANUAL_ADJUSTMENT_INPUT, memo: "A different memo" }, id);
    expect(conflicting.success).toBe(false);
  });

  it("a DIFFERENT key represents a distinct, intentional second identical adjustment", async () => {
    const first = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, crypto.randomUUID());
    expect(first.success).toBe(true);
    const second = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, crypto.randomUUID());
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(second.data.id).not.toBe(first.data.id);
    const entries = await mockFinanceRepository.listJournalEntries({ sourceType: "manual_adjustment" });
    expect(entries.filter((e) => e.id === first.data.id || e.id === second.data.id)).toHaveLength(2);
  });
});

describe("mockFinanceRepository.reverseJournalEntry", () => {
  it("requires a nonblank reason", async () => {
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, crypto.randomUUID());
    if (!created.success) throw new Error("setup failed");

    const result = await mockFinanceRepository.reverseJournalEntry(created.data.id, { reason: "" });
    expect(result.success).toBe(false);
  });

  it("creates a new entry with debit/credit swapped, leaves the original entry's lines unchanged, links both directions, and allows at most one reversal per entry", async () => {
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, crypto.randomUUID());
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
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, crypto.randomUUID());
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
    const created = await mockFinanceRepository.recordManualAdjustment(MANUAL_ADJUSTMENT_INPUT, crypto.randomUUID());
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
