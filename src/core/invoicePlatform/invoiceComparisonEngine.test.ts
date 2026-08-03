import { describe, it, expect } from "vitest";
import { compareInvoiceVersions } from "@/core/invoicePlatform/invoiceComparisonEngine";
import { makeVersion, makeSnapshot, makeLineItem, makeAdjustment, makeInstallment, makePricing } from "@/core/invoicePlatform/testFixtures";

describe("compareInvoiceVersions", () => {
  it("reports no changes for two identical snapshots", () => {
    const snapshot = makeSnapshot();
    const versionA = makeVersion({ version_number: 1, snapshot });
    const versionB = makeVersion({ version_number: 2, snapshot });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.hasChanges).toBe(false);
    expect(result.diffs).toHaveLength(0);
  });

  it("detects a grand total amount change", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ pricing: makePricing({ grandTotal_minor: 10000 }) }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ pricing: makePricing({ grandTotal_minor: 12000 }) }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "amounts" && d.field === "Grand Total")).toBe(true);
  });

  it("detects an added line item", () => {
    const itemA = makeLineItem({ id: "li_1" });
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ lineItems: [itemA] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ lineItems: [itemA, makeLineItem({ id: "li_2" })] }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "line_items" && d.changeType === "added")).toBe(true);
  });

  it("detects a changed line item amount", () => {
    const itemA = makeLineItem({ id: "li_1", amount_minor: 5000 });
    const itemB = { ...itemA, amount_minor: 6000 };
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ lineItems: [itemA] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ lineItems: [itemB] }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "line_items" && d.changeType === "changed")).toBe(true);
  });

  it("detects terms/notes/policies text changes", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ terms: "A", notes: "A", policies: "A" }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ terms: "B", notes: "B", policies: "B" }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "terms")).toBe(true);
    expect(result.diffs.some((d) => d.category === "notes")).toBe(true);
    expect(result.diffs.some((d) => d.category === "policies")).toBe(true);
  });

  it("detects installment schedule changes", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ paymentSchedule: [makeInstallment({ id: "inst_1" })] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ paymentSchedule: [makeInstallment({ id: "inst_1" }), makeInstallment({ id: "inst_2" })] }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "installments" && d.changeType === "added")).toBe(true);
  });

  it("detects credit changes, distinct from manual adjustments", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ adjustments: [] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ adjustments: [makeAdjustment({ kind: "credit", id: "adj_1" })] }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "credits" && d.changeType === "added")).toBe(true);
  });

  it("does not report a manual_adjustment as a credit change", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ adjustments: [] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ adjustments: [makeAdjustment({ kind: "manual_adjustment", id: "adj_1" })] }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "credits")).toBe(false);
  });

  it("detects discount line item changes", () => {
    const versionA = makeVersion({ version_number: 1, snapshot: makeSnapshot({ lineItems: [makeLineItem({ kind: "service" })] }) });
    const versionB = makeVersion({ version_number: 2, snapshot: makeSnapshot({ lineItems: [makeLineItem({ kind: "service" }), makeLineItem({ kind: "discount", id: "disc_1" })] }) });
    const result = compareInvoiceVersions(versionA, versionB);
    expect(result.diffs.some((d) => d.category === "discounts" && d.changeType === "added")).toBe(true);
  });
});
