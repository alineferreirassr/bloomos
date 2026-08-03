import { describe, expect, it } from "vitest";
import { detectOperationsRisks, RISK_DETECTORS } from "@/core/operations/riskEngine";
import type { RiskDetectionInput } from "@/core/operations/riskEngine";

function makeInput(overrides: Partial<RiskDetectionInput> = {}): RiskDetectionInput {
  return {
    hasUnassignedTeamRequirement: false,
    hasLateVendorAssignment: false,
    hasLowStockAssignedItem: false,
    outstandingBalanceMinor: 0,
    hasOverdueInvoice: false,
    hasActiveContract: true,
    isOverBudget: false,
    hasLatePurchase: false,
    hasChecklistItems: true,
    daysUntilEvent: 30,
    ...overrides,
  };
}

describe("detectOperationsRisks", () => {
  it("returns no risks when every signal is clean", () => {
    expect(detectOperationsRisks(makeInput())).toEqual([]);
  });

  it("detects every one of the 8 required risk kinds independently", () => {
    const allTriggered = detectOperationsRisks(
      makeInput({
        hasUnassignedTeamRequirement: true,
        hasLateVendorAssignment: true,
        hasLowStockAssignedItem: true,
        outstandingBalanceMinor: 5000,
        hasOverdueInvoice: true,
        hasActiveContract: false,
        isOverBudget: true,
        hasLatePurchase: true,
        hasChecklistItems: false,
      }),
    );
    const kinds = allTriggered.map((r) => r.kind).sort();
    expect(kinds).toEqual(
      ["budget_overrun", "late_purchase", "late_vendor", "low_inventory", "missing_checklist", "missing_contract", "missing_team", "pending_payment"].sort(),
    );
  });

  it("sorts critical risks before warnings", () => {
    const risks = detectOperationsRisks(makeInput({ hasUnassignedTeamRequirement: true, hasActiveContract: false }));
    expect(risks[0].severity).toBe("critical");
    expect(risks[0].kind).toBe("missing_contract");
  });

  it("every risk carries a non-empty message and recommendation", () => {
    const risks = detectOperationsRisks(makeInput({ hasLatePurchase: true }));
    for (const risk of risks) {
      expect(risk.message.length).toBeGreaterThan(0);
      expect(risk.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("registers exactly 8 detectors, one per required risk kind", () => {
    expect(RISK_DETECTORS).toHaveLength(8);
  });
});
