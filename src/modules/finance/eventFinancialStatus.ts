/**
 * A derived (never persisted) one-word summary of where an Event stands
 * financially, computed from its Contracts/Invoices/Payments rather than
 * stored on the Event record itself — the phase spec's explicit instruction
 * ("prefer deriving it from Contracts, Invoices, and Payments"). Lives here
 * rather than core/enums because every other enum in that folder is the
 * intended value set of a real persisted column; this one is a pure
 * computed label with no column of its own, so it doesn't need the same
 * discoverability. Two Events with identical financial states always
 * produce the same status — see getEventFinancialStatus below.
 */
export const EVENT_FINANCIAL_STATUSES = [
  "no_contract",
  "awaiting_invoice",
  "awaiting_deposit",
  "deposit_partial",
  "deposit_paid",
  "balance_due",
  "paid_in_full",
  "overdue",
  "refunded",
  "cancelled",
] as const;

export type EventFinancialStatus = (typeof EVENT_FINANCIAL_STATUSES)[number];

export const EVENT_FINANCIAL_STATUS_LABELS: Record<EventFinancialStatus, string> = {
  no_contract: "No Contract",
  awaiting_invoice: "Awaiting Invoice",
  awaiting_deposit: "Awaiting Deposit",
  deposit_partial: "Deposit Partially Paid",
  deposit_paid: "Deposit Paid",
  balance_due: "Balance Due",
  paid_in_full: "Paid in Full",
  overdue: "Overdue",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export interface EventFinancialStatusInput {
  /** True when the Event itself, or every Contract linked to it, is cancelled/declined — the event's commercial thread is dead. */
  eventCancelled: boolean;
  /** True when at least one non-cancelled/declined/expired Contract is linked to the Event. */
  hasActiveContract: boolean;
  /** True when at least one non-voided Invoice exists for the Event. */
  hasInvoice: boolean;
  /** True when any non-voided Invoice for the Event currently has status "overdue". */
  hasOverdueInvoice: boolean;
  /** True when any linked, non-cancelled/declined/expired Contract has deposit_required = true. */
  depositRequired: boolean;
  depositRequiredMinor: number;
  depositPaidMinor: number;
  invoicedTotalMinor: number;
  outstandingMinor: number;
  refundedMinor: number;
}

/**
 * Deterministic, priority-ordered derivation — the same inputs always
 * produce the same status, checked in a fixed order so an Event never
 * matches two of these at once. Mirrors the priority-order precedent of
 * getContractNextRecommendedAction/getInvoiceNextRecommendedAction.
 */
export function getEventFinancialStatus(input: EventFinancialStatusInput): EventFinancialStatus {
  if (input.eventCancelled) return "cancelled";
  if (!input.hasActiveContract) return "no_contract";
  if (input.hasOverdueInvoice) return "overdue";
  if (input.depositRequired && input.depositPaidMinor === 0) return "awaiting_deposit";
  if (input.depositRequired && input.depositPaidMinor < input.depositRequiredMinor) return "deposit_partial";
  if (input.refundedMinor > 0 && input.outstandingMinor === 0 && input.invoicedTotalMinor > 0) return "refunded";
  if (input.invoicedTotalMinor > 0 && input.outstandingMinor === 0) return "paid_in_full";
  if (input.depositRequired && input.depositPaidMinor >= input.depositRequiredMinor && input.outstandingMinor > 0) {
    return "deposit_paid";
  }
  if (input.outstandingMinor > 0) return "balance_due";
  return "awaiting_invoice";
}
