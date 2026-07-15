import type { PaymentType } from "@/core/enums/paymentType";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { PaymentMethod } from "@/core/enums/paymentMethod";

/**
 * A single money movement — collected from a Client (deposit, installment,
 * final/full payment, retainer) or paid back to one (refund, reimbursement,
 * adjustment). `invoice_id` is deliberately nullable: a Payment may exist
 * without an Invoice (e.g. a deposit collected before an Invoice is issued,
 * or a standalone cash transaction), but must always belong to a Client and
 * Workspace. When `invoice_id` is set, the data layer validates the
 * Invoice's `client_id`/`workspace_id` match this Payment's before allowing
 * it, and a `succeeded` Payment updates that Invoice's `paid_minor` /
 * `balance_minor` / `status` through applyPaymentToInvoice — never by a
 * caller writing those fields directly.
 *
 * `amount_minor` is always positive, including for `payment_type: "refund"`
 * rows — see docs/database.md's `payments` section and the Refund model
 * note in `core/workflows/paymentWorkflow.ts` for why refunds are just
 * Payments with a distinguishing `payment_type` rather than a second ledger.
 *
 * Never stores card numbers, bank account numbers, or any other sensitive
 * payment credential — `reference` is a free-text field for a check number,
 * a provider transaction id, or similar non-sensitive identifier only.
 * `document_id` stays null until the future Documents module can attach a
 * receipt or payment confirmation.
 */
export interface Payment {
  id: string;
  workspace_id: string;
  invoice_id: string | null;
  client_id: string;
  event_id: string | null;
  contract_id: string | null;
  payment_type: PaymentType;
  status: PaymentStatus;
  amount_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  reference: string | null;
  transaction_date: string;
  received_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}
