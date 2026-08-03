import type { InvoiceAdjustment, InvoiceInstallment, InvoiceLineItem, InvoicePricingBreakdown } from "@/types/invoicePlatform";
import { sumRevenueLineItems, sumDiscountLineItems, sumTaxPlaceholderLineItems } from "@/core/invoicePlatform/lineItemEngine";
import { computeCreditsAndAdjustments } from "@/core/invoicePlatform/creditAdjustmentEngine";
import { sumInstallments } from "@/core/invoicePlatform/installmentEngine";

/**
 * v2.0 Checkpoint 35 — Billing Engine (Step 5). Pure arithmetic — no I/O, no
 * `Date.now()`. Orchestrates the Line Item, Credit & Adjustment, and
 * Installment engines into one deterministic `InvoicePricingBreakdown`.
 * `paidToDate_minor` is always the caller-supplied real `Invoice.paid_minor`
 * — this engine never recomputes or estimates it from anything else, the
 * same "reuse the real ledger" discipline the Contract Platform held for
 * Proposal pricing.
 */

export interface ComputeInvoicePricingInput {
  currency: string;
  lineItems: InvoiceLineItem[];
  adjustments: InvoiceAdjustment[];
  paymentSchedule: InvoiceInstallment[];
  /** The real `Invoice.paid_minor` at evaluation time — reused, never recomputed. */
  paidToDate_minor: number;
}

export function computeInvoicePricing(input: ComputeInvoicePricingInput): InvoicePricingBreakdown {
  const lineItemsSubtotal_minor = sumRevenueLineItems(input.lineItems);
  const discountsTotal_minor = sumDiscountLineItems(input.lineItems);
  const taxPlaceholderTotal_minor = sumTaxPlaceholderLineItems(input.lineItems);
  const subtotal_minor = lineItemsSubtotal_minor - discountsTotal_minor;

  const { netAdjustment_minor } = computeCreditsAndAdjustments(input.adjustments);
  const adjustmentsTotal_minor = Math.abs(netAdjustment_minor);

  const grandTotal_minor = Math.max(0, subtotal_minor + taxPlaceholderTotal_minor + netAdjustment_minor);

  const installmentsTotal_minor = sumInstallments(input.paymentSchedule);
  const depositInstallment = input.paymentSchedule.find((i) => i.kind === "deposit");
  const depositDue_minor = depositInstallment?.amount_minor ?? 0;
  const remainingBalance_minor = Math.max(0, grandTotal_minor - depositDue_minor);

  const outstandingBalance_minor = Math.max(0, grandTotal_minor - input.paidToDate_minor);

  return {
    currency: input.currency,
    lineItemsSubtotal_minor,
    discountsTotal_minor,
    taxPlaceholderTotal_minor,
    adjustmentsTotal_minor,
    subtotal_minor,
    grandTotal_minor,
    depositDue_minor,
    remainingBalance_minor,
    installmentsTotal_minor,
    paidToDate_minor: input.paidToDate_minor,
    outstandingBalance_minor,
  };
}
