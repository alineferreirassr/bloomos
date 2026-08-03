import { describe, expect, it } from "vitest";
import { crmAssistantModelOutputSchema } from "@/modules/ai/crmAssistant/schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Relationships are healthy overall.",
    relationshipHealthSummary: "No urgent issues.",
    clientRiskExplanations: [],
    upcomingOpportunities: [],
    suggestedFollowUps: [],
    recommendedActions: [],
    ...overrides,
  };
}

describe("crmAssistantModelOutputSchema", () => {
  it("accepts a minimal valid output", () => {
    expect(crmAssistantModelOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("rejects an empty executiveSummary", () => {
    expect(crmAssistantModelOutputSchema.safeParse(validOutput({ executiveSummary: "" })).success).toBe(false);
  });

  it("rejects an empty relationshipHealthSummary", () => {
    expect(crmAssistantModelOutputSchema.safeParse(validOutput({ relationshipHealthSummary: "" })).success).toBe(false);
  });

  it("rejects more than 30 client risk explanations", () => {
    const clientRiskExplanations = Array.from({ length: 31 }, (_, i) => ({ clientId: `c${i}`, explanation: "x" }));
    expect(crmAssistantModelOutputSchema.safeParse(validOutput({ clientRiskExplanations })).success).toBe(false);
  });

  it("rejects an action with an invalid targetType", () => {
    const recommendedActions = [{ label: "Do it", reason: "because", targetType: "invalid", targetId: "x1" }];
    expect(crmAssistantModelOutputSchema.safeParse(validOutput({ recommendedActions })).success).toBe(false);
  });

  it("accepts an action with a null targetType and null targetId", () => {
    const upcomingOpportunities = [{ label: "Follow up", reason: "because", targetType: null, targetId: null }];
    expect(crmAssistantModelOutputSchema.safeParse(validOutput({ upcomingOpportunities })).success).toBe(true);
  });

  it("accepts every closed targetType value", () => {
    for (const targetType of ["client", "lead", "event", "contract", "invoice"]) {
      const suggestedFollowUps = [{ label: "x", reason: "x", targetType, targetId: "id_1" }];
      expect(crmAssistantModelOutputSchema.safeParse(validOutput({ suggestedFollowUps })).success).toBe(true);
    }
  });

  it("rejects more than 10 actions in any single action list", () => {
    const recommendedActions = Array.from({ length: 11 }, () => ({ label: "x", reason: "x", targetType: null, targetId: null }));
    expect(crmAssistantModelOutputSchema.safeParse(validOutput({ recommendedActions })).success).toBe(false);
  });

  it("rejects a missing field entirely", () => {
    const { executiveSummary: _executiveSummary, ...withoutSummary } = validOutput();
    expect(crmAssistantModelOutputSchema.safeParse(withoutSummary).success).toBe(false);
  });
});
