import { afterEach, describe, expect, it } from "vitest";
import {
  createSocialPost,
  updateSocialPostDraft,
  beginSocialPostPublish,
  setSocialPostContainerId,
  markSocialPostPublished,
  markSocialPostFailed,
  scheduleSocialPost,
  rescheduleSocialPost,
  cancelSocialPostSchedule,
  listSocialPosts,
  getSocialPost,
  uploadMediaAsset,
  setMediaAssetStatus,
} from "@/lib/data";
import { resetSocialPostsStore } from "@/lib/data/mock/socialPostsStore";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

async function makeApprovedImageAsset(): Promise<string> {
  const uploaded = await uploadMediaAsset({
    ownerType: "workspace",
    ownerId: CURRENT_WORKSPACE_ID,
    file: makeFile("fake-jpeg-bytes", "post.jpg", "image/jpeg"),
    originalFilename: "post.jpg",
  });
  if (!uploaded.success) throw new Error(`setup failed: ${JSON.stringify(uploaded.error)}`);
  const approved = await setMediaAssetStatus(uploaded.data.id, "approved", "member_1");
  if (!approved.success) throw new Error(`setup failed: ${JSON.stringify(approved.error)}`);
  return uploaded.data.id;
}

async function makePost(overrides: Partial<{ caption: string; assetId: string }> = {}) {
  const assetId = overrides.assetId ?? (await makeApprovedImageAsset());
  const created = await createSocialPost({
    workspaceId: CURRENT_WORKSPACE_ID,
    createdBy: "user_1",
    caption: overrides.caption ?? "Hello from Amoré Bloom!",
    assetId,
    connectionId: "conn_meta_1",
    pageId: "page_1",
    instagramAccountId: "ig_1",
  });
  if (!created.success) throw new Error(`setup failed: ${JSON.stringify(created.error)}`);
  return created.data;
}

afterEach(() => {
  resetSocialPostsStore();
  resetMediaAssetsStore();
});

describe("createSocialPost", () => {
  it("creates a draft post with the exact captured target identity", async () => {
    const post = await makePost({ caption: "New collection is live." });
    expect(post.status).toBe("draft");
    expect(post.caption).toBe("New collection is live.");
    expect(post.target_provider).toBe("meta");
    expect(post.target_connection_id).toBe("conn_meta_1");
    expect(post.target_page_id).toBe("page_1");
    expect(post.target_instagram_account_id).toBe("ig_1");
    expect(post.provider_container_id).toBeNull();
    expect(post.provider_post_id).toBeNull();
    expect(post.published_at).toBeNull();
  });

  it("rejects a caption over 2,200 characters", async () => {
    const assetId = await makeApprovedImageAsset();
    const result = await createSocialPost({
      workspaceId: CURRENT_WORKSPACE_ID,
      createdBy: "user_1",
      caption: "x".repeat(2201),
      assetId,
      connectionId: "conn_meta_1",
      pageId: "page_1",
      instagramAccountId: "ig_1",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateSocialPostDraft", () => {
  it("updates caption/asset while the post is still a draft", async () => {
    const post = await makePost();
    const newAssetId = await makeApprovedImageAsset();
    const result = await updateSocialPostDraft(post.id, { caption: "Edited caption.", assetId: newAssetId });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.caption).toBe("Edited caption.");
    expect(result.data.asset_id).toBe(newAssetId);
  });

  it("refuses to edit a post that is no longer a draft", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    const result = await updateSocialPostDraft(post.id, { caption: "Too late." });
    expect(result.success).toBe(false);
  });
});

describe("beginSocialPostPublish — idempotency guard", () => {
  it("transitions a draft to publishing", async () => {
    const post = await makePost();
    const result = await beginSocialPostPublish(post.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("publishing");
  });

  it("rejects a second concurrent/duplicate publish attempt on the same post — the real double-click guard", async () => {
    const post = await makePost();
    const first = await beginSocialPostPublish(post.id);
    expect(first.success).toBe(true);

    const second = await beginSocialPostPublish(post.id);
    expect(second.success).toBe(false);
  });

  it("allows retrying a failed post (failed -> publishing)", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    await markSocialPostFailed(post.id, "Reconnect Meta to enable publishing.");

    const retry = await beginSocialPostPublish(post.id);
    expect(retry.success).toBe(true);
    if (!retry.success) return;
    expect(retry.data.status).toBe("publishing");
    expect(retry.data.provider_error).toBeNull();
  });

  it("refuses to re-publish an already-published post", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    await markSocialPostPublished(post.id, { providerPostId: "ig_media_1", providerPermalink: "https://instagram.com/p/abc123" });

    const result = await beginSocialPostPublish(post.id);
    expect(result.success).toBe(false);
  });

  it("SOCIAL-04B — claims a scheduled post exactly like a draft/failed one (scheduled -> publishing)", async () => {
    const post = await makePost();
    await scheduleSocialPost(post.id, { scheduledAt: "2099-01-01T00:00:00.000Z", scheduledTimezone: "UTC" });

    const result = await beginSocialPostPublish(post.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("publishing");
  });

  it("SOCIAL-04B — manual-vs-scheduled race: two concurrent claims on the same post, exactly one wins", async () => {
    const post = await makePost();
    await scheduleSocialPost(post.id, { scheduledAt: "2099-01-01T00:00:00.000Z", scheduledTimezone: "UTC" });

    const [first, second] = await Promise.all([beginSocialPostPublish(post.id), beginSocialPostPublish(post.id)]);
    const outcomes = [first.success, second.success];
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(outcomes.filter((success) => !success)).toHaveLength(1);
  });
});

describe("scheduleSocialPost", () => {
  it("schedules a draft post, capturing the execution instant and display timezone", async () => {
    const post = await makePost();
    const result = await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: "America/New_York" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("scheduled");
    expect(result.data.scheduled_at).toBe("2099-06-01T15:00:00.000Z");
    expect(result.data.scheduled_timezone).toBe("America/New_York");
  });

  it("never generates or stores a signed asset URL", async () => {
    const post = await makePost();
    const result = await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: null });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/signed|token=/i);
  });

  it("schedules a failed post too, resetting publish_attempts and clearing provider_error for a fresh attempt cycle", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    await markSocialPostFailed(post.id, "Reconnect Meta to enable publishing.");

    const result = await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("scheduled");
    expect(result.data.publish_attempts).toBe(0);
    expect(result.data.provider_error).toBeNull();
  });

  it("refuses to schedule a post that is already scheduled, publishing, or published", async () => {
    const post = await makePost();
    await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: null });

    const result = await scheduleSocialPost(post.id, { scheduledAt: "2099-07-01T15:00:00.000Z", scheduledTimezone: null });
    expect(result.success).toBe(false);
  });
});

