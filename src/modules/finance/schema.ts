import { z } from "zod";
import { PAYMENT_TYPES } from "@/core/enums/paymentType";
import { PAYMENT_METHODS } from "@/core/enums/paymentMethod";
import { EXPENSE_CATEGORIES } from "@/core/enums/expenseCategory";

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
