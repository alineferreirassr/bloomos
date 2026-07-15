export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "voided",
  "archived",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  voided: "Voided",
  archived: "Archived",
};

/**
 * Statuses reachable only through their own dedicated data-layer action
 * (issueInvoice, sendInvoice, markInvoiceViewed, applying a partial/full
 * Payment, markInvoiceOverdue, voidInvoice, archiveInvoice) — there is no
 * plain status setter for Invoice at all (unlike Contract's
 * updateContractStatus), since every one of these transitions carries its
 * own precondition and its own timestamp field. `draft` is the only status
 * assigned outside a dedicated action (on createInvoice).
 */
export const LOCKED_INVOICE_STATUSES: InvoiceStatus[] = [
  "issued",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "voided",
  "archived",
];

/** Statuses with genuinely nothing left to do — voided/archived. `paid` still allows archiving; it isn't included here. */
export const TERMINAL_INVOICE_STATUSES: InvoiceStatus[] = ["voided", "archived"];
