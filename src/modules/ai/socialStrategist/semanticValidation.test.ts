import { describe, expect, it } from "vitest";
import { validateSocialStrategistSemantics } from "@/modules/ai/socialStrategist/semanticValidation";
import type { SocialStrategistContext, SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";

function makeContext(overrides: Partial<SocialStrategistContext> = {}): SocialStrategistContext {
  return {
    generatedAt: "2026-09-01T00:00:00.000Z",
    posts: [{ postId: "post_1", status: "published", caption: "x", publishedAt: "2026-09-01T00:00:00.000Z", scheduledAt: null, createdAt: "2026-09-01T00:00:00.000Z", metrics: null }],
    postCountByStatus: { draft: 0, scheduled: 0, publishing: 0, published: 1, failed: 0 },
    topPosts: [],
    accountMetrics: null,
    ideas: [{ ideaId: "idea_1", title: "x", status: "active", contentFormat: null, hook: null, cta: null, audience: null, priority: null, createdAt: "2026-09-01T00:00:00.000Z" }],
    inspiration: [{ inspirationId: "insp_1", title: "x", sourceType: "instagram", contentFormat: null, hook: null, cta: null, creatorHandle: null, createdAt: "2026-09-01T00:00:00.000Z" }],
    scripts: [{ scriptId: "script_1", title: "x", status: "active", createdAt: "2026-09-01T00:00:00.000Z" }],
    carousels: [{ carouselId: "carousel_1", title: "x", status: "active", createdAt: "2026-09-01T00:00:00.000Z" }],
    instagramLeads: [],
    instagramLeadCountByStatus: { new: 0, contacted: 0, welcome_guide_sent: 0, consultation_scheduled: 0, qualified: 0, proposal_sent: 0, waiting_decision: 0, converted: 0, lost: 0, archived: 0 },
    unassignedInstagramLeadCount: 0,
    unavailableCategories: [],
    ...overrides,
  };
}

function makeOutput(overrides: Partial<SocialStrategistModelOutput> = {}): SocialStrategistModelOutput {
  return {
    accountObservations: [],
    contentOpportunities: [],
    contentPillars: [],
    nextContentRecommendations: [],
    postingStrategyNotes: [],
    audienceObservations: [],
    referencedContent: [],
    conversionObservations: [],
    dataSufficiencyNotes: [],
    confidence: 50,
    ...overrides,
  };
}

describe("validateSocialStrategistSemantics — real references accepted", () => {
  it("accepts a contentOpportunity referencing a real postId", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: "post_1", relatedIdeaId: null }] }), makeContext());
    expect(result.success).toBe(true);
  });

  it("accepts null relatedPostId/relatedIdeaId — no reference to check", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: null, relatedIdeaId: null }] }), makeContext());
    expect(result.success).toBe(true);
  });

  it("accepts a nextContentRecommendation referencing a real ideaId and inspirationId", () => {
    const result = validateSocialStrategistSemantics(
      makeOutput({ nextContentRecommendations: [{ label: "x", reason: "x", suggestedFormat: null, relatedIdeaId: "idea_1", relatedInspirationId: "insp_1" }] }),
      makeContext(),
    );
    expect(result.success).toBe(true);
  });

  it("accepts referencedContent for every real content type (post/idea/inspiration/script/carousel)", () => {
    const result = validateSocialStrategistSemantics(
      makeOutput({
        referencedContent: [
          { type: "post", id: "post_1", note: "x" },
          { type: "idea", id: "idea_1", note: "x" },
          { type: "inspiration", id: "insp_1", note: "x" },
          { type: "script", id: "script_1", note: "x" },
          { type: "carousel", id: "carousel_1", note: "x" },
        ],
      }),
      makeContext(),
    );
    expect(result.success).toBe(true);
  });
});

describe("validateSocialStrategistSemantics — invented references rejected", () => {
  it("rejects a contentOpportunity referencing a post id that doesn't exist", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: "post_does_not_exist", relatedIdeaId: null }] }), makeContext());
    expect(result.success).toBe(false);
  });

  it("rejects a contentOpportunity referencing an idea id that doesn't exist", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: null, relatedIdeaId: "idea_does_not_exist" }] }), makeContext());
    expect(result.success).toBe(false);
  });

  it("rejects a nextContentRecommendation referencing an inspiration id that doesn't exist", () => {
    const result = validateSocialStrategistSemantics(
      makeOutput({ nextContentRecommendations: [{ label: "x", reason: "x", suggestedFormat: null, relatedIdeaId: null, relatedInspirationId: "insp_does_not_exist" }] }),
      makeContext(),
    );
    expect(result.success).toBe(false);
  });

  it("rejects referencedContent pointing at a real id but the wrong type (e.g. an idea id claimed as a post)", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ referencedContent: [{ type: "post", id: "idea_1", note: "x" }] }), makeContext());
    expect(result.success).toBe(false);
  });

  it("rejects referencedContent for an entirely fabricated id", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ referencedContent: [{ type: "carousel", id: "carousel_does_not_exist", note: "x" }] }), makeContext());
    expect(result.success).toBe(false);
  });

  it("rejects a reference into an empty context — no posts exist, so any relatedPostId is invented", () => {
    const result = validateSocialStrategistSemantics(makeOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: "post_1", relatedIdeaId: null }] }), makeContext({ posts: [] }));
    expect(result.success).toBe(false);
  });
});
