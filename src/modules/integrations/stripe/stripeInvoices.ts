import type Stripe from "stripe";
import { getInvoiceById } from "@/lib/data";
import { getStripeProviderForWorkspace } from "@/core/integrations/providers/stripe/stripeClient";
import { syncClientToStripeCustomer } from "@/modules/integrations/stripe/customerSync";
import { getStripeInvoiceMappingByInvoiceId, upsertStripeInvoiceMapping } from "@/lib/data/core/integrations/stripeInvoiceMappingStore";
import { getLogger } from "@/core/observability/logger";

/**
 * Real Stripe Invoices (v2 Checkpoint 23, Step 7) — deliberately distinct
 * from BloomOS's own `Invoice` domain type (`types/invoice.ts`). A
 * BloomOS Invoice is the ledger record this app has always had; a Stripe
 * Invoice is Stripe's own hosted, payable document, created here *from*
 * a BloomOS Invoice's own totals so a client can pay it Stripe-hosted —
 * never a replacement for the BloomOS record, which stays the system of
 * record `applyPaymentToInvoice` (Finance) already maintains.
 */

export interface CreateStripeInvoiceParams {
  workspaceId: string;
  invoiceId: string;
  /** Stripe's own automatic email — real, sent by Stripe itself once the invoice is finalized+sent, never BloomOS's own (non-existent) mailer. */
  sendEmail?: boolean;
  metadata?: Record<string, string>;
}

export async function createStripeInvoiceFromBloomInvoice(params: CreateStripeInvoiceParams): Promise<Stripe.Invoice> {
  const invoice = await getInvoiceById(params.invoiceId);
  const provider = await getStripeProviderForWorkspace(params.workspaceId);
  const { mapping } = await syncClientToStripeCustomer(params.workspaceId, invoice.client_id);

  const stripeInvoice = await provider.createStripeInvoice({
    customerId: mapping.stripe_customer_id,
    autoAdvance: false,
    metadata: { bloomos_invoice_id: invoice.id, bloomos_workspace_id: params.workspaceId, bloomos_client_id: invoice.client_id, ...params.metadata },
  });

  await provider.createStripeInvoiceItem({
    customerId: mapping.stripe_customer_id,
    amountMinor: invoice.balance_minor > 0 ? invoice.balance_minor : invoice.total_minor,
    currency: invoice.currency,
    description: invoice.title,
    invoiceId: stripeInvoice.id,
  });

  const finalized = await provider.finalizeStripeInvoice(stripeInvoice.id);
  upsertStripeInvoiceMapping(params.workspaceId, invoice.id, finalized.id, finalized.invoice_pdf ?? null, finalized.hosted_invoice_url ?? null);

  if (params.sendEmail) {
    const sent = await provider.sendStripeInvoice(stripeInvoice.id);
    upsertStripeInvoiceMapping(params.workspaceId, invoice.id, sent.id, sent.invoice_pdf ?? null, sent.hosted_invoice_url ?? null);
    getLogger().info("Stripe invoice sent", { workspaceId: params.workspaceId, invoiceId: invoice.id, stripeInvoiceId: stripeInvoice.id });
    return sent;
  }

  getLogger().info("Stripe invoice finalized (open)", { workspaceId: params.workspaceId, invoiceId: invoice.id, stripeInvoiceId: stripeInvoice.id });
  return finalized;
}

/** Read-only — the real, Stripe-hosted PDF/invoice URL, if a Stripe Invoice has been created for this BloomOS Invoice. Never fabricated: returns `null` until Step 7's own `createStripeInvoiceFromBloomInvoice` has actually run. */
export function getExistingStripeInvoiceMapping(invoiceId: string) {
  return getStripeInvoiceMappingByInvoiceId(invoiceId);
}

export async function voidStripeInvoice(workspaceId: string, stripeInvoiceId: string): Promise<Stripe.Invoice> {
  const provider = await getStripeProviderForWorkspace(workspaceId);
  const result = await provider.voidStripeInvoice(stripeInvoiceId);
  getLogger().info("Stripe invoice voided", { workspaceId, stripeInvoiceId });
  return result;
}

export async function markStripeInvoiceUncollectible(workspaceId: string, stripeInvoiceId: string): Promise<Stripe.Invoice> {
  const provider = await getStripeProviderForWorkspace(workspaceId);
  const result = await provider.markStripeInvoiceUncollectible(stripeInvoiceId);
  getLogger().info("Stripe invoice marked uncollectible", { workspaceId, stripeInvoiceId });
  return result;
}

export async function retrieveStripeInvoice(workspaceId: string, stripeInvoiceId: string): Promise<Stripe.Invoice> {
  const provider = await getStripeProviderForWorkspace(workspaceId);
  return provider.retrieveStripeInvoice(stripeInvoiceId);
}
