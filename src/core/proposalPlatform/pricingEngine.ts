import type { ProposalPricing, ProposalPricingInput, ProposalPricingLineResult } from "@/types/proposalPlatform";

/**
 * v2.0 Checkpoint 33 — Pricing Engine (Step 5). Pure arithmetic over
 * already-selected packages/add-ons/optional services — no payment
 * provider, no tax service, no coupon validation is ever called. `taxRatePercent`
 * and `couponCode` are the spec's own named "Taxes Placeholder"/"Coupons
 * Placeholder": a flat `subtotal * rate` calculation and a plain carried
 * string respectively, never a jurisdiction-aware or provider-validated
 * figure — disclosed in `docs/pricing-engine.md`.
 */

function round(value: number): number {
  return Math.round(value);
}

export function computeProposalPricing(input: ProposalPricingInput): ProposalPricing {
  const lineItems: ProposalPricingLineResult[] = input.lines.map((line) => ({
    ...line,
    lineTotal_minor: round(line.unitPrice_minor * line.quantity),
  }));

  const includedLines = lineItems.filter((l) => !l.isOptional);
  const optionalLines = lineItems.filter((l) => l.isOptional);

  const packagesSubtotal_minor = includedLines.filter((l) => l.kind === "package").reduce((sum, l) => sum + l.lineTotal_minor, 0);
  const addonsSubtotal_minor = includedLines.filter((l) => l.kind === "addon").reduce((sum, l) => sum + l.lineTotal_minor, 0);
  const customLinesSubtotal_minor = includedLines.filter((l) => l.kind === "custom_line").reduce((sum, l) => sum + l.lineTotal_minor, 0);
  const optionalServicesTotal_minor = optionalLines.reduce((sum, l) => sum + l.lineTotal_minor, 0);

  const subtotal_minor = input.basePrice_minor + packagesSubtotal_minor + addonsSubtotal_minor + customLinesSubtotal_minor;

  let discountAmount_minor = 0;
  if (input.discount) {
    discountAmount_minor = input.discount.type === "percentage" ? round((subtotal_minor * input.discount.value) / 100) : round(input.discount.value);
    discountAmount_minor = Math.max(0, Math.min(discountAmount_minor, subtotal_minor));
  }

  const taxableAmount_minor = subtotal_minor - discountAmount_minor;
  const taxAmount_minor = input.taxRatePercent ? round((taxableAmount_minor * input.taxRatePercent) / 100) : 0;

  const grandTotal_minor = taxableAmount_minor + taxAmount_minor;

  const depositDue_minor = input.depositPercent ? round((grandTotal_minor * input.depositPercent) / 100) : 0;
  const remainingBalance_minor = grandTotal_minor - depositDue_minor;

  return {
    currency: input.currency,
    basePrice_minor: input.basePrice_minor,
    lineItems,
    packagesSubtotal_minor,
    addonsSubtotal_minor,
    optionalServicesTotal_minor,
    subtotal_minor,
    discountAmount_minor,
    taxAmount_minor,
    grandTotal_minor,
    depositDue_minor,
    remainingBalance_minor,
  };
}
