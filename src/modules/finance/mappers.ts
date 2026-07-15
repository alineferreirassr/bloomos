import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { InvoiceFormInput, PaymentFormInput, ExpenseFormInput } from "@/modules/finance/schema";
import { minorToMajor } from "@/lib/money";

/** Converts an integer minor-unit amount into the plain major-unit string an HTML number input works with (125000 -> "1250"). */
function minorToFormString(amountMinor: number): string {
  return String(minorToMajor(amountMinor));
}

/** Converts an Invoice record's null/numeric fields into the plain-string shape the form works with. */
export function invoiceToFormInput(invoice: Invoice): InvoiceFormInput {
  return {
    client_id: invoice.client_id,
    event_id: invoice.event_id ?? "",
    contract_id: invoice.contract_id ?? "",
    title: invoice.title,
    description: invoice.description ?? "",
    issue_date: invoice.issue_date ?? "",
    due_date: invoice.due_date ?? "",
    subtotal: minorToFormString(invoice.subtotal_minor),
    tax: minorToFormString(invoice.tax_minor),
    discount: minorToFormString(invoice.discount_minor),
    currency: invoice.currency,
    notes: invoice.notes ?? "",
  };
}

/** Converts a Payment record's null/numeric fields into the plain-string shape the form works with. */
export function paymentToFormInput(payment: Payment): PaymentFormInput {
  return {
    invoice_id: payment.invoice_id ?? "",
    client_id: payment.client_id,
    event_id: payment.event_id ?? "",
    contract_id: payment.contract_id ?? "",
    payment_type: payment.payment_type,
    amount: minorToFormString(payment.amount_minor),
    currency: payment.currency,
    payment_method: payment.payment_method,
    reference: payment.reference ?? "",
    transaction_date: payment.transaction_date,
    notes: payment.notes ?? "",
  };
}

/** Converts an Expense record's null/numeric fields into the plain-string shape the form works with. */
export function expenseToFormInput(expense: Expense): ExpenseFormInput {
  return {
    event_id: expense.event_id ?? "",
    client_id: expense.client_id ?? "",
    contract_id: expense.contract_id ?? "",
    supplier_id: expense.supplier_id ?? "",
    team_member_id: expense.team_member_id ?? "",
    category: expense.category,
    description: expense.description,
    amount: minorToFormString(expense.amount_minor),
    currency: expense.currency,
    transaction_date: expense.transaction_date,
    due_date: expense.due_date ?? "",
    reimbursable: expense.reimbursable,
    reference: expense.reference ?? "",
    notes: expense.notes ?? "",
  };
}
