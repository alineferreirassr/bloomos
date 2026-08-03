import { describe, expect, it } from "vitest";
import { dailyOperationsBriefModelOutputSchema } from "@/modules/ai/dailyBrief/schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Everything is on track today.",
    todaysPriorities: ["Follow up on Invoice INV-1."],
    riskExplanations: [],
    recommendations: [],
    suggestedActions: [],
    ...overrides,
  };
}

describe("dailyOperationsBriefModelOutputSchema", () => {
  it("accepts a minimal valid output", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("rejects an empty executiveSummary", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ executiveSummary: "" })).success).toBe(false);
  });

  it("requires at least one priority", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ todaysPriorities: [] })).success).toBe(false);
  });

  it("rejects more than 7 priorities", () => {
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ todaysPriorities: Array(8).fill("x") })).success).toBe(false);
  });

  it("rejects more than 20 risk explanations", () => {
    const riskExplanations = Array.from({ length: 21 }, (_, i) => ({ eventId: `event_${i}`, explanation: "x" }));
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ riskExplanations })).success).toBe(false);
  });

  it("rejects a suggestedAction with an invalid targetType", () => {
    const suggestedActions = [{ label: "Do it", reason: "because", targetType: "client", targetId: "c1" }];
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ suggestedActions })).success).toBe(false);
  });

  it("accepts a suggestedAction with a null targetType and null targetId", () => {
    const suggestedActions = [{ label: "Do it", reason: "because", targetType: null, targetId: null }];
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ suggestedActions })).success).toBe(true);
  });

  it("rejects more than 10 suggested actions", () => {
    const suggestedActions = Array.from({ length: 11 }, () => ({ label: "x", reason: "x", targetType: null, targetId: null }));
    expect(dailyOperationsBriefModelOutputSchema.safeParse(validOutput({ suggestedActions })).success).toBe(false);
  });

  it("rejects a missing field entirely", () => {
    const { executiveSummary: _executiveSummary, ...withoutSummary } = validOutput();
    expect(dailyOperationsBriefModelOutputSchema.safeParse(withoutSummary).success).toBe(false);
  });
});
