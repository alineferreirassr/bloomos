import { describe, expect, it } from "vitest";
import { buildSocialStrategistContext, SOCIAL_STRATEGIST_CONTEXT_VERSION } from "@/modules/ai/socialStrategist/contextBuilder";
import { makeLead } from "@/modules/leads/testUtils";
import type { SocialStrategistMaterials } from "@/modules/ai/socialStrategist/fetchSocialStrategistContext.server";
import type { SocialPost } from "@/types/socialPost";
import type { SocialPostMetricSnapshot, SocialAccountMetricSnapshot } from "@/types/socialMetricSnapshot";
import type { IdeaItem } from "@/types/ideaItem";
import type { InspirationItem } from "@/types/inspirationItem";
import type { ScriptItem } from "@/types/scriptItem";
import type { CarouselItem } from "@/types/carouselItem";

const NOW = new Date("2026-09-30T12:00:00.000Z");

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "user_1",
    status: "published",
    caption: "Real Amoré Bloom caption",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_acct_1",
    provider_container_id: "container_1",
    provider_post_id: "media_1",
    provider_permalink: "https://instagram.com/p/xyz",
    provider_error: null,
    published_at: "2026-09-01T10:00:00.000Z",
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-09-01T09:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function makePostMetricSnapshot(overrides: Partial<SocialPostMetricSnapshot> = {}): SocialPostMetricSnapshot {
  return {
    id: "snapshot_1",
    workspace_id: "ws_1",
    social_post_id: "post_1",
    provider_media_id: "media_1",
    captured_at: "2026-09-02T00:00:00.000Z",
    snapshot_date: "2026-09-02",
    views: 500,
    reach: 400,
    likes: 50,
    comments: 5,
    shares: 2,
    saved: 3,
    total_interactions: 60,
    raw_metrics: {},
    created_at: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeAccountMetricSnapshot(overrides: Partial<SocialAccountMetricSnapshot> = {}): SocialAccountMetricSnapshot {
  return {
    id: "account_snapshot_1",
    workspace_id: "ws_1",
    instagram_account_id: "ig_acct_1",
    metric_date: "2026-09-02",
    reach: 1000,
    profile_views: 40,
    raw_metrics: {},
    created_at: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeIdea(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea_1",
    workspace_id: "ws_1",
    title: "Behind the scenes reel",
    description: "A description",
    status: "active",
    source_inspiration_id: null,
    content_format: "reel",
    hook: "You won't believe this setup",
    cta: "Book a consult",
    audience: "Engaged couples",
    notes: "internal notes",
    media_asset_id: null,
    priority: "high",
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeInspiration(overrides: Partial<InspirationItem> = {}): InspirationItem {
  return {
    id: "inspiration_1",
    workspace_id: "ws_1",
    title: "Great carousel example",
    source_type: "instagram",
    source_url: "https://instagram.com/p/abc",
    normalized_source_url: "instagram.com/p/abc",
    creator_name: "Some Creator",
    creator_handle: "@somecreator",
    platform_content_id: null,
    content_format: "carousel",
    hook: "Swipe to see the transformation",
    cta: "Save this post",
    why_it_works: "internal notes",
    notes: "internal notes",
    duration_seconds: null,
    published_at: "2026-08-01T00:00:00.000Z",
    media_asset_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeScript(overrides: Partial<ScriptItem> = {}): ScriptItem {
  return { id: "script_1", workspace_id: "ws_1", title: "Venue walkthrough script", status: "active", source_idea_id: null, archived_at: null, created_by: "user_1", created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", ...overrides };
}

function makeCarousel(overrides: Partial<CarouselItem> = {}): CarouselItem {
  return { id: "carousel_1", workspace_id: "ws_1", title: "5 tips carousel", status: "active", source_idea_id: null, archived_at: null, created_by: "user_1", created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z", ...overrides };
}

function makeMaterials(overrides: Partial<SocialStrategistMaterials> = {}): SocialStrategistMaterials {
  return {
    posts: [],
    postMetricsByPostId: new Map(),
    instagramAccountId: null,
    accountMetrics: [],
    ideas: [],
    inspiration: [],
    scripts: [],
    carousels: [],
    instagramLeads: [],
    unavailableCategories: [],
    ...overrides,
  };
}

describe("buildSocialStrategistContext — empty data", () => {
  it("handles an entirely empty workspace gracefully — every list empty, no error, real zero counts", () => {
    const context = buildSocialStrategistContext(makeMaterials(), NOW);

    expect(context.posts).toEqual([]);
    expect(context.topPosts).toEqual([]);
    expect(context.accountMetrics).toBeNull();
    expect(context.ideas).toEqual([]);
    expect(context.inspiration).toEqual([]);
    expect(context.scripts).toEqual([]);
    expect(context.carousels).toEqual([]);
    expect(context.instagramLeads).toEqual([]);
    expect(context.unassignedInstagramLeadCount).toBe(0);
    expect(context.unavailableCategories).toEqual([]);
    expect(context.generatedAt).toBe(NOW.toISOString());
  });

  it("postCountByStatus/instagramLeadCountByStatus are always present with every status key at zero, never omitted", () => {
    const context = buildSocialStrategistContext(makeMaterials(), NOW);
    expect(context.postCountByStatus).toEqual({ draft: 0, scheduled: 0, publishing: 0, published: 0, failed: 0 });
    expect(Object.values(context.instagramLeadCountByStatus).every((count) => count === 0)).toBe(true);
  });
});

describe("buildSocialStrategistContext — partial data", () => {
  it("passes unavailableCategories through unchanged — a failed read is distinct from an empty result", () => {
    const context = buildSocialStrategistContext(makeMaterials({ unavailableCategories: ["postMetrics", "accountMetrics"] }), NOW);
    expect(context.unavailableCategories).toEqual(["postMetrics", "accountMetrics"]);
    // An unavailable category still yields a real, empty (never fabricated) result.
    expect(context.accountMetrics).toBeNull();
  });

  it("a post with no matching snapshot in postMetricsByPostId gets metrics: null, never a fabricated zero", () => {
    const materials = makeMaterials({ posts: [makePost({ id: "post_no_metrics" })], postMetricsByPostId: new Map() });
    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.posts[0].metrics).toBeNull();
  });
});

describe("buildSocialStrategistContext — real analytics fields", () => {
  it("maps a post's real snapshot fields verbatim, never coerced or invented", () => {
    const post = makePost({ id: "post_1" });
    const snapshot = makePostMetricSnapshot({ social_post_id: "post_1", views: 999, reach: 111, likes: 22, comments: 3, shares: 1, saved: 4, total_interactions: 30, snapshot_date: "2026-09-05" });
    const materials = makeMaterials({ posts: [post], postMetricsByPostId: new Map([["post_1", snapshot]]) });

    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.posts[0].metrics).toEqual({ views: 999, reach: 111, likes: 22, comments: 3, shares: 1, saved: 4, totalInteractions: 30, snapshotDate: "2026-09-05" });
  });

  it("preserves a real null metric value as null, never coerced to 0 (Meta's own 'metric absent' semantics)", () => {
    const post = makePost({ id: "post_1" });
    const snapshot = makePostMetricSnapshot({ social_post_id: "post_1", views: null, shares: null });
    const materials = makeMaterials({ posts: [post], postMetricsByPostId: new Map([["post_1", snapshot]]) });

    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.posts[0].metrics?.views).toBeNull();
    expect(context.posts[0].metrics?.shares).toBeNull();
  });

  it("accountMetrics is null when no Instagram account identity exists — never a fabricated zero-reach account", () => {
    const context = buildSocialStrategistContext(makeMaterials({ instagramAccountId: null, accountMetrics: [makeAccountMetricSnapshot()] }), NOW);
    expect(context.accountMetrics).toBeNull();
  });

  it("accountMetrics.latest is null when an account exists but has never synced a snapshot", () => {
    const context = buildSocialStrategistContext(makeMaterials({ instagramAccountId: "ig_acct_1", accountMetrics: [] }), NOW);
    expect(context.accountMetrics).toEqual({ instagramAccountId: "ig_acct_1", latest: null, recentTrend: [] });
  });

  it("accountMetrics.latest picks the most recent metric_date, and recentTrend is sorted newest-first", () => {
    const older = makeAccountMetricSnapshot({ metric_date: "2026-09-01", reach: 100 });
    const newer = makeAccountMetricSnapshot({ metric_date: "2026-09-03", reach: 300 });
    const middle = makeAccountMetricSnapshot({ metric_date: "2026-09-02", reach: 200 });

    const context = buildSocialStrategistContext(makeMaterials({ instagramAccountId: "ig_acct_1", accountMetrics: [older, newer, middle] }), NOW);
    expect(context.accountMetrics?.latest?.metricDate).toBe("2026-09-03");
    expect(context.accountMetrics?.recentTrend.map((point) => point.metricDate)).toEqual(["2026-09-03", "2026-09-02", "2026-09-01"]);
  });

  it("never invents a follower count field — no such key exists anywhere on the account metrics shape", () => {
    const context = buildSocialStrategistContext(makeMaterials({ instagramAccountId: "ig_acct_1", accountMetrics: [makeAccountMetricSnapshot()] }), NOW);
    expect(context.accountMetrics?.latest).not.toHaveProperty("followerCount");
    expect(context.accountMetrics?.latest).not.toHaveProperty("followers");
  });
});

describe("buildSocialStrategistContext — topPosts ranking (derived, real-data-only)", () => {
  it("ranks by total_interactions descending", () => {
    const low = makePost({ id: "post_low", published_at: "2026-09-01T00:00:00.000Z" });
    const high = makePost({ id: "post_high", published_at: "2026-09-02T00:00:00.000Z" });
    const materials = makeMaterials({
      posts: [low, high],
      postMetricsByPostId: new Map([
        ["post_low", makePostMetricSnapshot({ social_post_id: "post_low", total_interactions: 10 })],
        ["post_high", makePostMetricSnapshot({ social_post_id: "post_high", total_interactions: 90 })],
      ]),
    });

    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.topPosts.map((p) => p.postId)).toEqual(["post_high", "post_low"]);
  });

  it("ties on total_interactions break by publishedAt descending", () => {
    const older = makePost({ id: "post_older", published_at: "2026-09-01T00:00:00.000Z" });
    const newer = makePost({ id: "post_newer", published_at: "2026-09-05T00:00:00.000Z" });
    const materials = makeMaterials({
      posts: [older, newer],
      postMetricsByPostId: new Map([
        ["post_older", makePostMetricSnapshot({ social_post_id: "post_older", total_interactions: 50 })],
        ["post_newer", makePostMetricSnapshot({ social_post_id: "post_newer", total_interactions: 50 })],
      ]),
    });

    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.topPosts.map((p) => p.postId)).toEqual(["post_newer", "post_older"]);
  });

  it("never ranks a post with no snapshot or null total_interactions", () => {
    const noSnapshot = makePost({ id: "post_no_snapshot", published_at: "2026-09-01T00:00:00.000Z" });
    const nullTotal = makePost({ id: "post_null_total", published_at: "2026-09-02T00:00:00.000Z" });
    const materials = makeMaterials({
      posts: [noSnapshot, nullTotal],
      postMetricsByPostId: new Map([["post_null_total", makePostMetricSnapshot({ social_post_id: "post_null_total", total_interactions: null })]]),
    });

    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.topPosts).toEqual([]);
  });

  it("never ranks an unpublished (no publishedAt) post even with a real snapshot", () => {
    const draft = makePost({ id: "post_draft", status: "draft", published_at: null });
    const materials = makeMaterials({ posts: [draft], postMetricsByPostId: new Map([["post_draft", makePostMetricSnapshot({ social_post_id: "post_draft", total_interactions: 999 })]]) });

    const context = buildSocialStrategistContext(materials, NOW);
    expect(context.topPosts).toEqual([]);
  });
});

describe("buildSocialStrategistContext — Ideas/Inspiration/Scripts/Carousels summaries", () => {
  it("maps Idea fields correctly, newest first", () => {
    const older = makeIdea({ id: "idea_older", title: "Older idea", created_at: "2026-09-01T00:00:00.000Z" });
    const newer = makeIdea({ id: "idea_newer", title: "Newer idea", created_at: "2026-09-05T00:00:00.000Z" });
    const context = buildSocialStrategistContext(makeMaterials({ ideas: [older, newer] }), NOW);

    expect(context.ideas.map((i) => i.ideaId)).toEqual(["idea_newer", "idea_older"]);
    expect(context.ideas[0]).toMatchObject({ title: "Newer idea", contentFormat: "reel", hook: "You won't believe this setup", cta: "Book a consult", audience: "Engaged couples", priority: "high" });
  });

  it("Idea summary never includes the free-text description/notes fields", () => {
    const context = buildSocialStrategistContext(makeMaterials({ ideas: [makeIdea()] }), NOW);
    expect(context.ideas[0]).not.toHaveProperty("description");
    expect(context.ideas[0]).not.toHaveProperty("notes");
  });

  it("maps Inspiration fields correctly, never the why_it_works/notes free text", () => {
    const context = buildSocialStrategistContext(makeMaterials({ inspiration: [makeInspiration()] }), NOW);
    expect(context.inspiration[0]).toMatchObject({ title: "Great carousel example", sourceType: "instagram", contentFormat: "carousel", hook: "Swipe to see the transformation", cta: "Save this post", creatorHandle: "@somecreator" });
    expect(context.inspiration[0]).not.toHaveProperty("why_it_works");
    expect(context.inspiration[0]).not.toHaveProperty("notes");
  });

  it("maps Script items at the item level only — no version/block content", () => {
    const context = buildSocialStrategistContext(makeMaterials({ scripts: [makeScript()] }), NOW);
    expect(context.scripts[0]).toEqual({ scriptId: "script_1", title: "Venue walkthrough script", status: "active", createdAt: "2026-09-01T00:00:00.000Z" });
  });

  it("maps Carousel items at the item level only — no slide content", () => {
    const context = buildSocialStrategistContext(makeMaterials({ carousels: [makeCarousel()] }), NOW);
    expect(context.carousels[0]).toEqual({ carouselId: "carousel_1", title: "5 tips carousel", status: "active", createdAt: "2026-09-01T00:00:00.000Z" });
  });
});

describe("buildSocialStrategistContext — Instagram Lead filtering & null-safe identity", () => {
  it("maps an Instagram Lead's safe fields, computing hasConversionIdentity/isAssigned deterministically", () => {
    const lead = makeLead({ id: "lead_1", source: "Instagram", status: "new", first_name: null, last_name: null, email: null, instagram: "@curious_bride", assigned_to: null });
    const context = buildSocialStrategistContext(makeMaterials({ instagramLeads: [lead] }), NOW);

    expect(context.instagramLeads[0]).toEqual({ leadId: "lead_1", status: "new", instagramHandle: "@curious_bride", isAssigned: false, hasConversionIdentity: false, createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("hasConversionIdentity is true only once first_name AND last_name AND email are all present", () => {
    const complete = makeLead({ id: "lead_complete", first_name: "Priya", last_name: "Nair", email: "priya@example.com" });
    const missingEmail = makeLead({ id: "lead_missing_email", first_name: "Priya", last_name: "Nair", email: null });
    const context = buildSocialStrategistContext(makeMaterials({ instagramLeads: [complete, missingEmail] }), NOW);

    expect(context.instagramLeads.find((l) => l.leadId === "lead_complete")?.hasConversionIdentity).toBe(true);
    expect(context.instagramLeads.find((l) => l.leadId === "lead_missing_email")?.hasConversionIdentity).toBe(false);
  });

  it("isAssigned reflects assigned_to !== null without ever exposing the assignee's name", () => {
    const lead = makeLead({ id: "lead_assigned", assigned_to: "Aline Ferreira" });
    const context = buildSocialStrategistContext(makeMaterials({ instagramLeads: [lead] }), NOW);
    expect(context.instagramLeads[0].isAssigned).toBe(true);
    expect(JSON.stringify(context.instagramLeads[0])).not.toContain("Aline Ferreira");
  });

  it("unassignedInstagramLeadCount counts only leads with assigned_to === null", () => {
    const context = buildSocialStrategistContext(
      makeMaterials({ instagramLeads: [makeLead({ id: "l1", assigned_to: null }), makeLead({ id: "l2", assigned_to: "Someone" }), makeLead({ id: "l3", assigned_to: null })] }),
      NOW,
    );
    expect(context.unassignedInstagramLeadCount).toBe(2);
  });
});

describe("buildSocialStrategistContext — no raw DM/comment/Lead.message leakage", () => {
  it("a Lead's raw message text never appears anywhere in the built context, even serialized", () => {
    const lead = makeLead({ id: "lead_1", message: "Hi, do you have June 2027 availability? My number is 555-0100.", first_name: "Jane", last_name: "Doe", email: "jane@example.com", phone: "555-0100" });
    const context = buildSocialStrategistContext(makeMaterials({ instagramLeads: [lead] }), NOW);

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("June 2027");
    expect(serialized).not.toContain("555-0100");
    expect(serialized).not.toContain("Jane");
    expect(serialized).not.toContain("Doe");
    expect(serialized).not.toContain("jane@example.com");
  });

  it("the Instagram Lead summary type itself carries no message/first_name/last_name/email/phone key", () => {
    const lead = makeLead({ id: "lead_1" });
    const context = buildSocialStrategistContext(makeMaterials({ instagramLeads: [lead] }), NOW);
    const keys = Object.keys(context.instagramLeads[0]);
    expect(keys).not.toContain("message");
    expect(keys).not.toContain("first_name");
    expect(keys).not.toContain("last_name");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("phone");
    expect(keys.sort()).toEqual(["createdAt", "hasConversionIdentity", "instagramHandle", "isAssigned", "leadId", "status"].sort());
  });
});

describe("buildSocialStrategistContext — deterministic, bounded output", () => {
  it("posts are sorted newest-first and bounded to 50", () => {
    const posts = Array.from({ length: 60 }, (_, i) => makePost({ id: `post_${i}`, created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z` }));
    const context = buildSocialStrategistContext(makeMaterials({ posts }), NOW);
    expect(context.posts.length).toBe(50);
  });

  it("Ideas/Inspiration/Scripts/Carousels are each bounded to 50", () => {
    const ideas = Array.from({ length: 60 }, (_, i) => makeIdea({ id: `idea_${i}` }));
    const inspiration = Array.from({ length: 60 }, (_, i) => makeInspiration({ id: `inspiration_${i}` }));
    const scripts = Array.from({ length: 60 }, (_, i) => makeScript({ id: `script_${i}` }));
    const carousels = Array.from({ length: 60 }, (_, i) => makeCarousel({ id: `carousel_${i}` }));
    const context = buildSocialStrategistContext(makeMaterials({ ideas, inspiration, scripts, carousels }), NOW);

    expect(context.ideas.length).toBe(50);
    expect(context.inspiration.length).toBe(50);
    expect(context.scripts.length).toBe(50);
    expect(context.carousels.length).toBe(50);
  });

  it("Instagram Leads are bounded to 100", () => {
    const leads = Array.from({ length: 120 }, (_, i) => makeLead({ id: `lead_${i}` }));
    const context = buildSocialStrategistContext(makeMaterials({ instagramLeads: leads }), NOW);
    expect(context.instagramLeads.length).toBe(100);
  });

  it("account recentTrend is bounded to 30 points", () => {
    const snapshots = Array.from({ length: 40 }, (_, i) => makeAccountMetricSnapshot({ metric_date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }));
    const context = buildSocialStrategistContext(makeMaterials({ instagramAccountId: "ig_acct_1", accountMetrics: snapshots }), NOW);
    expect(context.accountMetrics?.recentTrend.length).toBe(30);
  });

  it("topPosts is bounded to 5", () => {
    const posts = Array.from({ length: 10 }, (_, i) => makePost({ id: `post_${i}`, published_at: "2026-09-01T00:00:00.000Z" }));
    const snapshots = new Map(posts.map((post, i) => [post.id, makePostMetricSnapshot({ social_post_id: post.id, total_interactions: i })]));
    const context = buildSocialStrategistContext(makeMaterials({ posts, postMetricsByPostId: snapshots }), NOW);
    expect(context.topPosts.length).toBe(5);
  });

  it("calling the builder twice with identical materials produces an identical result (aside from generatedAt) — no hidden randomness/mutation", () => {
    const materials = makeMaterials({ posts: [makePost()], ideas: [makeIdea()], instagramLeads: [makeLead({ id: "lead_1" })] });
    const first = buildSocialStrategistContext(materials, NOW);
    const second = buildSocialStrategistContext(materials, NOW);
    expect(first).toEqual(second);
  });

  it("carries a stable context version constant", () => {
    expect(SOCIAL_STRATEGIST_CONTEXT_VERSION).toBe("social-strategist-context-v1");
  });
});