describe("rescheduleSocialPost", () => {
  it("updates scheduled_at/scheduled_timezone while still scheduled", async () => {
    const post = await makePost();
    await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: "UTC" });

    const result = await rescheduleSocialPost(post.id, { scheduledAt: "2099-08-01T09:00:00.000Z", scheduledTimezone: "America/Los_Angeles" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("scheduled");
    expect(result.data.scheduled_at).toBe("2099-08-01T09:00:00.000Z");
    expect(result.data.scheduled_timezone).toBe("America/Los_Angeles");
  });

  it("rejects rescheduling once a worker or manual Publish Now has claimed the post", async () => {
    const post = await makePost();
    await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: null });
    await beginSocialPostPublish(post.id);

    const result = await rescheduleSocialPost(post.id, { scheduledAt: "2099-08-01T09:00:00.000Z", scheduledTimezone: null });
    expect(result.success).toBe(false);
  });

  it("rejects rescheduling a plain draft (never scheduled)", async () => {
    const post = await makePost();
    const result = await rescheduleSocialPost(post.id, { scheduledAt: "2099-08-01T09:00:00.000Z", scheduledTimezone: null });
    expect(result.success).toBe(false);
  });
});

describe("cancelSocialPostSchedule", () => {
  it("returns a scheduled post to draft, clearing only scheduling fields", async () => {
    const post = await makePost({ caption: "Keep me." });
    await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: "UTC" });

    const result = await cancelSocialPostSchedule(post.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.scheduled_at).toBeNull();
    expect(result.data.scheduled_timezone).toBeNull();
    expect(result.data.caption).toBe("Keep me.");
    expect(result.data.asset_id).toBe(post.asset_id);
    expect(result.data.target_page_id).toBe(post.target_page_id);
  });

  it("rejects cancellation once the worker has claimed the post", async () => {
    const post = await makePost();
    await scheduleSocialPost(post.id, { scheduledAt: "2099-06-01T15:00:00.000Z", scheduledTimezone: null });
    await beginSocialPostPublish(post.id);

    const result = await cancelSocialPostSchedule(post.id);
    expect(result.success).toBe(false);
  });
});

describe("setSocialPostContainerId / markSocialPostPublished / markSocialPostFailed", () => {
  it("persists a container id independently of the final publish outcome", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    const result = await setSocialPostContainerId(post.id, "container_123");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.provider_container_id).toBe("container_123");
    expect(result.data.status).toBe("publishing");
  });

  it("marks published with the real provider post id, permalink, and published_at", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    await setSocialPostContainerId(post.id, "container_123");
    const result = await markSocialPostPublished(post.id, { providerPostId: "ig_media_1", providerPermalink: "https://instagram.com/p/abc123" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("published");
    expect(result.data.provider_post_id).toBe("ig_media_1");
    expect(result.data.provider_permalink).toBe("https://instagram.com/p/abc123");
    expect(result.data.published_at).not.toBeNull();
  });

  it("marks failed with only a sanitized error message, never raw provider details", async () => {
    const post = await makePost();
    await beginSocialPostPublish(post.id);
    const result = await markSocialPostFailed(post.id, "Reconnect Meta to enable publishing.");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("failed");
    expect(result.data.provider_error).toBe("Reconnect Meta to enable publishing.");
  });
});

describe("listSocialPosts / getSocialPost — workspace isolation", () => {
  it("lists both of the calling workspace's own posts", async () => {
    const first = await makePost({ caption: "First." });
    const second = await makePost({ caption: "Second." });
    const posts = await listSocialPosts(CURRENT_WORKSPACE_ID);
    expect(posts.map((p) => p.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("returns an empty list for a different workspace", async () => {
    await makePost();
    const posts = await listSocialPosts("ws_other_tenant");
    expect(posts).toEqual([]);
  });

  it("getSocialPost throws for an unknown id", async () => {
    await expect(getSocialPost("does_not_exist")).rejects.toThrow();
  });
});
