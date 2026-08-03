import { describe, expect, it } from "vitest";
import { financeAssistantModelOutputSchema } from "@/modules/ai/financeAssistant/schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Revenue looks healthy this month.",
    revenueOverviewSummary: "Strong collection rate.",
    cashFlowSummary: "No cash flow concerns.",
    financialRiskExplanations: [],
    revenueOpportunities: [],
    recommendations: [],
    ...overrides,
  };
}

describe("financeAssistantModelOutputSchema", () => {
  it("accepts a minimal valid output", () => {
    expect(financeAssistantModelOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("rejects an empty executiveSummary", () => {
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ executiveSummary: "" })).success).toBe(false);
  });

  it("rejects an empty revenueOverviewSummary", () => {
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ revenueOverviewSummary: "" })).success).toBe(false);
  });

  it("rejects an empty cashFlowSummary", () => {
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ cashFlowSummary: "" })).success).toBe(false);
  });

  it("rejects more than 30 financial risk explanations", () => {
    const financialRiskExplanations = Array.from({ length: 31 }, (_, i) => ({ riskId: `risk_${i}`, explanation: "x" }));
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ financialRiskExplanations })).success).toBe(false);
  });

  it("rejects an action with an invalid targetType", () => {
    const recommendations = [{ label: "Do it", reason: "because", targetType: "client", targetId: "c1" }];
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ recommendations })).success).toBe(false);
  });

  it("accepts an action with a null targetType and null targetId", () => {
    const revenueOpportunities = [{ label: "Follow up", reason: "because", targetType: null, targetId: null }];
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ revenueOpportunities })).success).toBe(true);
  });

  it("accepts every closed targetType value", () => {
    for (const targetType of ["invoice", "contract", "event"]) {
      const recommendations = [{ label: "x", reason: "x", targetType, targetId: "id_1" }];
      expect(financeAssistantModelOutputSchema.safeParse(validOutput({ recommendations })).success).toBe(true);
    }
  });

  it("rejects more than 10 actions in any single action list", () => {
    const recommendations = Array.from({ length: 11 }, () => ({ label: "x", reason: "x", targetType: null, targetId: null }));
    expect(financeAssistantModelOutputSchema.safeParse(validOutput({ recommendations })).success).toBe(false);
  });

  it("rejects a missing field entirely", () => {
    const { executiveSummary: _executiveSummary, ...withoutSummary } = validOutput();
    expect(financeAssistantModelOutputSchema.safeParse(withoutSummary).success).toBe(false);
  });
});
