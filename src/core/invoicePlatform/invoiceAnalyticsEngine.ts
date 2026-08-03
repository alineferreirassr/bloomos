import type { InvoiceAnalyticsSnapshot, InvoiceBuilderState } from "@/types/invoicePlatform";
import { currentVersionOf } from "@/core/invoicePlatform/invoiceBuilderEngine";
import { computeCreditsAndAdjustments } from "@/core/invoicePlatform/creditAdjustmentEngine";

/**
 * v2.0 Checkpoint 35 — Invoice Analytics (Step 13). Pure aggregation over
 * already-fetched `InvoiceBuilderState[]` — no store access, no `Date.now()`
 * (the caller injects `evaluatedAt`), matching `computeContractAnalytics`
 * (Checkpoint 34) exactly. "Average Credit" sums the same three credit kinds
 * (`credit`/`service_credit`/`invoice_credit`) the Comparison Engine's own
 * `isCreditKind` uses, excluding `manual_adjustment`/`refund_placeholder`/
 * `balance_carry_forward`. "Outstanding Balance" is a total across every
 * invoice, not an average, reusing each snapshot's own `paidToDate_minor`-
 * derived figure rather than recomputing it.
 */

export interface InvoiceAnalyticsInput {
  builderState: InvoiceBuilderState | null;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeInvoiceAnalytics(inputs: InvoiceAnalyticsInput[], evaluatedAt: string): InvoiceAnalyticsSnapshot {
  const totalInvoices = inputs.length;

  let draftCount = 0;
  let reviewCount = 0;
  let publishedCount = 0;
  let archivedCount = 0;

  const invoiceTotals: number[] = [];
  const deposits: number[] = [];
  const balances: number[] = [];
  const discounts: number[] = [];
  const credits: number[] = [];
  const installmentCounts: number[] = [];
  let outstandingBalance_minor = 0;

  for (const { builderState } of inputs) {
    if (!builderState) continue;

    if (builderState.status === "draft") draftCount += 1;
    if (builderState.status === "review") reviewCount += 1;
    if (builderState.status === "published") publishedCount += 1;
    if (builderState.status === "archived") archivedCount += 1;

    const version = currentVersionOf(builderState);
    if (!version) continue;

    const { pricing, paymentSchedule, adjustments } = version.snapshot;
    invoiceTotals.push(pricing.grandTotal_minor);
    deposits.push(pricing.depositDue_minor);
    balances.push(pricing.remainingBalance_minor);
    discounts.push(Math.abs(pricing.discountsTotal_minor));
    installmentCounts.push(paymentSchedule.length);
    outstandingBalance_minor += pricing.outstandingBalance_minor;

    const { credits: c, serviceCredits, invoiceCredits } = computeCreditsAndAdjustments(adjustments);
    const creditTotal = [...c, ...serviceCredits, ...invoiceCredits].reduce((sum, a) => sum + Math.abs(a.amount_minor), 0);
    credits.push(creditTotal);
  }

  return {
    totalInvoices,
    draftCount,
    reviewCount,
    publishedCount,
    archivedCount,
    averageInvoice_minor: Math.round(average(invoiceTotals)),
    averageDeposit_minor: Math.round(average(deposits)),
    averageBalance_minor: Math.round(average(balances)),
    averageDiscount_minor: Math.round(average(discounts)),
    averageCredit_minor: Math.round(average(credits)),
    averageInstallments: Math.round(average(installmentCounts) * 10) / 10,
    outstandingBalance_minor,
    evaluatedAt,
  };
}
