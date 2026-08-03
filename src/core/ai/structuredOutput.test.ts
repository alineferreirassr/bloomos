import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseStructuredOutput, applySemanticValidation } from "@/core/ai/structuredOutput";

const schema = z.object({ summary: z.string(), riskKind: z.string() });

describe("parseStructuredOutput", () => {
  it("parses and validates well-formed JSON matching the schema", () => {
    const result = parseStructuredOutput(JSON.stringify({ summary: "ok", riskKind: "schedule_delay" }), schema);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ summary: "ok", riskKind: "schedule_delay" });
  });

  it("fails with malformed_output on unparseable JSON", () => {
    const result = parseStructuredOutput("{not json", schema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("malformed_output");
  });

  it("fails with schema_failure when the shape doesn't match", () => {
    const result = parseStructuredOutput(JSON.stringify({ summary: "ok" }), schema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("schema_failure");
  });
});

describe("applySemanticValidation", () => {
  const detectedRiskKinds = new Set(["schedule_delay", "missing_owner"]);
  const validate = (value: { summary: string; riskKind: string }) =>
    detectedRiskKinds.has(value.riskKind)
      ? { success: true as const, value }
      : { success: false as const, error: `Unknown risk kind "${value.riskKind}".` };

  it("passes through a value that satisfies the semantic check", () => {
    const result = applySemanticValidation({ summary: "ok", riskKind: "schedule_delay" }, validate);
    expect(result.success).toBe(true);
  });

  it("fails with semantic_failure and the validator's own message when it doesn't", () => {
    const result = applySemanticValidation({ summary: "ok", riskKind: "invented_risk" }, validate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe("semantic_failure");
      expect(result.error.message).toContain("invented_risk");
    }
  });
});
