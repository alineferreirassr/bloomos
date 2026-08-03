"use server";

import { getCurrentClientAccountContext, getInvoiceById } from "@/lib/data";
import { getCoreInvoiceBuilderService } from "@/core/invoicePlatform";
import { currentVersionOf } from "@/core/invoicePlatform/invoiceBuilderEngine";
import { compareInvoiceVersions } from "@/core/invoicePlatform/invoiceComparisonEngine";
import type { InvoiceAdjustment, InvoiceComparisonResult, InvoiceDocumentStatus, InvoiceFooterContent, InvoiceHeaderContent, InvoiceInstallment, InvoiceLineItem, InvoicePricingBreakdown } from "@/types/invoicePlatform";

/**
 * v2.0 Checkpoint 35, Step 14 — Client Billing Experience. The same
 * two-session-mechanism split `getClientPortalContract.ts` (Checkpoint 34)
 * established: resolves a `ClientAccount` via `getCurrentClientAccountContext()`,
 * never the team-member session gate `invoicePlatformActions.ts` uses.
 *
 * Explicitly no payments here — the real Client Portal Invoice page
 * (`ClientPortalInvoiceDetailView.tsx`) already has a real Stripe payment
 * flow, a real "Download Invoice (PDF)" button, and a real Payment History
 * list (Checkpoint 23) — none of that is touched or duplicated. This file
 * only adds the NEW document-layer view this checkpoint owns: the prepared
 * invoice's line items, the payment SCHEDULE plan (a proposal of what's
 * expected, never itself "paid"), credits/adjustments, deposit/remaining
 * balance as computed by the Billing Engine, and version history — the
 * same "prepares invoices, never a payment processor" boundary the whole
 * Invoice Platform holds to. Since a real PDF download already exists via
 * Stripe, no placeholder PDF button is added here — the real feature
 * already covers that spec line more completely than a placeholder would.
 *
 * A document is only visible to the client once its own document status
 * reaches `"published"` — the same "never show a client a work-in-progress"
 * rule `getClientPortalContractDocumentAction` enforces.
 */

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. Please sign in again.";
const NOT_FOUND_ERROR = "This invoice document could not be found.";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface ClientPortalInvoiceDocumentSummary {
  invoiceId: string;
  title: string;
  documentStatus: InvoiceDocumentStatus;
  header: InvoiceHeaderContent;
  lineItems: InvoiceLineItem[];
  adjustments: InvoiceAdjustment[];
  paymentSchedule: InvoiceInstallment[];
  pricing: InvoicePricingBreakdown;
  terms: string;
  policies: string;
  footer: InvoiceFooterContent;
  currentVersionNumber: number;
  availableVersionNumbers: number[];
}

async function resolveOwnedPublishedInvoice(invoiceId: string) {
  const context = await getCurrentClientAccountContext();
  if (!context) return { context: null, invoice: null, builderState: null } as const;

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== context.account.workspace_id || invoice.client_id !== context.account.client_id) {
    return { context, invoice: null, builderState: null } as const;
  }

  const builderState = await getCoreInvoiceBuilderService().getByInvoiceId(invoiceId);
  if (!builderState || builderState.status !== "published") return { context, invoice, builderState: null } as const;

  return { context, invoice, builderState } as const;
}

export async function getClientPortalInvoiceDocumentAction(invoiceId: string): Promise<Result<ClientPortalInvoiceDocumentSummary>> {
  const { context, invoice, builderState } = await resolveOwnedPublishedInvoice(invoiceId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!invoice || !builderState) return { success: false, error: NOT_FOUND_ERROR };

  const version = currentVersionOf(builderState);
  if (!version) return { success: false, error: NOT_FOUND_ERROR };

  const { snapshot } = version;

  return {
    success: true,
    data: {
      invoiceId,
      title: snapshot.header.title || invoice.title,
      documentStatus: builderState.status,
      header: snapshot.header,
      lineItems: snapshot.lineItems,
      adjustments: snapshot.adjustments,
      paymentSchedule: snapshot.paymentSchedule,
      pricing: snapshot.pricing,
      terms: snapshot.terms,
      policies: snapshot.policies,
      footer: snapshot.footer,
      currentVersionNumber: version.version_number,
      availableVersionNumbers: builderState.versions.map((v) => v.version_number),
    },
  };
}

export async function compareClientPortalInvoiceVersionsAction(invoiceId: string, versionANumber: number, versionBNumber: number): Promise<Result<InvoiceComparisonResult>> {
  const { context, builderState } = await resolveOwnedPublishedInvoice(invoiceId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!builderState) return { success: false, error: NOT_FOUND_ERROR };

  const versionA = builderState.versions.find((v) => v.version_number === versionANumber);
  const versionB = builderState.versions.find((v) => v.version_number === versionBNumber);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  return { success: true, data: compareInvoiceVersions(versionA, versionB) };
}
