import { describe, expect, it } from "vitest";
import { invoiceSchema, paymentSchema, expenseSchema } from "@/modules/finance/schema";

const validInvoice = {
  client_id: "client_1",
  event_id: null,
  contract_id: null,
  title: "Test Invoice",
  description: null,
  issue_date: "2026-01-01",
  due_date: "2026-01-15",
  subtotal_minor: 100000,
  tax_minor: 0,
  discount_minor: 0,
  currency: "usd",
  notes: null,
};

describe("invoiceSchema", () => {
  it("accepts a valid invoice and uppercases the currency", () => {
    const result = invoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("rejects a missing client_id", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, client_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative subtotal", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, subtotal_minor: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer money amount", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, subtotal_minor: 100.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a discount that exceeds the subtotal", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, subtotal_minor: 100, discount_minor: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, issue_date: "2026-02-01", due_date: "2026-01-01" });
    expect(result.success).toBe(false);
  });

  it("accepts a due date equal to the issue date", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, issue_date: "2026-01-01", due_date: "2026-01-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a currency code that isn't 3 letters", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, currency: "US" });
    expect(result.success).toBe(false);
  });

  it("allows null issue_date and due_date", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, issue_date: null, due_date: null });
    expect(result.success).toBe(true);
  });
});

const validPayment = {
  invoice_id: null,
  client_id: "client_1",
  event_id: null,
  contract_id: null,
  payment_type: "deposit" as const,
  amount_minor: 50000,
  currency: "USD",
  payment_method: "cash" as const,
  reference: null,
  transaction_date: "2026-01-01",
  notes: null,
};

describe("paymentSchema", () => {
  it("accepts a valid payment", () => {
    const result = paymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("rejects a missing client_id", () => {
    const result = paymentSchema.safeParse({ ...validPayment, client_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = paymentSchema.safeParse({ ...validPayment, amount_minor: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = paymentSchema.safeParse({ ...validPayment, amount_minor: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid payment_type", () => {
    const result = paymentSchema.safeParse({ ...validPayment, payment_type: "not_a_type" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid payment_method", () => {
    const result = paymentSchema.safeParse({ ...validPayment, payment_method: "not_a_method" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing transaction_date", () => {
    const result = paymentSchema.safeParse({ ...validPayment, transaction_date: "" });
    expect(result.success).toBe(false);
  });
});

const validExpense = {
  event_id: null,
  client_id: null,
  contract_id: null,
  supplier_id: null,
  team_member_id: null,
  category: "flowers" as const,
  description: "Test expense",
  amount_minor: 10000,
  currency: "USD",
  transaction_date: "2026-01-01",
  due_date: null,
  reimbursable: false,
  reference: null,
  notes: null,
};

describe("expenseSchema", () => {
  it("accepts a valid expense", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("rejects an empty description", () => {
    const result = expenseSchema.safeParse({ ...validExpense, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount_minor: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = expenseSchema.safeParse({ ...validExpense, category: "not_a_category" });
    expect(result.success).toBe(false);
  });

  it("allows every nullable relation to be null (a general business expense)", () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });
});
