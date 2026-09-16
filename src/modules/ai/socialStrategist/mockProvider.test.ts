import { describe, expect, it } from "vitest";
import { createSocialStrategistMockProvider } from "@/modules/ai/socialStrategist/mockProvider";
import { socialStrategistModelOutputSchema } from "@/modules/ai/socialStrategist/schema";
import { validateSocialStrategistSemantics } from "@/modules/ai/socialStrategist/semanticValidation";
import type { SocialStrategistContext, SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";
import type { AICompletionRequest } from "@/core/ai/types";

function emptyContext(overrides: Partial<SocialStrategistContext> = {}): SocialStrategistContext {
  return {
    generatedAt: "2026-09-01T00:00:00.000Z",
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

function requestWithContext(context: SocialStrategistContext | undefined): AICompletionRequest {
  return {
    conversation: { id: "conv_1", workspaceId: "ws_1", context: { workspaceId: "ws_1", ownerType: "event", ownerId: "ws_1", facts: { socialStrategistContext: context } }, messages: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
    prompt: { role: "user", content: "x" },
  };
}

async function completeAndParse(context: SocialStrategistContext | undefined): Promise<SocialStrategistModelOutput> {
  const provider = createSocialStrategistMockProvider();
  const completion = await provider.complete(requestWithContext(context));
  return JSON.parse(completion.content) as SocialStrategistModelOutput;
}

describe("createSocialStrategistMockProvider — absence of data", () => {
  it("returns a well-formed, honest empty output when no context is supplied at all", async () => {
    const output = await completeAndParse(undefined);
    expect(socialStrategistModelOutputSchema.safeParse(output).success).toBe(true);
    expect(output.confidence).toBe(0);
    expect(output.dataSufficiencyNotes.length).toBeGreaterThan(0);
  });

  it("returns an honest empty output for an entirely empty workspace, with dataSufficiencyNotes explaining why", async () => {
    const output = await completeAndParse(emptyContext());
    expect(output.accountObservations).toEqual([]);
    expect(output.contentOpportunities).toEqual([]);
    expect(output.conversionObservations).toEqual([]);
    expect(output.dataSufficiencyNotes.some((note) => note.includes("No Social posts"))).toBe(true);
    expect(output.dataSufficiencyNotes.some((note) => note.includes("Instagram account"))).toBe(true);
    expect(output.dataSufficiencyNotes.some((note) => note.includes("Instagram-sourced Leads"))).toBe(true);
  });

  it("the empty-context output passes both schema and semantic validation", async () => {
    const context = emptyContext();
    const output = await completeAndParse(context);
    expect(socialStrategistModelOutputSchema.safeParse(output).success).toBe(true);
    expect(validateSocialStrategistSemantics(output, context).success).toBe(true);
  });
});

describe("createSocialStrategistMockProvider — partial data", () => {
  it("surfaces an unavailableCategories entry as its own dataSufficiencyNotes line", async () => {
    const output = await completeAndParse(emptyContext({ unavailableCategories: ["ideas", "accountMetrics"] }));
    expect(output.dataSufficiencyNotes.some((note) => note.includes('"ideas"'))).toBe(true);
    expect(output.dataSufficiencyNotes.some((note) => note.includes('"accountMetrics"'))).toBe(true);
  });

  it("produces real observations for posts even when Ideas/Inspiration are empty", async () => {
    const context = emptyContext({ posts: [{ postId: "post_1", status: "published", caption: "x", publishedAt: "2026-09-01T00:00:00.000Z", scheduledAt: null, createdAt: "2026-09-01T00:00:00.000Z", metrics: null }], postCountByStatus: { draft: 0, scheduled: 0, publishing: 0, published: 1, failed: 0 } });
    const output = await completeAndParse(context);
    expect(output.accountObservations.some((o) => o.includes("1 of 1"))).toBe(true);
  });
});

describe("createSocialStrategistMockProvider — analytics null-safe", () => {
  it("never claims account metrics when accountMetrics is null", async () => {
    const output = await completeAndParse(emptyContext({ accountMetrics: null }));
    expect(output.accountObservations.some((o) => o.toLowerCase().includes("reach") || o.toLowerCase().includes("profile view"))).toBe(false);
  });

  it("reports a real reach/profileViews value verbatim when present, never a fabricated number", async () => {
    const context = emptyContext({ accountMetrics: { instagramAccountId: "ig_1", latest: { metricDate: "2026-09-05", reach: 4321, profileViews: 12 }, recentTrend: [] } });
    const output = await completeAndParse(context);
    expect(output.accountObservations.some((o) => o.includes("4321"))).toBe(true);
    expect(output.accountObservations.some((o) => o.includes("12"))).toBe(true);
  });

  it("omits a reach/profileViews claim when the value is null even though accountMetrics itself exists", async () => {
    const context = emptyContext({ accountMetrics: { instagramAccountId: "ig_1", latest: { metricDate: "2026-09-05", reach: null, profileViews: null }, recentTrend: [] } });
    const output = await completeAndParse(context);
    expect(output.accountObservations.some((o) => o.toLowerCase().includes("reach"))).toBe(false);
  });
});

describe("createSocialStrategistMockProvider — no fabricated metrics, no follower/format/trend invention", () => {
  it("never mentions a follower count anywhere in the output", async () => {
    const output = await completeAndParse(emptyContext({ accountMetrics: { instagramAccountId: "ig_1", latest: { metricDate: "2026-09-05", reach: 100, profileViews: 5 }, recentTrend: [] } }));
    const serialized = JSON.stringify(output).toLowerCase();
    expect(serialized).not.toContain("follower");
  });

  it("content pillars are derived only from real Idea content_format counts, never invented categories", async () => {
    const context = emptyContext({
      ideas: [
        { ideaId: "idea_1", title: "x", status: "active", contentFormat: "reel", hook: null, cta: null, audience: null, priority: null, createdAt: "2026-09-01T00:00:00.000Z" },
        { ideaId: "idea_2", title: "y", status: "active", contentFormat: "reel", hook: null, cta: null, audience: null, priority: null, createdAt: "2026-09-01T00:00:00.000Z" },
      ],
    });
    const output = await completeAndParse(context);
    expect(output.contentPillars).toEqual([{ name: "reel", rationale: "2 Idea(s) already planned in this format." }]);
  });

  it("every contentOpportunity's relatedPostId is a real id from topPosts, never fabricated", async () => {
    const context = emptyContext({ topPosts: [{ postId: "post_real_1", publishedAt: "2026-09-01T00:00:00.000Z", totalInteractions: 50 }] });
    const output = await completeAndParse(context);
    expect(output.contentOpportunities.every((o) => o.relatedPostId === "post_real_1")).toBe(true);
  });
});

describe("createSocialStrategistMockProvider — no PII / no raw Instagram comment/DM/Lead.message leakage", () => {
  it("the entire serialized output never contains any string beyond the context's own safe fields — no first_name/last_name/email/phone/message keys or values could exist since the context itself never carries them", async () => {
    const context = emptyContext({
      instagramLeads: [{ leadId: "lead_1", status: "new", instagramHandle: "@curious_bride", isAssigned: false, hasConversionIdentity: false, createdAt: "2026-09-01T00:00:00.000Z" }],
    });
    const output = await completeAndParse(context);
    const serialized = JSON.stringify(output);
    // Structural guarantee: SocialStrategistContext (SOCIAL-14B) never carries
    // these fields at all, so this mock — which only ever reads off `context`
    // — cannot leak them regardless of what it does with the data.
    expect(serialized).not.toContain("@example.com");
    expect(serialized.toLowerCase()).not.toContain("phone");
  });

  it("conversion observations reference only real Lead counts, never a specific Lead's identity", async () => {
    const context = emptyContext({
      instagramLeads: [
        { leadId: "lead_1", status: "new", instagramHandle: "@a", isAssigned: false, hasConversionIdentity: false, createdAt: "2026-09-01T00:00:00.000Z" },
        { leadId: "lead_2", status: "new", instagramHandle: "@b", isAssigned: true, hasConversionIdentity: true, createdAt: "2026-09-01T00:00:00.000Z" },
      ],
      unassignedInstagramLeadCount: 1,
    });
    const output = await completeAndParse(context);
    expect(output.conversionObservations).toEqual(["2 Instagram-sourced Lead(s) tracked; 1 currently unassigned."]);
  });
});

describe("createSocialStrategistMockProvider — determinism", () => {
  it("calling complete() twice with the same context produces byte-identical output", async () => {
    const context = emptyContext({ posts: [{ postId: "post_1", status: "published", caption: "x", publishedAt: "2026-09-01T00:00:00.000Z", scheduledAt: null, createdAt: "2026-09-01T00:00:00.000Z", metrics: null }] });
    const first = await completeAndParse(context);
    const second = await completeAndParse(context);
    expect(first).toEqual(second);
  });

  it("every real, populated output always passes semantic validation against its own source context", async () => {
    const context = emptyContext({
      // topPosts is always a subset of posts in a real context (that's the
      // real builder's own invariant, SOCIAL-14B) — this fixture keeps both
      // consistent rather than constructing a state the real pipeline never
      // produces.
      posts: [{ postId: "post_1", status: "published", caption: "x", publishedAt: "2026-09-01T00:00:00.000Z", scheduledAt: null, createdAt: "2026-09-01T00:00:00.000Z", metrics: { views: null, reach: null, likes: null, comments: null, shares: null, saved: null, totalInteractions: 10, snapshotDate: "2026-09-01" } }],
      topPosts: [{ postId: "post_1", publishedAt: "2026-09-01T00:00:00.000Z", totalInteractions: 10 }],
      ideas: [{ ideaId: "idea_1", title: "x", status: "active", contentFormat: "reel", hook: null, cta: null, audience: "Engaged couples", priority: null, createdAt: "2026-09-01T00:00:00.000Z" }],
    });
    const output = await completeAndParse(context);
    expect(validateSocialStrategistSemantics(output, context).success).toBe(true);
  });
});
