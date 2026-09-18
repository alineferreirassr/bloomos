import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getSocialPostByProviderPostId: vi.fn(),
}));

import { resolveSocialPostForInstagramComment } from "@/core/social/resolveSocialPostForInstagramComment";
import { getSocialPostByProviderPostId } from "@/lib/data";
import type { InstagramComment } from "@/types/instagramComment";
import type { SocialPost } from "@/types/socialPost";

function makeComment(overrides: Partial<InstagramComment> = {}): InstagramComment {
  return {
    id: "comment_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_comment_id: "external_c1",
    external_media_id: "meta_media_123",
    parent_external_comment_id: null,
    external_author_id: "author_1",
    external_author_username: "a_follower",
    content: "Beautiful!",
    status: "active",
    external_created_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("resolveSocialPostForInstagramComment — SOCIAL-15B Post<->Comment read-time join", () => {
  it("resolves the exact Social Post whose provider_post_id matches the comment's external_media_id", async () => {
    const post = makePost();
    vi.mocked(getSocialPostByProviderPostId).mockResolvedValue(post);

    const result = await resolveSocialPostForInstagramComment(makeComment());

    expect(result).toEqual(post);
    expect(getSocialPostByProviderPostId).toHaveBeenCalledWith("ws_1", "meta_media_123");
  });

  it("always scopes the lookup by the comment's own workspace_id, never a caller-supplied one — there is no parameter to override it", async () => {
    vi.mocked(getSocialPostByProviderPostId).mockResolvedValue(null);
    await resolveSocialPostForInstagramComment(makeComment({ workspace_id: "ws_other" }));
    expect(getSocialPostByProviderPostId).toHaveBeenCalledWith("ws_other", "meta_media_123");
  });

  it("returns null without querying at all when the comment carries no external_media_id", async () => {
    const result = await resolveSocialPostForInstagramComment(makeComment({ external_media_id: null }));
    expect(result).toBeNull();
    expect(getSocialPostByProviderPostId).not.toHaveBeenCalled();
  });

  it("returns null when the repository finds no matching post (e.g. it belongs to a different workspace)", async () => {
    vi.mocked(getSocialPostByProviderPostId).mockResolvedValue(null);
    const result = await resolveSocialPostForInstagramComment(makeComment());
    expect(result).toBeNull();
  });

  it("never uses timestamp, username, or text similarity to resolve a match — only the single repository call keyed on the exact id pair", async () => {
    vi.mocked(getSocialPostByProviderPostId).mockResolvedValue(makePost());
    await resolveSocialPostForInstagramComment(makeComment({ external_author_username: "totally_unrelated_handle", content: "no relation to any post caption" }));
    expect(getSocialPostByProviderPostId).toHaveBeenCalledTimes(1);
    expect(getSocialPostByProviderPostId).toHaveBeenCalledWith("ws_1", "meta_media_123");
  });
});
