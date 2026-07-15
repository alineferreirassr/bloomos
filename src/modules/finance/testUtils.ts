import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";

/** Test-only fixture factory — not imported by any app code. */
export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice_test",
    workspace_id: "ws_test",
    client_id: "client_test",
    event_id: null,
    contract_id: null,
    invoice_number: "INV-2026-0001",
    title: "Test Invoice",
    description: null,
    status: "draft",
    issue_date: null,
    due_date: null,
    subtotal_minor: 10000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 10000,
    paid_minor: 0,
    balance_minor: 10000,
    currency: "USD",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment_test",
    workspace_id: "ws_test",
    invoice_id: null,
    client_id: "client_test",
    event_id: null,
    contract_id: null,
    payment_type: "deposit",
    status: "pending",
    amount_minor: 10000,
    currency: "USD",
    payment_method: "cash",
    reference: null,
    transaction_date: "2026-01-01",
    received_at: null,
    failed_at: null,
    refunded_at: null,
    notes: null,
    document_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "expense_test",
    workspace_id: "ws_test",
    event_id: null,
    client_id: null,
    contract_id: null,
    supplier_id: null,
    team_member_id: null,
    category: "miscellaneous",
    status: "planned",
    description: "Test Expense",
    amount_minor: 10000,
    currency: "USD",
    transaction_date: "2026-01-01",
    due_date: null,
    paid_at: null,
    reimbursable: false,
    reimbursed_at: null,
    reference: null,
    notes: null,
    document_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}
