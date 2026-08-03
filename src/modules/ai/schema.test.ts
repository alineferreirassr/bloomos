import { describe, expect, it } from "vitest";
import { eventOperationsBriefModelOutputSchema } from "@/modules/ai/schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Event is on track.",
    healthExplanation: "Health is ready at 100/100 — nothing is currently deducting from it.",
    riskExplanations: [],
    recommendedActions: [{ label: "Confirm florist", reason: "Two overdue checklist items depend on it.", actionTargetType: "checklist" }],
    preparationNotes: null,
    internalNotes: null,
    ...overrides,
  };
}

describe("eventOperationsBriefModelOutputSchema", () => {
  it("accepts a well-formed structured output", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(validOutput());
    expect(result.success).toBe(true);
  });

  it("accepts risk explanations and non-null notes", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(
      validOutput({
        riskExplanations: [{ kind: "overdue_checklist", explanation: "Two items are overdue." }],
        preparationNotes: "Confirm the venue's backup plan.",
        internalNotes: "No concerns beyond the above.",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an empty executiveSummary", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(validOutput({ executiveSummary: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an oversized executiveSummary, guarding output size", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(validOutput({ executiveSummary: "x".repeat(1201) }));
    expect(result.success).toBe(false);
  });

  it("rejects zero recommended actions", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(validOutput({ recommendedActions: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 recommended actions", () => {
    const action = { label: "x", reason: "y", actionTargetType: null };
    const result = eventOperationsBriefModelOutputSchema.safeParse(
      validOutput({ recommendedActions: [action, action, action, action, action, action] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a recommendation with an empty reason — every recommendation must explain why", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(
      validOutput({ recommendedActions: [{ label: "Confirm florist", reason: "", actionTargetType: null }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid actionTargetType, closing the enum against arbitrary strings", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(
      validOutput({
        recommendedActions: [{ label: "Confirm florist", reason: "Because.", actionTargetType: "https://evil.example.com" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects missing healthExplanation", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse(validOutput({ healthExplanation: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 risk explanations", () => {
    const risk = { kind: "overdue_checklist", explanation: "x" };
    const result = eventOperationsBriefModelOutputSchema.safeParse({
      ...validOutput(),
      riskExplanations: Array(11).fill(risk),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a completely different shape (e.g. free-form provider text)", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse("Sure, here's a summary of the event...");
    expect(result.success).toBe(false);
  });

  it("strips extra unexpected top-level fields rather than trusting them", () => {
    const result = eventOperationsBriefModelOutputSchema.safeParse({
      ...validOutput(),
      unexpectedInjectedField: "<script>alert(1)</script>",
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("unexpectedInjectedField");
  });
});
