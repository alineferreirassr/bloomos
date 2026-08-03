import { describe, expect, it } from "vitest";
import { proposalModelOutputSchema } from "@/modules/ai/proposal/schema";

function validOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "A concise proposal summary.",
    eventOverview: "An overview of the event.",
    servicesIncluded: [{ eventServiceId: "es_1", note: null }],
    timelineSummary: "Two schedule items planned.",
    paymentTerms: [{ label: "Full balance", amountMinor: 50000, dueDate: null, description: null }],
    recommendations: ["Confirm the guest count."],
    optionalAddOns: [],
    questionsForClient: ["What is your target budget?"],
    missingInformation: [],
    suggestedMemory: null,
    ...overrides,
  };
}

describe("proposalModelOutputSchema", () => {
  it("accepts a well-formed output", () => {
    const result = proposalModelOutputSchema.safeParse(validOutput());
    expect(result.success).toBe(true);
  });

  it("accepts a non-null suggestedMemory", () => {
    const result = proposalModelOutputSchema.safeParse(validOutput({ suggestedMemory: { scope: "workspace", content: "Prefers formal tone." } }));
    expect(result.success).toBe(true);
  });

  it("rejects an empty executiveSummary", () => {
    const result = proposalModelOutputSchema.safeParse(validOutput({ executiveSummary: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a servicesIncluded entry missing eventServiceId", () => {
    const result = proposalModelOutputSchema.safeParse(validOutput({ servicesIncluded: [{ note: "x" }] }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative paymentTerms amount", () => {
    const result = proposalModelOutputSchema.safeParse(
      validOutput({ paymentTerms: [{ label: "Deposit", amountMinor: -100, dueDate: null, description: null }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer paymentTerms amount", () => {
    const result = proposalModelOutputSchema.safeParse(
      validOutput({ paymentTerms: [{ label: "Deposit", amountMinor: 100.5, dueDate: null, description: null }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid suggestedMemory scope", () => {
    const result = proposalModelOutputSchema.safeParse(validOutput({ suggestedMemory: { scope: "global", content: "x" } }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 30 servicesIncluded entries", () => {
    const tooMany = Array.from({ length: 31 }, (_, index) => ({ eventServiceId: `es_${index}`, note: null }));
    const result = proposalModelOutputSchema.safeParse(validOutput({ servicesIncluded: tooMany }));
    expect(result.success).toBe(false);
  });
});
