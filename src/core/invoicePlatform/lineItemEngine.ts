import type { InvoiceLineItem, InvoiceLineItemKind } from "@/types/invoicePlatform";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 35 — Line Item Engine (Step 4). Pure helpers over
 * `InvoiceLineItem[]` — no I/O, no invented pricing. `amount_minor` is
 * always `quantity * unitPrice_minor` unless the caller explicitly overrides
 * it (e.g. a flat-fee line where quantity doesn't apply), and is negative
 * for `discount`/`tax_placeholder` reductions by convention — this engine
 * never flips a sign itself, the author decides.
 */

const REDUCING_KINDS: ReadonlySet<InvoiceLineItemKind> = new Set(["discount", "tax_placeholder"]);

export function isReducingLineItem(kind: InvoiceLineItemKind): boolean {
  return REDUCING_KINDS.has(kind);
}

export function buildLineItem(input: { sectionId: string | null; kind: InvoiceLineItemKind; label: string; description: string | null; quantity: number; unitPrice_minor: number; amount_minor?: number }): InvoiceLineItem {
  return {
    id: generateId("invoice_line_item"),
    sectionId: input.sectionId,
    kind: input.kind,
    label: input.label,
    description: input.description,
    quantity: input.quantity,
    unitPrice_minor: input.unitPrice_minor,
    amount_minor: input.amount_minor ?? input.quantity * input.unitPrice_minor,
  };
}

/** Sum of every revenue-kind line item (everything except `discount`/`tax_placeholder`), always non-negative by convention. */
export function sumRevenueLineItems(lineItems: InvoiceLineItem[]): number {
  return lineItems.filter((li) => !isReducingLineItem(li.kind)).reduce((sum, li) => sum + li.amount_minor, 0);
}

/** Sum of every `discount`-kind line item — reported as a positive magnitude, the caller subtracts it. */
export function sumDiscountLineItems(lineItems: InvoiceLineItem[]): number {
  return Math.abs(lineItems.filter((li) => li.kind === "discount").reduce((sum, li) => sum + li.amount_minor, 0));
}

/** Sum of every `tax_placeholder`-kind line item — reported as a positive magnitude. Never computed from a rate table; always whatever the author typed. */
export function sumTaxPlaceholderLineItems(lineItems: InvoiceLineItem[]): number {
  return Math.abs(lineItems.filter((li) => li.kind === "tax_placeholder").reduce((sum, li) => sum + li.amount_minor, 0));
}

export function groupLineItemsBySection(lineItems: InvoiceLineItem[]): Map<string | null, InvoiceLineItem[]> {
  const groups = new Map<string | null, InvoiceLineItem[]>();
  for (const li of lineItems) {
    const key = li.sectionId;
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, li]);
  }
  return groups;
}
