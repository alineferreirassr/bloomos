import {
  INVOICE_STATUSES,
  TERMINAL_INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/core/enums/invoiceStatus";

export { INVOICE_STATUSES, TERMINAL_INVOICE_STATUSES, INVOICE_STATUS_LABELS };
export type { InvoiceStatus };

/**
 * The canonical Invoice lifecycle. Unlike Contract, there is no plain status
 * setter for Invoice — every transition below is legal only through its own
 * dedicated data-layer action (issueInvoice, sendInvoice, markInvoiceViewed,
 * markInvoiceOverdue, voidInvoice, archiveInvoice, restoreInvoice) or
 * automatically when a successful Payment is applied
 * (partially_paid/paid — see lib/data/index.ts's applyPaymentToInvoice).
 * This table is the single source of truth each of those actions checks
 * before writing, so a transition's legality is never re-decided ad hoc at
 * the call site.
 */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "voided", "archived"],
  issued: ["sent", "voided", "archived"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "voided", "archived"],
  viewed: ["partially_paid", "paid", "overdue", "voided", "archived"],
  partially_paid: ["paid", "overdue", "voided", "archived"],
  overdue: ["partially_paid", "paid", "voided", "archived"],
  paid: ["archived"],
  voided: ["archived"],
  archived: ["draft"],
};

export function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return false;
  return INVOICE_TRANSITIONS[from].includes(to);
}

/** Every status `from` can legally move to right now (empty once nothing further is legal). */
export function getNextInvoiceStatuses(from: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_TRANSITIONS[from];
}

/** True for a status with genuinely nothing left to do — voided/archived. `paid` is deliberately excluded: a paid Invoice can still be archived. */
export function isInvoiceTerminal(status: InvoiceStatus): boolean {
  return TERMINAL_INVOICE_STATUSES.includes(status);
}

interface InvoiceForNextAction {
  status: InvoiceStatus;
  due_date: string | null;
}

const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Invoice — mirrors getContractNextRecommendedAction. Checked in a
 * fixed priority order so the same Invoice state always produces the same
 * suggestion. Terminal statuses (voided/archived) and a fully `paid`
 * Invoice get no suggestion — nothing further is expected of either.
 */
export function getInvoiceNextRecommendedAction(invoice: InvoiceForNextAction): string | null {
  if (isInvoiceTerminal(invoice.status) || invoice.status === "paid") {
    return null;
  }

  const isDueSoon =
    invoice.due_date !== null &&
    new Date(invoice.due_date).getTime() - Date.now() <= DUE_SOON_WINDOW_MS &&
    new Date(invoice.due_date).getTime() >= Date.now();

  switch (invoice.status) {
    case "draft":
      return "Issue the invoice";
    case "issued":
      return "Send the invoice to the client";
    case "sent":
      if (isDueSoon) return "Payment is due soon — follow up with the client";
      return "Follow up — the invoice hasn't been viewed yet";
    case "viewed":
      if (isDueSoon) return "Payment is due soon — follow up with the client";
      return "Follow up for payment";
    case "partially_paid":
      if (isDueSoon) return "Payment is due soon — follow up for the remaining balance";
      return "Follow up for the remaining balance";
    case "overdue":
      return "This invoice is overdue — follow up for payment immediately";
    default:
      return null;
  }
}
