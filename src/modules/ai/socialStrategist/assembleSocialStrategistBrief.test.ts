import { describe, expect, it } from "vitest";
import { assembleSocialStrategistBrief } from "@/modules/ai/socialStrategist/assembleSocialStrategistBrief";
import type { SocialStrategistContext, SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";

function emptyContext(overrides: Partial<SocialStrategistContext> = {}): SocialStrategistContext {
  return {
    generatedAt: "2026-09-16T00:00:00.000Z",
    posts: [],
    postCountByStatus: { draft: 0, scheduled: 0, publishing: 0, published: 0, failed: 0 },
    topPosts: [],
    accountMetrics: null,
    ideas: [],
    inspiration: [],
    scripts: [],
    carousels: [],
    instagramLeads: [],
    instagramLeadCountByStatus: { new: 0, contacted: 0, welcome_guide_sent: 0, consultation_scheduled: 0, qualified: 0, proposal_sent: 0, waiting_decision: 0, converted: 0, lost: 0, archived: 0 },
    unassignedInstagramLeadCount: 0,
    unavailableCategories: [],
    ...overrides,
  };
}

function emptyModelOutput(overrides: Partial<SocialStrategistModelOutput> = {}): SocialStrategistModelOutput {
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
    confidence: 0,
    ...overrides,
  };
}

describe("assembleSocialStrategistBrief — no orphaned fields (SOCIAL-14E hardening)", () => {
  it("returns exactly the fields SocialStrategistView actually renders — no dead/unconsumed output", () => {
    const brief = assembleSocialStrategistBrief(emptyModelOutput(), emptyContext());
    expect(Object.keys(brief).sort()).toEqual(
      [
        "accountObservations",
        "audienceObservations",
        "confidence",
        "contentOpportunities",
        "contentPillars",
        "conversionObservations",
        "dataGaps",
        "isEmpty",
        "nextContentRecommendations",
        "postingStrategyNotes",
        "referencedContent",
        "unavailableCategories",
      ].sort(),
    );
  });

  it("resolves a contentOpportunity's relatedPostId against the real context, exposing the post's own caption as its title", () => {
    const context = emptyContext({ posts: [{ postId: "post_1", status: "published", caption: "Behind the scenes reel", publishedAt: "2026-09-01T00:00:00.000Z", scheduledAt: null, createdAt: "2026-09-01T00:00:00.000Z", metrics: null }] });
    const brief = assembleSocialStrategistBrief(emptyModelOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: "post_1", relatedIdeaId: null }] }), context);
    expect(brief.contentOpportunities[0].relatedPost).toEqual({ id: "post_1", title: "Behind the scenes reel", href: "/social" });
  });

  it("marks isEmpty true only when every observation/opportunity/pillar/recommendation/reference array is empty", () => {
    const empty = assembleSocialStrategistBrief(emptyModelOutput(), emptyContext());
    expect(empty.isEmpty).toBe(true);

    const populated = assembleSocialStrategistBrief(emptyModelOutput({ accountObservations: ["Reach was 100."] }), emptyContext());
    expect(populated.isEmpty).toBe(false);
  });
});
