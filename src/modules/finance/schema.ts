import { z } from "zod";
import { PAYMENT_TYPES } from "@/core/enums/paymentType";
import { PAYMENT_METHODS } from "@/core/enums/paymentMethod";
import { EXPENSE_CATEGORIES } from "@/core/enums/expenseCategory";
import { majorToMinor } from "@/lib/money";

/**
 * Authoritative schemas for Invoice/Payment/Expense content fields, used
 * directly by the data layer (lib/data/index.ts). Same precedent as
 * modules/contracts/schema.ts's contractSchema: no UI exists yet in this
 * phase, so there's no HTML form producing string-only values to normalize
 * — a form-schema layer (mirroring contractFormSchema/contractFormToInput)
 * can be added on top of these without changing their shape once a Finance
 * UI phase begins.
 *
 * Every *_minor field is validated as a non-negative (or, where the amount
 * can't legitimately be zero, positive) integer — see lib/money.ts for why
 * these are integers rather than floats. Deliberately excluded from every
 * schema below (assigned by the data layer, never by a caller): id,
 * workspace_id, every generated number (invoice_number), every status
 * field, every derived total (total_minor, balance_minor, paid_minor), every
 * lifecycle timestamp, created_at/updated_at. Client/Event/Contract/Invoice
 * existence and workspace/client consistency are checked by the data layer
 * — a zod schema can't look up another store.
 */

const moneyMinor = z.number().int("Enter a whole number of minor units").nonnegative("Enter a valid amount");
const positiveMoneyMinor = z.number().int("Enter a whole number of minor units").positive("Enter an amount greater than zero");
const currencyCode = z
  .string()
  .trim()
  .length(3, "Use a 3-letter currency code")
  .transform((v) => v.toUpperCase());

export const invoiceSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client is required"),
    event_id: z.string().trim().nullable(),
    contract_id: z.string().trim().nullable(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().nullable(),
    issue_date: z.string().trim().nullable(),
    due_date: z.string().trim().nullable(),
    subtotal_minor: moneyMinor,
    tax_minor: moneyMinor,
    discount_minor: moneyMinor,
    currency: currencyCode,
    notes: z.string().trim().nullable(),
  })
  .refine((data) => data.discount_minor <= data.subtotal_minor, {
    message: "Discount cannot exceed the subtotal",
    path: ["discount_minor"],
  })
  .refine(
    (data) => data.issue_date === null || data.due_date === null || data.due_date >= data.issue_date,
    { message: "Due date cannot be before the issue date", path: ["due_date"] },
  );

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/**
 * Finance F2.1C-D-C. The corrected subtotal/tax/discount an already-issued
 * Invoice should now read as — total is always server-derived
 * (new_subtotal + new_tax - new_discount), never accepted from the caller.
 * currency is deliberately absent: it is financially immutable after
 * issuance (Founder decision D3, already enforced by updateInvoice's own
 * guard), so an adjustment can never touch it.
 */
export const invoiceAdjustmentSchema = z
  .object({
    subtotal_minor: moneyMinor,
    tax_minor: moneyMinor,
    discount_minor: moneyMinor,
    reason: z.string().trim().min(1, "A reason is required"),
  })
  .refine((data) => data.discount_minor <= data.subtotal_minor, {
    message: "Discount cannot exceed the subtotal",
    path: ["discount_minor"],
  });

export type InvoiceAdjustmentInput = z.infer<typeof invoiceAdjustmentSchema>;

