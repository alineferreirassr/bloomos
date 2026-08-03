import { generateId, nowIso } from "@/lib/data/utils";

/** v2 Checkpoint 23 — the BloomOS Invoice ↔ real Stripe Invoice mapping, so the Client Portal can offer a real "Download Invoice" once one exists (Stripe's own hosted `invoice_pdf`), never a fabricated link. */
export interface StripeInvoiceMapping {
  id: string;
  workspace_id: string;
  invoice_id: string;
  stripe_invoice_id: string;
  invoice_pdf_url: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  updated_at: string;
}

let mappings: StripeInvoiceMapping[] = [];

export function resetStripeInvoiceMappingStore(): void {
  mappings = [];
}

export function getStripeInvoiceMappingByInvoiceId(invoiceId: string): StripeInvoiceMapping | null {
  return mappings.find((mapping) => mapping.invoice_id === invoiceId) ?? null;
}

export function upsertStripeInvoiceMapping(workspaceId: string, invoiceId: string, stripeInvoiceId: string, invoicePdfUrl: string | null, hostedInvoiceUrl: string | null): StripeInvoiceMapping {
  const existing = getStripeInvoiceMappingByInvoiceId(invoiceId);
  const now = nowIso();
  if (existing) {
    const updated: StripeInvoiceMapping = { ...existing, stripe_invoice_id: stripeInvoiceId, invoice_pdf_url: invoicePdfUrl, hosted_invoice_url: hostedInvoiceUrl, updated_at: now };
    mappings = mappings.map((mapping) => (mapping.id === existing.id ? updated : mapping));
    return updated;
  }
  const created: StripeInvoiceMapping = { id: generateId("stripe-invoice-mapping"), workspace_id: workspaceId, invoice_id: invoiceId, stripe_invoice_id: stripeInvoiceId, invoice_pdf_url: invoicePdfUrl, hosted_invoice_url: hostedInvoiceUrl, created_at: now, updated_at: now };
  mappings = [...mappings, created];
  return created;
}
