import { describe, expect, it } from "vitest";
import { aiGenerationCreateSchema, aiGenerationListFiltersSchema } from "@/modules/aiGeneration/schema";

function baseCreateInput() {
  return {
    source_entity_type: "idea_item" as const,
    source_entity_id: "idea_1",
    use_case_id: "hook-suggestions",
    skill_id: "hook-suggestions-skill",
    input: { title: "A cozy autumn wedding" },
    output: { hooks: ["Fall in love with fall weddings."] },
    provider_id: "mock-provider",
    model: "mock-model",
    prompt_version: "v1",
    is_mock: true,
    latency_ms: 120,
    confidence: 80,
  };
}

describe("aiGenerationCreateSchema", () => {
  it("accepts a fully valid input", () => {
    const result = aiGenerationCreateSchema.safeParse(baseCreateInput());
    expect(result.success).toBe(true);
  });

  it("accepts a null skill_id and a null confidence", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), skill_id: null, confidence: null });
    expect(result.success).toBe(true);
  });

  it("rejects a source_entity_type outside idea_item/inspiration_item/script_item", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), source_entity_type: "social_post" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty source_entity_id", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), source_entity_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects confidence above 100", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), confidence: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects confidence below 0", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), confidence: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative latency_ms", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), latency_ms: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects input that isn't a plain object", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), input: ["not", "an", "object"] });
    expect(result.success).toBe(false);
  });

  it("rejects output that isn't a plain object", () => {
    const result = aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), output: "plain string" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank provider_id/model/prompt_version", () => {
    expect(aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), provider_id: "" }).success).toBe(false);
    expect(aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), model: "" }).success).toBe(false);
    expect(aiGenerationCreateSchema.safeParse({ ...baseCreateInput(), prompt_version: "" }).success).toBe(false);
  });
});

describe("aiGenerationListFiltersSchema", () => {
  it("accepts an empty filter object", () => {
    expect(aiGenerationListFiltersSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully populated filter object", () => {
    const result = aiGenerationListFiltersSchema.safeParse({
      source_entity_type: "script_item",
      source_entity_id: "script_1",
      use_case_id: "hook-suggestions",
      approval_status: "approved",
      archived: "all",
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an approval_status outside proposed/approved/rejected", () => {
    const result = aiGenerationListFiltersSchema.safeParse({ approval_status: "archived" });
    expect(result.success).toBe(false);
  });
});
