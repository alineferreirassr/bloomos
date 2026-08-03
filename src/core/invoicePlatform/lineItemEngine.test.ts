import { describe, it, expect } from "vitest";
import { buildLineItem, isReducingLineItem, sumRevenueLineItems, sumDiscountLineItems, sumTaxPlaceholderLineItems, groupLineItemsBySection } from "@/core/invoicePlatform/lineItemEngine";

describe("buildLineItem", () => {
  it("computes amount_minor from quantity * unitPrice_minor by default", () => {
    const item = buildLineItem({ sectionId: null, kind: "service", label: "Service", description: null, quantity: 3, unitPrice_minor: 1000 });
    expect(item.amount_minor).toBe(3000);
  });

  it("respects an explicit amount_minor override", () => {
    const item = buildLineItem({ sectionId: null, kind: "fee", label: "Flat Fee", description: null, quantity: 1, unitPrice_minor: 500, amount_minor: 750 });
    expect(item.amount_minor).toBe(750);
  });
});

describe("isReducingLineItem", () => {
  it("treats discount and tax_placeholder as reducing kinds", () => {
    expect(isReducingLineItem("discount")).toBe(true);
    expect(isReducingLineItem("tax_placeholder")).toBe(true);
  });

  it("treats every revenue kind as non-reducing", () => {
    for (const kind of ["service", "package", "product", "fee", "travel", "rental", "labor"] as const) {
      expect(isReducingLineItem(kind)).toBe(false);
    }
  });
});

describe("sumRevenueLineItems", () => {
  it("sums every non-reducing line item and excludes discounts/taxes", () => {
    const items = [buildLineItem({ sectionId: null, kind: "service", label: "A", description: null, quantity: 1, unitPrice_minor: 10000 }), buildLineItem({ sectionId: null, kind: "discount", label: "B", description: null, quantity: 1, unitPrice_minor: 0, amount_minor: -500 }), buildLineItem({ sectionId: null, kind: "fee", label: "C", description: null, quantity: 1, unitPrice_minor: 2000 })];
    expect(sumRevenueLineItems(items)).toBe(12000);
  });
});

describe("sumDiscountLineItems", () => {
  it("returns the discount total as a positive magnitude", () => {
    const items = [buildLineItem({ sectionId: null, kind: "discount", label: "10% off", description: null, quantity: 1, unitPrice_minor: 0, amount_minor: -1500 })];
    expect(sumDiscountLineItems(items)).toBe(1500);
  });
});

describe("sumTaxPlaceholderLineItems", () => {
  it("returns the tax placeholder total as a positive magnitude", () => {
    const items = [buildLineItem({ sectionId: null, kind: "tax_placeholder", label: "Sales Tax", description: null, quantity: 1, unitPrice_minor: 0, amount_minor: -800 })];
    expect(sumTaxPlaceholderLineItems(items)).toBe(800);
  });
});

describe("groupLineItemsBySection", () => {
  it("groups line items by sectionId, including null", () => {
    const items = [buildLineItem({ sectionId: "sec_1", kind: "service", label: "A", description: null, quantity: 1, unitPrice_minor: 100 }), buildLineItem({ sectionId: "sec_1", kind: "service", label: "B", description: null, quantity: 1, unitPrice_minor: 100 }), buildLineItem({ sectionId: null, kind: "fee", label: "C", description: null, quantity: 1, unitPrice_minor: 100 })];
    const grouped = groupLineItemsBySection(items);
    expect(grouped.get("sec_1")).toHaveLength(2);
    expect(grouped.get(null)).toHaveLength(1);
  });
});
