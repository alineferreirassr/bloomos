import { describe, expect, it } from "vitest";
import { contentIntelligenceBriefOutputSchema, analyzeContentInputSchema } from "@/modules/ai/contentIntelligence/schema";

function validOutput() {
  return {
    summary: "A strong content opportunity with room to sharpen the hook.",
    hookSuggestions: ["Lead with the most specific emotional detail."],
    ctaSuggestions: ["Add a single clear next step."],
    audienceObservations: "No audience is defined yet.",
    strengths: ["Has a defined hook."],
    gaps: ["Missing a call-to-action."],
    recommendations: ["Add a CTA next."],
    confidence: 70,
  };
}

describe("contentIntelligenceBriefOutputSchema — output schema validation", () => {
  it("accepts a fully valid output", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("rejects a missing field", () => {
    const invalid: Record<string, unknown> = validOutput();
    delete invalid.summary;
    expect(contentIntelligenceBriefOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects confidence outside 0-100", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), confidence: 101 }).success).toBe(false);
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), confidence: -1 }).success).toBe(false);
  });

  it("rejects a non-integer confidence", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), confidence: 70.5 }).success).toBe(false);
  });

  it("rejects an empty summary", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), summary: "" }).success).toBe(false);
  });

  it("rejects a summary that exceeds the length bound", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), summary: "a".repeat(1201) }).success).toBe(false);
  });

  it("rejects HTML/markup in any string field — the output contract's 'no HTML' requirement", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), summary: "<img src=x onerror=alert(1)>" }).success).toBe(false);
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), hookSuggestions: ["<script>alert(1)</script>"] }).success).toBe(false);
  });

  it("rejects an array field exceeding its bound", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), hookSuggestions: Array(11).fill("a valid hook suggestion") }).success).toBe(false);
  });

  it("accepts empty suggestion arrays — not every brief has ten of everything", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ ...validOutput(), ctaSuggestions: [] }).success).toBe(true);
  });

  it("rejects malformed provider output shaped as a completely different object", () => {
    expect(contentIntelligenceBriefOutputSchema.safeParse({ foo: "bar" }).success).toBe(false);
    expect(contentIntelligenceBriefOutputSchema.safeParse("not an object").success).toBe(false);
    expect(contentIntelligenceBriefOutputSchema.safeParse(null).success).toBe(false);
  });
});

describe("analyzeContentInputSchema", () => {
  it("accepts a valid input for each source entity type", () => {
    for (const type of ["idea_item", "inspiration_item", "script_item"] as const) {
      expect(analyzeContentInputSchema.safeParse({ source_entity_type: type, source_entity_id: "id_1" }).success).toBe(true);
    }
  });

  it("rejects a source_entity_type outside idea_item/inspiration_item/script_item", () => {
    expect(analyzeContentInputSchema.safeParse({ source_entity_type: "social_post", source_entity_id: "id_1" }).success).toBe(false);
  });

  it("rejects an empty source_entity_id", () => {
    expect(analyzeContentInputSchema.safeParse({ source_entity_type: "idea_item", source_entity_id: "" }).success).toBe(false);
  });
});
