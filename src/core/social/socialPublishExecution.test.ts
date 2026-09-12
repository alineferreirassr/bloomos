import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSocialPostPublish, type SocialPublishPersistence } from "@/core/social/socialPublishExecution";
import type { SocialPost } from "@/types/socialPost";
import type { DataResult } from "@/lib/data/result";

const ACCESS_TOKEN = "fake-ig-access-token-should-never-leak";

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "user_1",
    status: "publishing",
    caption: "Hello!",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_1",
    provider_container_id: null,
    provider_post_id: null,
    provider_permalink: null,
    provider_error: null,
    published_at: null,
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePersistence(post: SocialPost): SocialPublishPersistence & { setContainerId: ReturnType<typeof vi.fn>; markPublished: ReturnType<typeof vi.fn>; markFailed: ReturnType<typeof vi.fn> } {
  let current = post;
  return {
    setContainerId: vi.fn(async (containerId: string): Promise<DataResult<SocialPost>> => {
      current = { ...current, provider_container_id: containerId };
      return { success: true, data: current };
    }),
    markPublished: vi.fn(async (result: { providerPostId: string; providerPermalink: string | null }): Promise<DataResult<SocialPost>> => {
      current = { ...current, status: "published", provider_post_id: result.providerPostId, provider_permalink: result.providerPermalink };
      return { success: true, data: current };
    }),
    markFailed: vi.fn(async ({ message }: { message: string; retryable: boolean }): Promise<DataResult<SocialPost>> => {
      current = { ...current, status: "failed", provider_error: message };
      return { success: true, data: current };
    }),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL) => {
      const path = input.pathname;
      if (path.endsWith("/media")) return new Response(JSON.stringify({ id: "container_new" }), { status: 200 });
      if (path.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "ig_media_1" }), { status: 200 });
      return new Response(JSON.stringify({ permalink: "https://instagram.com/p/abc123" }), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("executeSocialPostPublish", () => {
  it("creates a container, persists it, publishes, fetches the permalink, and marks published", async () => {
    const post = makePost();
    const persistence = makePersistence(post);

    const result = await executeSocialPostPublish({ post, accessToken: ACCESS_TOKEN, imageUrl: "https://signed.example/image.jpg", persistence });

    expect(result.success).toBe(true);
    expect(persistence.setContainerId).toHaveBeenCalledWith("container_new");
    expect(persistence.markPublished).toHaveBeenCalledWith({ providerPostId: "ig_media_1", providerPermalink: "https://instagram.com/p/abc123" });
    expect(persistence.markFailed).not.toHaveBeenCalled();
  });

  it("SOCIAL-04A Phase 18 — refuses to republish when the post already carries a container id, to avoid a duplicate Instagram publication", async () => {
    const post = makePost({ provider_container_id: "container_from_a_prior_abandoned_attempt" });
    const persistence = makePersistence(post);
    const fetchSpy = vi.mocked(fetch);

    const result = await executeSocialPostPublish({ post, accessToken: ACCESS_TOKEN, imageUrl: "https://signed.example/image.jpg", persistence });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.category).toBe("unsafe_retry");
    expect(result.failure.retryable).toBe(false);
    expect(persistence.markFailed).toHaveBeenCalledWith({ message: expect.stringMatching(/manual review/i), retryable: false });
    expect(fetchSpy).not.toHaveBeenCalled(); // never even attempts a second Graph API call
  });

  it("classifies a Meta 5xx as retryable and never leaks the access token in the persisted/returned message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_new" }), { status: 200 });
        return new Response(`upstream failure for token ${ACCESS_TOKEN}`, { status: 503 });
      }),
    );
    const post = makePost();
    const persistence = makePersistence(post);

    const result = await executeSocialPostPublish({ post, accessToken: ACCESS_TOKEN, imageUrl: "https://signed.example/image.jpg", persistence });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.retryable).toBe(true);
    expect(result.failure.category).toBe("provider_unavailable");
    expect(result.failure.message).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
  });

  it("classifies a Meta rate-limit error as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_new" }), { status: 200 });
        return new Response('{"error":{"code":32,"message":"Page request limit reached"}}', { status: 429 });
      }),
    );
    const post = makePost();
    const persistence = makePersistence(post);

    const result = await executeSocialPostPublish({ post, accessToken: ACCESS_TOKEN, imageUrl: "https://signed.example/image.jpg", persistence });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.retryable).toBe(true);
    expect(result.failure.category).toBe("rate_limit");
  });

  it("classifies an invalid-token error as a non-retryable auth failure, persisting the generic RECONNECT_ERROR message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_new" }), { status: 200 });
        return new Response('{"error":{"code":190,"message":"Error validating access token"}}', { status: 401 });
      }),
    );
    const post = makePost();
    const persistence = makePersistence(post);

    const result = await executeSocialPostPublish({ post, accessToken: ACCESS_TOKEN, imageUrl: "https://signed.example/image.jpg", persistence });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.retryable).toBe(false);
    expect(result.failure.isAuthError).toBe(true);
    expect(result.failure.message).toBe("Reconnect Meta to enable publishing.");
  });

  it("a persistence failure while marking published surfaces as a failure without a duplicate markFailed call", async () => {
    const post = makePost();
    const persistence = makePersistence(post);
    persistence.markPublished.mockResolvedValueOnce({ success: false, error: "Could not update the social post." });

    const result = await executeSocialPostPublish({ post, accessToken: ACCESS_TOKEN, imageUrl: "https://signed.example/image.jpg", persistence });

    expect(result.success).toBe(false);
    expect(persistence.markFailed).not.toHaveBeenCalled();
  });
});