export const paymentSchema = z.object({
  invoice_id: z.string().trim().nullable(),
  client_id: z.string().trim().min(1, "Client is required"),
  event_id: z.string().trim().nullable(),
  contract_id: z.string().trim().nullable(),
  payment_type: z.enum(PAYMENT_TYPES),
  amount_minor: positiveMoneyMinor,
  currency: currencyCode,
  payment_method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().nullable(),
  transaction_date: z.string().trim().min(1, "Transaction date is required"),
  notes: z.string().trim().nullable(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  event_id: z.string().trim().nullable(),
  client_id: z.string().trim().nullable(),
  contract_id: z.string().trim().nullable(),
  supplier_id: z.string().trim().nullable(),
  team_member_id: z.string().trim().nullable(),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1, "Description is required"),
  amount_minor: positiveMoneyMinor,
  currency: currencyCode,
  transaction_date: z.string().trim().min(1, "Transaction date is required"),
  due_date: z.string().trim().nullable(),
  reimbursable: z.boolean(),
  reference: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/**
 * Finance Repository Layer (Ledger) input schemas — validate shape only
 * (required fields, integer minor units, line count, exactly one nonzero
 * side per line), never accounting rules already enforced in Postgres.
 * Balance equality (total debits = total credits) is deliberately NOT
 * checked here — record_manual_adjustment's own P1106 check is the single
 * source of truth for that invariant; duplicating it in TypeScript would
 * create two places balance logic could drift apart. No UI exists yet for
 * any of these, so — same as invoiceSchema/paymentSchema/expenseSchema
 * above — there is no client-side form-schema variant, only the
 * authoritative shape the repository layer validates against.
 */

export const manualAdjustmentLineInputSchema = z
  .object({
    account_id: z.string().trim().min(1, "An account is required"),
    debit_minor: moneyMinor,
    credit_minor: moneyMinor,
    line_memo: z.string().trim().nullable().optional(),
  })
  .refine((line) => (line.debit_minor > 0) !== (line.credit_minor > 0), {
    message: "Enter an amount on exactly one side (debit or credit), not both or neither",
    path: ["debit_minor"],
  });

export type ManualAdjustmentLineInput = z.infer<typeof manualAdjustmentLineInputSchema>;

export const manualAdjustmentInputSchema = z.object({
  entry_date: z.string().trim().min(1, "Entry date is required"),
  memo: z.string().trim().min(1, "A memo is required"),
  lines: z.array(manualAdjustmentLineInputSchema).min(2, "A manual adjustment requires at least two lines"),
});

export type ManualAdjustmentInput = z.infer<typeof manualAdjustmentInputSchema>;

export const journalEntryReversalInputSchema = z.object({
  reason: z.string().trim().min(1, "A reversal reason is required"),
});

export type JournalEntryReversalInput = z.infer<typeof journalEntryReversalInputSchema>;

export const expenseTransitionInputSchema = z.object({
  transition: z.enum(["due", "paid", "reimbursed"]),
});

export type ExpenseTransitionInput = z.infer<typeof expenseTransitionInputSchema>;

/**
 * PaymentSettlementInput reuses paymentSchema/PaymentInput as-is — the
 * record_payment_settlement RPC's args are the same shape as
 * createPayment's (invoice_id/client_id/event_id/contract_id/payment_type/
 * amount_minor/currency/payment_method/reference/transaction_date/notes),
 * so a second, parallel schema would just duplicate this one. The one rule
 * unique to settlement — reject payment_method='stripe' — is a repository-
 * layer boundary check, not a shape-validation rule, so it lives in
 * lib/data/finance/supabaseRepository.ts / mockRepository.ts instead of here.
 */
export type PaymentSettlementInput = PaymentInput;

export const accountingPeriodCreateInputSchema = z
  .object({
    period_start: z.string().trim().min(1, "Start date is required"),
    period_end: z.string().trim().min(1, "End date is required"),
  })
  .refine((data) => data.period_end > data.period_start, {
    message: "End date must be after start date",
    path: ["period_end"],
  });

export type AccountingPeriodCreateInput = z.infer<typeof accountingPeriodCreateInputSchema>;

// close_period/lock_period take no body input beyond the target period's
// id — already a plain function argument on closeAccountingPeriod(id)/
// lockAccountingPeriod(id), so no input type exists for either.

/**
 * Client-side (react-hook-form) form schemas for the Finance UI — every
 * field is a plain string or boolean, matching what HTML form inputs
 * actually produce, mirroring modules/contracts/schema.ts's
 * contractFormSchema/contractFormToInput split. Money fields are entered in
 * major units (e.g. "1250.00") since that's what a human types; each
 * `*FormToInput` below converts through `majorToMinor()` before handing the
 * value to the authoritative schema above — the data layer never sees a
 * major-unit number.
 */

const majorAmountString = z
  .string()
  .trim()
  .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0, { message: "Enter a valid amount" });

export const invoiceFormSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client is required"),
    event_id: z.string().trim(),
    contract_id: z.string().trim(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim(),
    issue_date: z.string().trim(),
    due_date: z.string().trim(),
    subtotal: majorAmountString,
    tax: z.string().trim().refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: "Enter a valid amount",
    }),
    discount: z.string().trim().refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: "Enter a valid amount",
    }),
    currency: z.string().trim().length(3, "Use a 3-letter currency code"),
    notes: z.string().trim(),
  })
  .refine(
    (data) => data.discount === "" || Number(data.discount) <= Number(data.subtotal),
    { message: "Discount cannot exceed the subtotal", path: ["discount"] },
  )
  .refine(
    (data) => data.issue_date === "" || data.due_date === "" || data.due_date >= data.issue_date,
    { message: "Due date cannot be before the issue date", path: ["due_date"] },
  );

export type InvoiceFormInput = z.infer<typeof invoiceFormSchema>;

export function invoiceFormToInput(data: InvoiceFormInput): InvoiceInput {
  return {
    client_id: data.client_id,
    event_id: data.event_id === "" ? null : data.event_id,
    contract_id: data.contract_id === "" ? null : data.contract_id,
    title: data.title,
    description: data.description === "" ? null : data.description,
    issue_date: data.issue_date === "" ? null : data.issue_date,
    due_date: data.due_date === "" ? null : data.due_date,
    subtotal_minor: majorToMinor(Number(data.subtotal)),
    tax_minor: data.tax === "" ? 0 : majorToMinor(Number(data.tax)),
    discount_minor: data.discount === "" ? 0 : majorToMinor(Number(data.discount)),
    currency: data.currency.toUpperCase(),
    notes: data.notes === "" ? null : data.notes,
  };
}

