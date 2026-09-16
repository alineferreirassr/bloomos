import { describe, expect, it } from "vitest";
import { socialStrategistModelOutputSchema } from "@/modules/ai/socialStrategist/schema";

function validOutput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    accountObservations: ["Reach was 100 as of 2026-09-01."],
    contentOpportunities: [{ label: "Build on your top post", reason: "It had the most interactions.", relatedPostId: "post_1", relatedIdeaId: null }],
    contentPillars: [{ name: "reel", rationale: "3 Ideas already planned in this format." }],
    nextContentRecommendations: [{ label: "Produce this idea", reason: "It's active.", suggestedFormat: "reel", relatedIdeaId: "idea_1", relatedInspirationId: null }],
    postingStrategyNotes: ["2 posts scheduled."],
    audienceObservations: ["An Idea names its audience as engaged couples."],
    referencedContent: [{ type: "post", id: "post_1", note: "Top performer." }],
    conversionObservations: ["3 Instagram Leads tracked."],
    dataSufficiencyNotes: [],
    confidence: 72,
    ...overrides,
  };
}

describe("socialStrategistModelOutputSchema — valid output", () => {
  it("accepts a well-formed, fully-populated output", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput());
    expect(result.success).toBe(true);
  });

  it("accepts an entirely empty (all-arrays-empty, confidence 0) output — the honest 'no data' shape", () => {
    const result = socialStrategistModelOutputSchema.safeParse(
      validOutput({
        accountObservations: [],
        contentOpportunities: [],
        contentPillars: [],
        nextContentRecommendations: [],
        postingStrategyNotes: [],
        audienceObservations: [],
        referencedContent: [],
        conversionObservations: [],
        dataSufficiencyNotes: ["No Social posts exist yet."],
        confidence: 0,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts null relatedPostId/relatedIdeaId/relatedInspirationId — 'no specific related item' is a valid state", () => {
    const result = socialStrategistModelOutputSchema.safeParse(
      validOutput({
        contentOpportunities: [{ label: "General opportunity", reason: "x", relatedPostId: null, relatedIdeaId: null }],
        nextContentRecommendations: [{ label: "x", reason: "x", suggestedFormat: null, relatedIdeaId: null, relatedInspirationId: null }],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("socialStrategistModelOutputSchema — invalid output rejected", () => {
  it("rejects a missing required field", () => {
    const output = validOutput();
    delete (output as Record<string, unknown>).confidence;
    expect(socialStrategistModelOutputSchema.safeParse(output).success).toBe(false);
  });

  it("rejects confidence outside 0-100", () => {
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ confidence: 150 })).success).toBe(false);
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ confidence: -1 })).success).toBe(false);
  });

  it("rejects an invalid referencedContent.type", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput({ referencedContent: [{ type: "lead", id: "lead_1", note: "x" }] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid suggestedFormat value", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput({ nextContentRecommendations: [{ label: "x", reason: "x", suggestedFormat: "tiktok", relatedIdeaId: null, relatedInspirationId: null }] }));
    expect(result.success).toBe(false);
  });

  it("rejects a blank string in an observation array", () => {
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ accountObservations: [""] })).success).toBe(false);
  });

  it("rejects an empty string relatedPostId — must be null or a real non-empty id, never an empty placeholder", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: "", relatedIdeaId: null }] }));
    expect(result.success).toBe(false);
  });
});

describe("socialStrategistModelOutputSchema — bounded output", () => {
  it("rejects an observation array exceeding its max length (5)", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput({ accountObservations: Array.from({ length: 6 }, (_, i) => `Observation ${i}`) }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 contentOpportunities", () => {
    const opportunities = Array.from({ length: 11 }, (_, i) => ({ label: `x${i}`, reason: "x", relatedPostId: null, relatedIdeaId: null }));
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ contentOpportunities: opportunities })).success).toBe(false);
  });

  it("rejects more than 6 contentPillars", () => {
    const pillars = Array.from({ length: 7 }, (_, i) => ({ name: `pillar${i}`, rationale: "x" }));
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ contentPillars: pillars })).success).toBe(false);
  });

  it("rejects more than 15 referencedContent entries", () => {
    const references = Array.from({ length: 16 }, (_, i) => ({ type: "post" as const, id: `post_${i}`, note: "x" }));
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ referencedContent: references })).success).toBe(false);
  });

  it("rejects an observation string longer than 280 characters — no unlimited free text", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput({ accountObservations: ["x".repeat(281)] }));
    expect(result.success).toBe(false);
  });

  it("rejects a contentOpportunity label longer than 120 characters", () => {
    const result = socialStrategistModelOutputSchema.safeParse(validOutput({ contentOpportunities: [{ label: "x".repeat(121), reason: "x", relatedPostId: null, relatedIdeaId: null }] }));
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 dataSufficiencyNotes", () => {
    const notes = Array.from({ length: 9 }, (_, i) => `note ${i}`);
    expect(socialStrategistModelOutputSchema.safeParse(validOutput({ dataSufficiencyNotes: notes })).success).toBe(false);
  });
});
