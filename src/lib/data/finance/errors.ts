import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { type DataResult, fail } from "@/lib/data/result";

/**
 * Every custom errcode a committed Finance Ledger RPC can raise for an
 * expected, user-facing domain condition — never a raw SQLSTATE or
 * constraint-name internal. Each RAISE EXCEPTION message in the Posting
 * Engine migrations was authored specifically to be safe, readable text
 * (e.g. "Quantity received cannot exceed quantity ordered."), so
 * `error.message` is passed straight through to `fail()` rather than
 * re-translated into a second, parallel copy of the same wording that two
 * places could drift apart — the STABLE part of "stable application
 * errors" is that the caller can rely on this fixed code set to know which
 * failures are safe domain errors versus which category they fall into
 * (documented below), not that the wording is re-authored here too.
 *
 * Grouped by category, matching the Finance Repository Layer brief:
 *   - missing/archived account:            P1100, P1108
 *   - missing accounting period:            P1101
 *   - closed/locked period:                 P1102, P1103
 *   - duplicate posting / already reversed: P1104, P1109
 *   - invalid lifecycle transition:         P1105
 *   - unbalanced / invalid adjustment line: P1106, P1114, P1115
 *   - invalid workspace (cross-workspace):  P1107
 *   - unsupported movement/payment method:  P1110, P1117
 *   - missing source document:              P1111
 *   - blank reversal reason / memo:         P1112, P1113
 *   - invalid/overlapping period range:     P1116
 *   - no settlement entry to reverse/apply from: P1118 (Finance F1.8 —
 *     post_payment_refund_reversal, refuses to invent a reversal for a
 *     payment that predates ledger posting; reused by Finance F2.1C-C-
 *     REVIEW's post_deposit_application for the identical reason — an
 *     invoice_id-is-null + status-is-consumable Payment is not proof Cash
 *     actually moved into Customer Deposits for it)
 *   - void rejected, payments applied:      P1119 — RETIRED as of Finance
 *     F2.1C-D-D-B (mirrors P1120's own retirement precedent): originally
 *     post_invoice_voided_reversal's blanket rejection of any invoice with
 *     a payment applied, because void-after-partial-payment had no
 *     proportional correction model. Partial-Payment Void (source_type
 *     'invoice_partial_void') now runs in its place for that case. No SQL
 *     path raises P1119 any longer.
 *   - unbalanced refund correction:          P1121 (Finance F2.1C-B —
 *     post_payment_refund_reversal, defensive guard against a negative
 *     computed Refunds & Returns portion; should be unreachable given
 *     existing Invoice validation, never silently posts a negative debit)
 *   - deposit application validation:       P1122-P1128 (Finance F2.1C-C —
 *     record_deposit_application: P1122 amount exceeds the available
 *     deposit balance, P1123 amount exceeds the invoice's own outstanding
 *     balance, P1124 source payment is not an unapplied Customer Deposit
 *     in a consumable status, P1125 deposit/invoice workspace or client
 *     mismatch, P1126 deposit/invoice currency mismatch, P1127 invoice not
 *     in an application-eligible status, P1128 invalid (non-positive)
 *     amount)
 *   - request idempotency-key conflict:     P1129 (Finance F2.1C-C-
 *     IDEMPOTENCY — process_payment_refund and record_deposit_application
 *     share this one code: the caller reused a p_refund_payment_id /
 *     p_application_payment_id for a materially different payload than
 *     the request it was originally used for — a genuine conflict, never
 *     silently replayed)
 *   - request idempotency key required:     P1130 (Finance F2.1C-C-
 *     IDEMPOTENCY — process_payment_refund and record_deposit_application
 *     share this one code: p_refund_payment_id / p_application_payment_id
 *     is null; both are required, no default, reusing the established
 *     record_purchase_receipt / p_receipt_event_id convention)
 *   - unbalanced refund invoice-field sync:  P1131 (Finance F2.1C-D-B —
 *     post_payment_refund_reversal, defensive guard against the computed
 *     new subtotal/tax/discount/total going negative when synchronizing
 *     invoices.*_minor to the refund correction; should be unreachable
 *     given the existing refundable-amount ceiling, never silently writes
 *     a negative Invoice field)
 *   - invoice adjustment validation:        P1132-P1135 (Finance F2.1C-D-C —
 *     record_invoice_adjustment: P1132 the invoice is not in an
 *     adjustment-eligible status (draft — use updateInvoice instead — or a
 *     terminal voided/archived invoice), P1133 the requested subtotal/tax/
 *     discount all match the invoice's current values (no-op, nothing to
 *     post), P1134 the corrected total would drop below the amount already
 *     collected via cash payment or Customer Deposit Application (refund
 *     the excess first — never silently creates negative AR), P1135
 *     invalid financial values (negative amount or discount exceeding
 *     subtotal) reaching the RPC directly — defensive, unreachable via the
 *     TS repository layer's own schema validation, mirroring P1121/P1131's
 *     "should be unreachable, never silently corrupts" precedent)
 *   - partial-payment void validation:      P1136-P1139 (Finance F2.1C-D-D-B
 *     — void_invoice_and_reverse_revenue_recognition's Partial-Payment
 *     Cancellation branch: P1136 the invoice has no outstanding balance to
 *     cancel (fully paid — use a refund or invoice adjustment instead),
 *     P1137 an unresolved Customer Deposit Application blocks void (no
 *     reversal capability exists yet to un-strand it), P1138 a defensive
 *     guard against the computed cancellation producing a negative
 *     resulting Invoice field (should be unreachable — the cancellable
 *     amount is always strictly less than the invoice's current total),
 *     P1139 post_payment_refund_reversal's new guard rejecting a refund
 *     linked to an already-terminal (voided/archived) invoice — immaterial
 *     before Partial Void existed, since only a zero-paid invoice could
 *     ever reach `voided`; now a paid invoice can too, and its economic
 *     fields must stay frozen once terminal)
 *
 * P1120 (Finance F2.1B-REVIEW's "refund rejected, Revenue recognized" —
 * process_payment_refund's blanket rejection of any invoice-linked refund
 * against recognized Revenue) is RETIRED as of Finance F2.1C-B: the real
 * proportional correction (Dr 4950 Refunds & Returns / Dr 2100 Sales Tax
 * Payable / Cr 4900 Sales Discounts / Cr 1100 AR, composed into the same
 * payment_refund entry) now runs in its place. No SQL path raises P1120
 * any longer — removed from the recognized set below rather than left as
 * unreachable dead weight.
 *   - required receipt event id:            P0010 (Purchases-owned range,
 *     reachable here since record_payment_settlement/record_expense_
 *     transition/record_manual_adjustment/reverse_journal_entry/
 *     create_accounting_period/close_period/lock_period never raise it,
 *     but post_purchase_receipt's own composition inside
 *     record_purchase_receipt — owned by the Purchases repository, not
 *     this one — can; included here only for completeness of the range).
 *   - invalid report date range/filter:     P1200 (the four Finance Reports
 *     RPCs — finance_general_ledger_report/finance_trial_balance_report/
 *     finance_profit_and_loss_report/finance_balance_sheet_report — share
 *     this one code; a report's date range is either syntactically valid
 *     or it is not, so no finer granularity is needed the way the Posting
 *     Engine's writes required).
 *
 * "not found" and "permission denied" are deliberately NOT in this set:
 * those are handled the same way every other repository in this codebase
 * already handles them — requireWorkspaceSession() throws Unauthorized/
 * ForbiddenError before any RPC call is attempted, a null row on a getById
 * fetch throws NotFoundError directly, and normalizeSupabaseError()
 * translates a raw RLS 42501/PGRST116 into Forbidden/NotFoundError for
 * anything that reaches Postgres. Duplicating that here would be a second
 * place those two categories could diverge from.
 */
