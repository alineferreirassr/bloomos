import { describe, it, expect } from "vitest";
import { computeProposalPricing } from "@/core/proposalPlatform/pricingEngine";
import type { ProposalPricingInput, ProposalPricingLineInput } from "@/types/proposalPlatform";

function line(overrides: Partial<ProposalPricingLineInput> = {}): ProposalPricingLineInput {
  return { kind: "package", refId: "pkg_1", label: "Luxury Picnic", unitPrice_minor: 65000, quantity: 1, isOptional: false, ...overrides };
}

function input(overrides: Partial<ProposalPricingInput> = {}): ProposalPricingInput {
  return { currency: "USD", basePrice_minor: 0, lines: [], discount: null, couponCode: null, taxRatePercent: null, depositPercent: null, ...overrides };
}

describe("computeProposalPricing", () => {
  it("sums a single package line into subtotal and grand total", () => {
    const pricing = computeProposalPricing(input({ lines: [line()] }));
    expect(pricing.packagesSubtotal_minor).toBe(65000);
    expect(pricing.subtotal_minor).toBe(65000);
    expect(pricing.grandTotal_minor).toBe(65000);
  });

  it("separates package and add-on subtotals", () => {
    const pricing = computeProposalPricing(
      input({
        lines: [line(), line({ kind: "addon", refId: "addon_1", label: "Flowers", unitPrice_minor: 15000, quantity: 2 })],
      }),
    );
    expect(pricing.packagesSubtotal_minor).toBe(65000);
    expect(pricing.addonsSubtotal_minor).toBe(30000);
    expect(pricing.subtotal_minor).toBe(95000);
  });

  it("excludes optional lines from subtotal and grand total, tracking them separately", () => {
    const pricing = computeProposalPricing(
      input({
        lines: [line(), line({ kind: "addon", refId: "addon_1", label: "Drone", unitPrice_minor: 25000, quantity: 1, isOptional: true })],
      }),
    );
    expect(pricing.subtotal_minor).toBe(65000);
    expect(pricing.optionalServicesTotal_minor).toBe(25000);
    expect(pricing.grandTotal_minor).toBe(65000);
  });

  it("applies a percentage discount", () => {
    const pricing = computeProposalPricing(input({ lines: [line()], discount: { type: "percentage", value: 10, label: "Loyalty" } }));
    expect(pricing.discountAmount_minor).toBe(6500);
    expect(pricing.grandTotal_minor).toBe(58500);
  });

  it("applies a fixed discount, capped at the subtotal", () => {
    const pricing = computeProposalPricing(input({ lines: [line({ unitPrice_minor: 5000 })], discount: { type: "fixed", value: 999999, label: null } }));
    expect(pricing.discountAmount_minor).toBe(5000);
    expect(pricing.grandTotal_minor).toBe(0);
  });

  it("applies a flat tax rate on the post-discount taxable amount", () => {
    const pricing = computeProposalPricing(input({ lines: [line({ unitPrice_minor: 10000 })], taxRatePercent: 10 }));
    expect(pricing.taxAmount_minor).toBe(1000);
    expect(pricing.grandTotal_minor).toBe(11000);
  });

  it("computes deposit due and remaining balance from a deposit percentage", () => {
    const pricing = computeProposalPricing(input({ lines: [line({ unitPrice_minor: 100000 })], depositPercent: 30 }));
    expect(pricing.depositDue_minor).toBe(30000);
    expect(pricing.remainingBalance_minor).toBe(70000);
  });

  it("defaults deposit to 0 when no deposit percentage is set", () => {
    const pricing = computeProposalPricing(input({ lines: [line()] }));
    expect(pricing.depositDue_minor).toBe(0);
    expect(pricing.remainingBalance_minor).toBe(pricing.grandTotal_minor);
  });

  it("includes a base price alongside package/add-on lines", () => {
    const pricing = computeProposalPricing(input({ basePrice_minor: 20000, lines: [line({ unitPrice_minor: 10000 })] }));
    expect(pricing.subtotal_minor).toBe(30000);
  });

  it("handles an empty line list without throwing", () => {
    const pricing = computeProposalPricing(input());
    expect(pricing.grandTotal_minor).toBe(0);
    expect(pricing.lineItems).toHaveLength(0);
  });

  it("multiplies unit price by quantity per line", () => {
    const pricing = computeProposalPricing(input({ lines: [line({ unitPrice_minor: 5000, quantity: 3 })] }));
    expect(pricing.lineItems[0].lineTotal_minor).toBe(15000);
    expect(pricing.packagesSubtotal_minor).toBe(15000);
  });
});
