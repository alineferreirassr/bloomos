import type { InvoiceStatus } from "@/core/enums/invoiceStatus";

/**
 * Continues the commercial cycle a Contract closes: Lead -> Client -> Event
 * -> Contract -> Invoice -> Payments -> Expenses -> Profit. An Invoice
 * always belongs to a Client (`client_id` required); `event_id` and
 * `contract_id` are both deliberately nullable — a standalone transaction
 * (e.g. a one-off product sale, or an invoice for a Client with no Event or
 * Contract on record yet) is a legitimate Invoice, the same "doesn't assume
 * the full chain is populated" precedent Contract already established for
 * `event_id`. When `event_id` or `contract_id` is set, the data layer
 * validates it belongs to the same `client_id` and `workspace_id` — see
 * lib/data/index.ts's createInvoice/updateInvoice.
 *
 * Every money field is an integer minor-unit amount (see lib/money.ts) —
 * never a float. `total_minor` = `subtotal_minor` + `tax_minor` -
 * `discount_minor`; `balance_minor` = `total_minor` - `paid_minor`, both
 * derived by the data layer on every create/update/payment application, not
 * independently editable.
 *
 * `status` is a single state machine (core/workflows/invoiceWorkflow.ts).
 * Unlike Contract there is no plain status setter — every non-`draft` value
 * is reachable only through its own dedicated data-layer action
 * (issueInvoice, sendInvoice, markInvoiceViewed, markInvoiceOverdue,
 * voidInvoice, archiveInvoice) or automatically when a successful Payment is
 * applied (partially_paid / paid) — see lib/data/index.ts's
 * applyPaymentToInvoice.
 */
export interface Invoice {
  id: string;
  workspace_id: string;
  client_id: string;
  event_id: string | null;
  contract_id: string | null;
  invoice_number: string;
  title: string;
  description: string | null;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  paid_minor: number;
  balance_minor: number;
  currency: string;
  notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  overdue_at: string | null;
  voided_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}