export const paymentFormSchema = z.object({
  invoice_id: z.string().trim(),
  client_id: z.string().trim().min(1, "Client is required"),
  event_id: z.string().trim(),
  contract_id: z.string().trim(),
  payment_type: z.enum(PAYMENT_TYPES),
  amount: majorAmountString.refine((v) => Number(v) > 0, { message: "Enter an amount greater than zero" }),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
  payment_method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim(),
  transaction_date: z.string().trim().min(1, "Transaction date is required"),
  notes: z.string().trim(),
});

export type PaymentFormInput = z.infer<typeof paymentFormSchema>;

export function paymentFormToInput(data: PaymentFormInput): PaymentInput {
  return {
    invoice_id: data.invoice_id === "" ? null : data.invoice_id,
    client_id: data.client_id,
    event_id: data.event_id === "" ? null : data.event_id,
    contract_id: data.contract_id === "" ? null : data.contract_id,
    payment_type: data.payment_type,
    amount_minor: majorToMinor(Number(data.amount)),
    currency: data.currency.toUpperCase(),
    payment_method: data.payment_method,
    reference: data.reference === "" ? null : data.reference,
    transaction_date: data.transaction_date,
    notes: data.notes === "" ? null : data.notes,
  };
}

export const expenseFormSchema = z.object({
  event_id: z.string().trim(),
  client_id: z.string().trim(),
  contract_id: z.string().trim(),
  supplier_id: z.string().trim(),
  team_member_id: z.string().trim(),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(1, "Description is required"),
  amount: majorAmountString.refine((v) => Number(v) > 0, { message: "Enter an amount greater than zero" }),
  currency: z.string().trim().length(3, "Use a 3-letter currency code"),
  transaction_date: z.string().trim().min(1, "Transaction date is required"),
  due_date: z.string().trim(),
  reimbursable: z.boolean(),
  reference: z.string().trim(),
  notes: z.string().trim(),
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

export function expenseFormToInput(data: ExpenseFormInput): ExpenseInput {
  return {
    event_id: data.event_id === "" ? null : data.event_id,
    client_id: data.client_id === "" ? null : data.client_id,
    contract_id: data.contract_id === "" ? null : data.contract_id,
    supplier_id: data.supplier_id === "" ? null : data.supplier_id,
    team_member_id: data.team_member_id === "" ? null : data.team_member_id,
    category: data.category,
    description: data.description,
    amount_minor: majorToMinor(Number(data.amount)),
    currency: data.currency.toUpperCase(),
    transaction_date: data.transaction_date,
    due_date: data.due_date === "" ? null : data.due_date,
    reimbursable: data.reimbursable,
    reference: data.reference === "" ? null : data.reference,
    notes: data.notes === "" ? null : data.notes,
  };
}

/**
 * Manual Adjustment form schema — validates shape only (account required,
 * exactly one nonzero side, memo required, at least two lines), the same
 * scope manualAdjustmentInputSchema (lib/data layer) already covers.
 * Deliberately does NOT check total debit = total credit here — that
 * balance invariant is left to record_manual_adjustment's own P1106 check,
 * matching the Repository layer's own documented reason for not
 * duplicating it in TypeScript. The form still computes and displays the
 * live totals (see ManualAdjustmentForm) and disables submission while
 * unbalanced, but that's a UX guard around the same arithmetic, not a
 * second copy of the accounting rule.
 */
const majorAmountOrBlank = z.string().trim().refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Enter a valid amount" });

export const manualAdjustmentLineFormSchema = z
  .object({
    account_id: z.string().trim().min(1, "An account is required"),
    debit: majorAmountOrBlank,
    credit: majorAmountOrBlank,
    line_memo: z.string().trim(),
  })
  .refine((line) => (line.debit !== "" && Number(line.debit) > 0) !== (line.credit !== "" && Number(line.credit) > 0), {
    message: "Enter an amount on exactly one side (debit or credit), not both or neither",
    path: ["debit"],
  });

export type ManualAdjustmentLineFormInput = z.infer<typeof manualAdjustmentLineFormSchema>;

export const manualAdjustmentFormSchema = z.object({
  entry_date: z.string().trim().min(1, "Entry date is required"),
  memo: z.string().trim().min(1, "A memo is required"),
  lines: z.array(manualAdjustmentLineFormSchema).min(2, "A manual adjustment requires at least two lines"),
});

export type ManualAdjustmentFormInput = z.infer<typeof manualAdjustmentFormSchema>;

export function manualAdjustmentFormToInput(data: ManualAdjustmentFormInput): ManualAdjustmentInput {
  return {
    entry_date: data.entry_date,
    memo: data.memo,
    lines: data.lines.map((line) => ({
      account_id: line.account_id,
      debit_minor: line.debit === "" ? 0 : majorToMinor(Number(line.debit)),
      credit_minor: line.credit === "" ? 0 : majorToMinor(Number(line.credit)),
      line_memo: line.line_memo === "" ? null : line.line_memo,
    })),
  };
}

/** Accounting Period create has no money field, so the authoritative accountingPeriodCreateInputSchema (lib/data layer) doubles as the form schema directly — no major-unit conversion needed. */
export type AccountingPeriodFormInput = AccountingPeriodCreateInput;
