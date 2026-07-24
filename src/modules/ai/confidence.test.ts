import { describe, expect, it } from "vitest";
import { computeContextConfidence, type ConfidenceInput } from "@/modules/ai/confidence";

function fullInput(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    hasClient: true,
    hasEventDate: true,
    hasLocation: true,
    hasBudget: true,
    hasAssignedOwner: true,
    hasChecklistItems: true,
    hasScheduleItems: true,
    ...overrides,
  };
}

describe("computeContextConfidence", () => {
  it("returns 100 when every field is present", () => {
    const confidence = computeContextConfidence(fullInput());
    expect(confidence.score).toBe(100);
    expect(confidence.reason).toMatch(/all key fields/i);
  });

  it("returns 0 when every field is absent", () => {
    const confidence = computeContextConfidence({
      hasClient: false,
      hasEventDate: false,
      hasLocation: false,
      hasBudget: false,
      hasAssignedOwner: false,
      hasChecklistItems: false,
      hasScheduleItems: false,
    });
    expect(confidence.score).toBe(0);
  });

  it("lowers the score for each missing field, never below what's actually missing", () => {
    const oneMissing = computeContextConfidence(fullInput({ hasBudget: false }));
    const twoMissing = computeContextConfidence(fullInput({ hasBudget: false, hasLocation: false }));
    expect(oneMissing.score).toBeLessThan(100);
    expect(twoMissing.score).toBeLessThan(oneMissing.score);
  });

  it("names exactly which fields are missing in the reason, not a generic message", () => {
    const confidence = computeContextConfidence(fullInput({ hasBudget: false, hasAssignedOwner: false }));
    expect(confidence.reason).toMatch(/no budget/i);
    expect(confidence.reason).toMatch(/no assigned owner/i);
    expect(confidence.reason).not.toMatch(/no location/i);
  });

  it("is deterministic — identical input always produces identical output", () => {
    const input = fullInput({ hasBudget: false });
    expect(computeContextConfidence(input)).toEqual(computeContextConfidence(input));
  });

  it("never returns a score outside 0–100", () => {
    const confidence = computeContextConfidence(fullInput());
    expect(confidence.score).toBeGreaterThanOrEqual(0);
    expect(confidence.score).toBeLessThanOrEqual(100);
  });
});
