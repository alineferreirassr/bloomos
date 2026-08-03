import type { InvoiceAdjustment, InvoiceAdjustmentKind } from "@/types/invoicePlatform";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 35 — Credit & Adjustment Engine (Step 7). Pure
 * categorization/aggregation over `InvoiceAdjustment[]` — a dedicated list,
 * separate from `InvoiceLineItem[]` (Step 4), matching the domain having
 * both `InvoiceLineItem` and `InvoiceAdjustment` as distinct top-level
 * types. `"refund_placeholder"` never triggers a real refund — see
 * `docs/billing-engine.md` and this checkpoint's own stop condition.
 */

export function buildAdjustment(input: { kind: InvoiceAdjustmentKind; label: string; amount_minor: number; notes: string | null; sourceInvoiceId?: string | null }): InvoiceAdjustment {
  return {
    id: generateId("invoice_adjustment"),
    kind: input.kind,
    label: input.label,
    amount_minor: input.amount_minor,
    notes: input.notes,
    sourceInvoiceId: input.sourceInvoiceId ?? null,
  };
}

export interface CreditAdjustmentBreakdown {
  credits: InvoiceAdjustment[];
  serviceCredits: InvoiceAdjustment[];
  invoiceCredits: InvoiceAdjustment[];
  manualAdjustments: InvoiceAdjustment[];
  refundPlaceholders: InvoiceAdjustment[];
  balanceCarryForwards: InvoiceAdjustment[];
  /** Positive magnitude — the total credits/adjustments/refund-placeholders reducing what's owed. */
  totalReductions_minor: number;
  /** Positive magnitude — every `balance_carry_forward` entry, which ADDS to what's owed. */
  totalCarryForward_minor: number;
  /** Net effect on the invoice total — reductions negative, carry-forward positive. */
  netAdjustment_minor: number;
}

export function computeCreditsAndAdjustments(adjustments: InvoiceAdjustment[]): CreditAdjustmentBreakdown {
  const byKind = (kind: InvoiceAdjustmentKind) => adjustments.filter((a) => a.kind === kind);
  const carryForwards = byKind("balance_carry_forward");
  const reducing = adjustments.filter((a) => a.kind !== "balance_carry_forward");

  const totalReductions_minor = Math.abs(reducing.reduce((sum, a) => sum + a.amount_minor, 0));
  const totalCarryForward_minor = carryForwards.reduce((sum, a) => sum + Math.abs(a.amount_minor), 0);

  return {
    credits: byKind("credit"),
    serviceCredits: byKind("service_credit"),
    invoiceCredits: byKind("invoice_credit"),
    manualAdjustments: byKind("manual_adjustment"),
    refundPlaceholders: byKind("refund_placeholder"),
    balanceCarryForwards: carryForwards,
    totalReductions_minor,
    totalCarryForward_minor,
    netAdjustment_minor: totalCarryForward_minor - totalReductions_minor,
  };
}