export const FINANCE_VALIDATION_ERROR_CODES = new Set([
  "P0010",
  "P1100",
  "P1101",
  "P1102",
  "P1103",
  "P1104",
  "P1105",
  "P1106",
  "P1107",
  "P1108",
  "P1109",
  "P1110",
  "P1111",
  "P1112",
  "P1113",
  "P1114",
  "P1115",
  "P1116",
  "P1117",
  "P1118",
  "P1121",
  "P1122",
  "P1123",
  "P1124",
  "P1125",
  "P1126",
  "P1127",
  "P1128",
  "P1129",
  "P1130",
  "P1131",
  "P1132",
  "P1133",
  "P1134",
  "P1135",
  "P1136",
  "P1137",
  "P1138",
  "P1139",
  "P1200",
]);

/**
 * Call from a write method's `if (error) { ... }` branch. A known Finance
 * errcode becomes a DataResult `fail()` (the same "expected, user-facing
 * validation failure" treatment every other repository already gives its
 * own RPC's domain errcodes); anything else is thrown through
 * normalizeSupabaseError so raw Postgres/network/auth internals never
 * reach a caller as a stable-looking result.
 */
export function handleFinanceRpcError<T>(error: unknown): DataResult<T> {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;
  if (code && message && FINANCE_VALIDATION_ERROR_CODES.has(code)) {
    return fail(message);
  }
  throw normalizeSupabaseError(error);
}

/**
 * The report RPCs are reads, not writes — every other read in this
 * repository (getChartOfAccount, getJournalEntry, ...) throws rather than
 * returning a DataResult, so a report's own input-validation failure (an
 * invalid date range, P1200) is thrown too, as a safe, readable Error
 * rather than a raw Postgres internal — never re-derived wording, the
 * RPC's own message is already authored to be user-facing.
 */
export function throwFinanceReportError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;
  if (code && message && FINANCE_VALIDATION_ERROR_CODES.has(code)) {
    throw new Error(message);
  }
  throw normalizeSupabaseError(error);
}
