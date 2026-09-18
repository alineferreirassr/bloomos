import { afterEach, describe, expect, it } from "vitest";
import { mockSocialPostsRepository } from "@/lib/data/socialPosts/mockRepository";
import { resetSocialPostsStore, writeSocialPosts } from "@/lib/data/mock/socialPostsStore";
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
  resetSocialPostsStore();
});

describe("mockSocialPostsRepository.getSocialPostByProviderPostId — SOCIAL-15B", () => {
  it("resolves a Social Post by exact provider_post_id equality within the same workspace", async () => {
    writeSocialPosts([makePost()]);
    const result = await mockSocialPostsRepository.getSocialPostByProviderPostId("ws_1", "meta_media_123");
    expect(result?.id).toBe("post_1");
  });

  it("returns null when no post has that exact provider_post_id", async () => {
    writeSocialPosts([makePost()]);
    const result = await mockSocialPostsRepository.getSocialPostByProviderPostId("ws_1", "meta_media_does_not_exist");
    expect(result).toBeNull();
  });

  it("never resolves a matching provider_post_id from a different workspace", async () => {
    writeSocialPosts([makePost({ id: "post_ws2", workspace_id: "ws_2", provider_post_id: "meta_media_123" })]);
    const result = await mockSocialPostsRepository.getSocialPostByProviderPostId("ws_1", "meta_media_123");
    expect(result).toBeNull();
  });

  it("returns the correct post when the same provider_post_id exists in two different workspaces (id equality alone is not enough — workspace must match too)", async () => {
    writeSocialPosts([makePost({ id: "post_ws1", workspace_id: "ws_1", provider_post_id: "meta_media_shared" }), makePost({ id: "post_ws2", workspace_id: "ws_2", provider_post_id: "meta_media_shared" })]);
    const result = await mockSocialPostsRepository.getSocialPostByProviderPostId("ws_1", "meta_media_shared");
    expect(result?.id).toBe("post_ws1");
  });
});
