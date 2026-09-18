import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getSocialPost: vi.fn(),
}));

import { resolveLeadAttribution } from "@/modules/socialAttribution/resolveLeadAttribution";
import { getSocialPost } from "@/lib/data";
import { makeLead } from "@/modules/leads/testUtils";
import type { SocialPost } from "@/types/socialPost";

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: null,
    status: "published",
    caption: "Behind the scenes",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_account_1",
    provider_container_id: null,
    provider_post_id: "meta_media_123",
    provider_permalink: null,
    provider_error: null,
    published_at: "2026-09-01T00:00:00.000Z",
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveLeadAttribution", () => {
  it("resolves a social_post_id-attributed Lead to its real Social Post caption", async () => {
    vi.mocked(getSocialPost).mockResolvedValue(makePost());
    const lead = makeLead({ social_post_id: "post_1", instagram_comment_id: "comment_1" });

    const result = await resolveLeadAttribution(lead);

    expect(result).toEqual({
      kind: "social_post",
      socialPost: { id: "post_1", caption: "Behind the scenes" },
      comment: { id: "comment_1" },
      conversation: null,
    });
  });

  it("degrades gracefully to socialPost: null when the stored id no longer resolves — never crashes the page", async () => {
    vi.mocked(getSocialPost).mockRejectedValue(new Error("Social post post_1 was not found"));
    const lead = makeLead({ social_post_id: "post_1" });

    const result = await resolveLeadAttribution(lead);

    expect(result.kind).toBe("social_post");
    expect(result.socialPost).toBeNull();
  });

  it("resolves a comment-only attribution (no resolvable post) without ever calling getSocialPost", async () => {
    const lead = makeLead({ social_post_id: null, instagram_comment_id: "comment_1" });
    const result = await resolveLeadAttribution(lead);

    expect(result).toEqual({ kind: "instagram_comment", socialPost: null, comment: { id: "comment_1" }, conversation: null });
    expect(getSocialPost).not.toHaveBeenCalled();
  });

  it("resolves a DM attribution — never attaches a social_post_id or comment", async () => {
    const lead = makeLead({ instagram_conversation_id: "conversation_1" });
    const result = await resolveLeadAttribution(lead);

    expect(result).toEqual({ kind: "instagram_conversation", socialPost: null, comment: null, conversation: { id: "conversation_1" } });
    expect(getSocialPost).not.toHaveBeenCalled();
  });

  it("resolves 'none' for a Lead with no attribution at all", async () => {
    const lead = makeLead();
    const result = await resolveLeadAttribution(lead);

    expect(result).toEqual({ kind: "none", socialPost: null, comment: null, conversation: null });
  });

  it("never exposes comment/conversation content — only ids", async () => {
    const lead = makeLead({ instagram_comment_id: "comment_1" });
    const result = await resolveLeadAttribution(lead);

    expect(result.comment).toEqual({ id: "comment_1" });
    expect(JSON.stringify(result)).not.toMatch(/content|message|username/i);
  });
});
