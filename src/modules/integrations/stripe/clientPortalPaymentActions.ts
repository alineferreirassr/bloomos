"use server";

import { getInvoiceById, getCurrentClientAccountContext } from "@/lib/data";
import { createDepositCheckoutSession, createRemainingBalanceCheckoutSession } from "@/modules/integrations/stripe/checkoutSessions";
import { getExistingStripeInvoiceMapping } from "@/modules/integrations/stripe/stripeInvoices";
import type { ClientAccountContext } from "@/types/clientAccount";

const GENERIC_ACCESS_ERROR = "This payment isn't available right now.";

/**
 * Client Portal payments (v2 Checkpoint 23, Step 14; hardened Checkpoint
 * 45). `workspaceId`/`clientId` are resolved here from
 * `getCurrentClientAccountContext()` — the authenticated-session accessor
 * every other Client Portal Server Action uses — never trusted from a
 * caller-supplied parameter. A caller-supplied `workspaceId`/`clientId`
 * would let any authenticated Client Portal caller probe another client's
 * billing (an IDOR against `getClientPortalInvoicePdfAction`, or an
 * unauthorized checkout session against the two checkout actions) given
 * only knowledge of an `invoiceId`. The target Invoice is still
 * independently re-fetched and its own `workspace_id`/`client_id` checked
 * against the *resolved* (not supplied) context before any Stripe call.
 */
async function requireClientAccountContext(): Promise<ClientAccountContext | null> {
  return getCurrentClientAccountContext();
}

export type CreateClientPortalCheckoutResult = { success: true; url: string } | { success: false; error: string };

export async function createClientPortalDepositCheckoutAction(invoiceId: string, depositAmountMinor: number, successUrl: string, cancelUrl: string): Promise<CreateClientPortalCheckoutResult> {
  const context = await requireClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== workspaceId || invoice.client_id !== clientId) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!Number.isInteger(depositAmountMinor) || depositAmountMinor <= 0) return { success: false, error: "Enter a deposit amount greater than zero." };
  if (depositAmountMinor > invoice.balance_minor) return { success: false, error: "The deposit can't be more than the remaining balance." };

  try {
    const { url } = await createDepositCheckoutSession(workspaceId, invoiceId, depositAmountMinor, successUrl, cancelUrl);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not start checkout." };
  }
}

export async function createClientPortalBalanceCheckoutAction(invoiceId: string, successUrl: string, cancelUrl: string): Promise<CreateClientPortalCheckoutResult> {
  const context = await requireClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== workspaceId || invoice.client_id !== clientId) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (invoice.balance_minor <= 0) return { success: false, error: "This invoice has no remaining balance." };

  try {
    const { url } = await createRemainingBalanceCheckoutSession(workspaceId, invoiceId, successUrl, cancelUrl);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not start checkout." };
  }
}

export type GetClientPortalInvoicePdfResult = { success: true; url: string | null } | { success: false; error: string };

/** "Download Invoice" (Step 14) — the real, Stripe-hosted PDF URL, only if a real Stripe Invoice has been created for this BloomOS Invoice (a staff action, Step 7). Returns `url: null` rather than fabricating one. */
export async function getClientPortalInvoicePdfAction(invoiceId: string): Promise<GetClientPortalInvoicePdfResult> {
  const context = await requireClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  const { workspace_id: workspaceId, client_id: clientId } = context.account;

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== workspaceId || invoice.client_id !== clientId) return { success: false, error: GENERIC_ACCESS_ERROR };
  const mapping = getExistingStripeInvoiceMapping(invoiceId);
  return { success: true, url: mapping?.invoice_pdf_url ?? null };
}
