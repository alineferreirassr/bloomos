import { describe, expect, it } from "vitest";
import { getOperationsHealth, isValidOperationsHealthBand } from "@/core/operations/healthScoreEngine";
import type { OperationsHealthContext } from "@/core/operations/healthScoreEngine";

function makeContext(overrides: Partial<OperationsHealthContext> = {}): OperationsHealthContext {
  return {
    event: { status: "confirmed", priority: "normal", location_name: "The Grand Hall", address: null, budget_min: 10000, budget_max: 20000 },
    eventHealthContext: {
      hasChecklistItems: true,
      hasOverdueChecklistItems: false,
      hasScheduleItems: true,
      hasPostEventReview: false,
      daysUntilEvent: 30,
    },
    outstandingBalanceMinor: 0,
    hasOverdueInvoice: false,
    lowStockAssignedItemCount: 0,
    unfulfilledShoppingItemCount: 0,
    unassignedVendorRequirementCount: 0,
    unassignedTeamRequirementCount: 0,
    latePurchaseCount: 0,
    isOverBudget: false,
    daysSinceLastActivity: 1,
    documentCount: 2,
    ...overrides,
  };
}

describe("getOperationsHealth", () => {
  it("scores 100 (excellent) when every signal is clean", () => {
    const result = getOperationsHealth(makeContext());
    expect(result.score).toBe(100);
    expect(result.band).toBe("excellent");
    expect(result.factors).toHaveLength(0);
  });

  it("deducts for an outstanding balance and an overdue invoice independently", () => {
    const result = getOperationsHealth(makeContext({ outstandingBalanceMinor: 5000, hasOverdueInvoice: true }));
    expect(result.factors.map((f) => f.domain)).toEqual(expect.arrayContaining(["financial", "financial"]));
    expect(result.score).toBe(100 - 12 - 18);
  });

  it("classifies into attention/critical bands as more factors compound", () => {
    const attention = getOperationsHealth(
      makeContext({ outstandingBalanceMinor: 5000, unassignedTeamRequirementCount: 1, unassignedVendorRequirementCount: 1 }),
    );
    expect(attention.band === "attention" || attention.band === "good").toBe(true);

    const critical = getOperationsHealth(
      makeContext({
        outstandingBalanceMinor: 5000,
        hasOverdueInvoice: true,
        lowStockAssignedItemCount: 2,
        unfulfilledShoppingItemCount: 3,
        unassignedVendorRequirementCount: 2,
        unassignedTeamRequirementCount: 2,
        latePurchaseCount: 1,
        isOverBudget: true,
      }),
    );
    expect(critical.band).toBe("critical");
    expect(critical.score).toBeLessThan(45);
  });

  it("combines base eventHealth.ts factors with the new operational ones, largest deduction first", () => {
    const result = getOperationsHealth(
      makeContext({
        event: { status: "awaiting_deposit", priority: "critical", location_name: null, address: null, budget_min: null, budget_max: null },
        eventHealthContext: { hasChecklistItems: false, hasOverdueChecklistItems: false, hasScheduleItems: false, hasPostEventReview: false, daysUntilEvent: null },
        hasOverdueInvoice: true,
      }),
    );
    expect(result.factors[0].deduction).toBeGreaterThanOrEqual(result.factors[result.factors.length - 1].deduction);
    expect(result.factors.some((f) => f.domain === "checklist")).toBe(true);
    expect(result.factors.some((f) => f.domain === "financial")).toBe(true);
  });

  it("never scores below 0", () => {
    const result = getOperationsHealth(
      makeContext({
        event: { status: "awaiting_deposit", priority: "critical", location_name: null, address: null, budget_min: null, budget_max: null },
        eventHealthContext: { hasChecklistItems: false, hasOverdueChecklistItems: true, hasScheduleItems: false, hasPostEventReview: false, daysUntilEvent: 3 },
        outstandingBalanceMinor: 5000,
        hasOverdueInvoice: true,
        lowStockAssignedItemCount: 5,
        unfulfilledShoppingItemCount: 5,
        unassignedVendorRequirementCount: 5,
        unassignedTeamRequirementCount: 5,
        latePurchaseCount: 5,
        isOverBudget: true,
        daysSinceLastActivity: 30,
        documentCount: 0,
      }),
    );
    expect(result.score).toBe(0);
    expect(result.band).toBe("critical");
  });
});

describe("isValidOperationsHealthBand", () => {
  it("accepts the four real bands and rejects anything else", () => {
    expect(isValidOperationsHealthBand("excellent")).toBe(true);
    expect(isValidOperationsHealthBand("critical")).toBe(true);
    expect(isValidOperationsHealthBand("great")).toBe(false);
  });
});
